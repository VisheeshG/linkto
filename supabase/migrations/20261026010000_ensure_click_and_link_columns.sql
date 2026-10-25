/*
  # Ensure every column the app reads / writes exists

  Some databases were not built from these migration files and can be
  missing columns that the schema migration assumes (e.g. link_clicks.referrer).
  A missing column makes the analytics query fail (dashboard shows 0 clicks)
  and makes the redirect's click insert fail (new clicks are not saved).

  Adds any missing column; existing columns and data are untouched.
  Safe to run more than once.
*/

ALTER TABLE link_clicks
  ADD COLUMN IF NOT EXISTS platform_name text,
  ADD COLUMN IF NOT EXISTS creator_username text,
  ADD COLUMN IF NOT EXISTS submission_number text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS traffic_type text NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS bot_reason text,
  ADD COLUMN IF NOT EXISTS asn text,
  ADD COLUMN IF NOT EXISTS isp text,
  ADD COLUMN IF NOT EXISTS is_hosting boolean,
  ADD COLUMN IF NOT EXISTS visitor_hash text;

ALTER TABLE links
  ADD COLUMN IF NOT EXISTS link_title text,
  ADD COLUMN IF NOT EXISTS submission_number text,
  ADD COLUMN IF NOT EXISTS open_app_on_mobile boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_submission_in_url boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS utm_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Make PostgREST pick up new columns immediately.
NOTIFY pgrst, 'reload schema';
