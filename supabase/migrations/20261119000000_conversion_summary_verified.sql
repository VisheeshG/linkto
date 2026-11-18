/*
  # Verified counts in conversion reports

  conversion_summary() gains `verified_events`: how many of the events in each
  group were sent by the site's server with its secret key (source = 'server')
  and so cannot have been forged from a browser. Reports show it next to
  purchases.

  The return type changes, so the function is dropped and recreated.
  Safe to run more than once.
*/

DROP FUNCTION IF EXISTS conversion_summary(uuid[], timestamptz, timestamptz);

CREATE FUNCTION conversion_summary(
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
  revenue numeric,
  verified_events bigint
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
         coalesce(sum(e.amount), 0) AS revenue,
         count(*) FILTER (WHERE e.source = 'server') AS verified_events
  FROM conversion_events e
  WHERE e.link_id = ANY (p_link_ids)
    AND (p_from IS NULL OR e.occurred_at >= p_from)
    AND (p_to IS NULL OR e.occurred_at < p_to)
  GROUP BY 1, 2, 3, 4, 5
  ORDER BY 1, 2, 3, 4, 5;
$$;

REVOKE ALL ON FUNCTION conversion_summary(uuid[], timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION conversion_summary(uuid[], timestamptz, timestamptz) TO authenticated, service_role;
