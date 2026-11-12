/*
  # Conversion tracking (visits, signups, purchases)

  See docs/conversion-tracking.md for the full picture.

  1. Click IDs
     - link_clicks.click_id: unguessable ID generated for every click and
       appended to the destination URL as `lt_id`. Conversion events carry it
       back so they can be credited to the creator who drove the click.
     - links.click_id_enabled: per-link switch (on by default).

  2. tracking_sites: one row per brand website / app that sends events.
     Holds the public site key (used by the browser snippet) and a SHA-256
     hash of the secret key (used by the server API). The secret itself is
     only ever returned once, by create_tracking_site / rotate_tracking_site_secret.

  3. conversion_events: one row per attributed event. Denormalised
     (owner, project, link, creator) so reports never join back to link_clicks.
     Written only by the service role through record_conversion_event().

  4. Aggregation functions so dashboards count in the database instead of
     downloading raw rows: conversion_summary, click_counts_per_link,
     click_counts_per_creator.

  Safe to run more than once.
*/

-- ---------------------------------------------------------------------------
-- 1. Click IDs
-- ---------------------------------------------------------------------------

ALTER TABLE link_clicks ADD COLUMN IF NOT EXISTS click_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_link_clicks_click_id
  ON link_clicks (click_id)
  WHERE click_id IS NOT NULL;

ALTER TABLE IF EXISTS link_clicks_archive ADD COLUMN IF NOT EXISTS click_id text;

ALTER TABLE links
  ADD COLUMN IF NOT EXISTS click_id_enabled boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 2. Tracking sites (integration keys)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tracking_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  default_currency text NOT NULL DEFAULT 'INR',
  public_key text NOT NULL UNIQUE,
  secret_key_hash text NOT NULL UNIQUE,
  secret_key_hint text NOT NULL,
  last_event_at timestamptz,
  test_visit_at timestamptz,
  test_signup_at timestamptz,
  test_purchase_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_sites_user_id ON tracking_sites (user_id);

ALTER TABLE tracking_sites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON tracking_sites FROM anon, authenticated;
-- Keys are created and rotated only through the functions below, so owners
-- get SELECT / DELETE on rows and UPDATE on the descriptive columns only.
GRANT SELECT, DELETE ON tracking_sites TO authenticated;
GRANT UPDATE (name, domain, default_currency, updated_at) ON tracking_sites TO authenticated;

DROP POLICY IF EXISTS "Users can view own tracking sites" ON tracking_sites;
CREATE POLICY "Users can view own tracking sites"
  ON tracking_sites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tracking sites" ON tracking_sites;
CREATE POLICY "Users can update own tracking sites"
  ON tracking_sites FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tracking sites" ON tracking_sites;
CREATE POLICY "Users can delete own tracking sites"
  ON tracking_sites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION linkto_random_token(p_prefix text, p_uuids integer)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT p_prefix || string_agg(replace(gen_random_uuid()::text, '-', ''), '')
  FROM generate_series(1, p_uuids);
$$;

CREATE OR REPLACE FUNCTION linkto_hash_secret(p_secret text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(p_secret, 'UTF8')), 'hex');
$$;

-- Creates a site for the signed-in user. The secret key is returned here and
-- never again (only its hash is stored).
CREATE OR REPLACE FUNCTION create_tracking_site(
  p_name text,
  p_domain text DEFAULT NULL,
  p_default_currency text DEFAULT 'INR'
)
RETURNS TABLE (id uuid, public_key text, secret_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_secret text := linkto_random_token('lt_sec_', 2);
  v_public text := linkto_random_token('lt_pub_', 1);
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Name is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO tracking_sites (
    user_id, name, domain, default_currency,
    public_key, secret_key_hash, secret_key_hint
  )
  VALUES (
    v_user,
    btrim(p_name),
    nullif(btrim(coalesce(p_domain, '')), ''),
    upper(coalesce(nullif(btrim(p_default_currency), ''), 'INR')),
    v_public,
    linkto_hash_secret(v_secret),
    right(v_secret, 4)
  )
  RETURNING tracking_sites.id INTO v_id;

  RETURN QUERY SELECT v_id, v_public, v_secret;
END;
$$;

-- Replaces a site's secret key; the old one stops working immediately.
CREATE OR REPLACE FUNCTION rotate_tracking_site_secret(p_site_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text := linkto_random_token('lt_sec_', 2);
  v_updated integer;
BEGIN
  UPDATE tracking_sites
  SET secret_key_hash = linkto_hash_secret(v_secret),
      secret_key_hint = right(v_secret, 4),
      updated_at = now()
  WHERE id = p_site_id AND user_id = auth.uid();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Site not found' USING ERRCODE = '42501';
  END IF;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION linkto_random_token(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION linkto_hash_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION create_tracking_site(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rotate_tracking_site_secret(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_tracking_site(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rotate_tracking_site_secret(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Conversion events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  site_id uuid REFERENCES tracking_sites(id) ON DELETE SET NULL,
  click_id text NOT NULL,
  creator_username text,
  submission_number text,
  event_type text NOT NULL CHECK (event_type IN ('visit', 'signup', 'purchase', 'custom')),
  event_name text,
  amount numeric(14, 2),
  currency text,
  order_id text,
  external_user_id text,
  source text NOT NULL DEFAULT 'browser' CHECK (source IN ('browser', 'server')),
  dedupe_key text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- One row per real-world event: retries, page refreshes and a browser +
-- server report of the same order all collapse onto the same key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversion_events_dedupe
  ON conversion_events (owner_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_conversion_events_link_time
  ON conversion_events (link_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversion_events_project
  ON conversion_events (project_id);

CREATE INDEX IF NOT EXISTS idx_conversion_events_site
  ON conversion_events (site_id)
  WHERE site_id IS NOT NULL;

-- "Which click did this customer come from?" for server events sent with
-- only a user ID (renewals, payment webhooks).
CREATE INDEX IF NOT EXISTS idx_conversion_events_external_user
  ON conversion_events (owner_id, external_user_id, occurred_at DESC)
  WHERE external_user_id IS NOT NULL;

ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON conversion_events FROM anon, authenticated;
GRANT SELECT ON conversion_events TO authenticated;

DROP POLICY IF EXISTS "Users can view own conversion events" ON conversion_events;
CREATE POLICY "Users can view own conversion events"
  ON conversion_events FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

/*
  Attributes one event and stores it. Called by POST /api/v1/events with the
  service role; one round trip per event.

  Returns one of:
    recorded       stored and credited to a creator
    duplicate      already stored (same dedupe key)
    unknown_click  no click with that ID, and no earlier event for that user
    forbidden      the click belongs to a different Linkto account than the key
    expired        the click is older than the attribution window
*/
CREATE OR REPLACE FUNCTION record_conversion_event(
  p_site_id uuid,
  p_owner_id uuid,
  p_click_id text,
  p_external_user_id text,
  p_event_type text,
  p_event_name text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_order_id text DEFAULT NULL,
  p_event_id text DEFAULT NULL,
  p_source text DEFAULT 'browser',
  p_window_days integer DEFAULT 30
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_click_id text := nullif(p_click_id, '');
  v_user text := nullif(p_external_user_id, '');
  v_link_id uuid;
  v_project_id uuid;
  v_owner_id uuid;
  v_creator text;
  v_submission text;
  v_clicked_at timestamptz;
  v_dedupe text;
  v_inserted integer;
BEGIN
  IF v_click_id IS NOT NULL THEN
    SELECT c.link_id, l.project_id, p.user_id, c.creator_username,
           c.submission_number, c.clicked_at
    INTO v_link_id, v_project_id, v_owner_id, v_creator, v_submission, v_clicked_at
    FROM link_clicks c
    JOIN links l ON l.id = c.link_id
    JOIN projects p ON p.id = l.project_id
    WHERE c.click_id = v_click_id;
  END IF;

  -- No usable click ID: fall back to the click this customer was last
  -- attributed to (their signup, usually).
  IF v_link_id IS NULL AND v_user IS NOT NULL THEN
    SELECT c.click_id, c.link_id, l.project_id, p.user_id, c.creator_username,
           c.submission_number, c.clicked_at
    INTO v_click_id, v_link_id, v_project_id, v_owner_id, v_creator, v_submission, v_clicked_at
    FROM conversion_events e
    JOIN link_clicks c ON c.click_id = e.click_id
    JOIN links l ON l.id = c.link_id
    JOIN projects p ON p.id = l.project_id
    WHERE e.owner_id = p_owner_id AND e.external_user_id = v_user
    ORDER BY e.occurred_at DESC
    LIMIT 1;
  END IF;

  IF v_link_id IS NULL THEN
    RETURN 'unknown_click';
  END IF;
  IF v_owner_id <> p_owner_id THEN
    RETURN 'forbidden';
  END IF;
  IF v_clicked_at < now() - make_interval(days => p_window_days) THEN
    RETURN 'expired';
  END IF;

  v_dedupe := CASE p_event_type
    WHEN 'visit' THEN 'visit:' || v_click_id
    WHEN 'signup' THEN 'signup:' || coalesce('u:' || v_user, 'c:' || v_click_id)
    WHEN 'purchase' THEN 'purchase:' || coalesce(
      'o:' || nullif(p_order_id, ''),
      'c:' || v_click_id || ':' || coalesce(p_amount::text, '') || ':' ||
        coalesce(p_currency, '') || ':' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD')
    )
    ELSE 'custom:' || coalesce(p_event_name, '') || ':' ||
      coalesce('e:' || nullif(p_event_id, ''), 'c:' || v_click_id)
  END;

  INSERT INTO conversion_events (
    owner_id, project_id, link_id, site_id, click_id, creator_username,
    submission_number, event_type, event_name, amount, currency, order_id,
    external_user_id, source, dedupe_key
  )
  VALUES (
    v_owner_id, v_project_id, v_link_id, p_site_id, v_click_id, v_creator,
    v_submission, p_event_type, p_event_name, p_amount, p_currency,
    nullif(p_order_id, ''), v_user, p_source, v_dedupe
  )
  ON CONFLICT (owner_id, dedupe_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Throttled so a busy site does not rewrite its row on every event.
  UPDATE tracking_sites
  SET last_event_at = now()
  WHERE id = p_site_id
    AND (last_event_at IS NULL OR last_event_at < now() - interval '1 minute');

  RETURN CASE WHEN v_inserted > 0 THEN 'recorded' ELSE 'duplicate' END;
END;
$$;

REVOKE ALL ON FUNCTION record_conversion_event(
  uuid, uuid, text, text, text, text, numeric, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_conversion_event(
  uuid, uuid, text, text, text, text, numeric, text, text, text, text, integer
) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Aggregation (dashboards count in the database)
-- ---------------------------------------------------------------------------

-- All three run as the caller, so row level security limits a signed-in user
-- to their own data. Shared report pages call them with the service role
-- after checking the project password.

CREATE OR REPLACE FUNCTION conversion_summary(
  p_link_ids uuid[],
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  link_id uuid,
  creator_username text,
  event_type text,
  event_name text,
  currency text,
  events bigint,
  revenue numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT e.link_id,
         coalesce(e.creator_username, '') AS creator_username,
         e.event_type,
         coalesce(e.event_name, '') AS event_name,
         coalesce(e.currency, '') AS currency,
         count(*) AS events,
         coalesce(sum(e.amount), 0) AS revenue
  FROM conversion_events e
  WHERE e.link_id = ANY (p_link_ids)
    AND (p_from IS NULL OR e.occurred_at >= p_from)
    AND (p_to IS NULL OR e.occurred_at < p_to)
  GROUP BY 1, 2, 3, 4, 5
  ORDER BY 1, 2, 3, 4, 5;
$$;

CREATE OR REPLACE FUNCTION click_counts_per_link(
  p_link_ids uuid[],
  p_human_only boolean DEFAULT false
)
RETURNS TABLE (link_id uuid, clicks bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.link_id, count(*) AS clicks
  FROM link_clicks c
  WHERE c.link_id = ANY (p_link_ids)
    AND (NOT p_human_only OR c.traffic_type = 'human')
  GROUP BY c.link_id
  ORDER BY c.link_id;
$$;

CREATE OR REPLACE FUNCTION click_counts_per_creator(
  p_link_ids uuid[],
  p_human_only boolean DEFAULT false,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (creator_username text, clicks bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(c.creator_username, '') AS creator_username, count(*) AS clicks
  FROM link_clicks c
  WHERE c.link_id = ANY (p_link_ids)
    AND (NOT p_human_only OR c.traffic_type = 'human')
    AND (p_from IS NULL OR c.clicked_at >= p_from)
    AND (p_to IS NULL OR c.clicked_at < p_to)
  GROUP BY 1
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION conversion_summary(uuid[], timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION click_counts_per_link(uuid[], boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION click_counts_per_creator(uuid[], boolean, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION conversion_summary(uuid[], timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION click_counts_per_link(uuid[], boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION click_counts_per_creator(uuid[], boolean, timestamptz, timestamptz) TO authenticated, service_role;
