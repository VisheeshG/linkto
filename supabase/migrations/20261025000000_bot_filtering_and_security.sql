/*
  # Bot filtering, link features and security lockdown

  1. Bot / datacenter classification columns on link_clicks
     (traffic_type, bot_reason, asn, isp, is_hosting, visitor_hash) plus a
     best-effort backfill of existing rows from their stored user agent.
     Run `npm run backfill:bots` afterwards to also classify datacenter
     traffic for historical clicks (needs an IP lookup per unique IP).

  2. Link features: expires_at, utm_enabled.
     links.submission_number is used by the app but was never created by a
     migration (it was added by hand), so it is added here if missing.

  3. Security:
     - link_clicks are no longer readable or writable by the public. Clicks
       are written by the redirect handler with the service-role key, and
       public (shared) analytics are served by the /api/public/projects routes, which
       enforces project passwords and never returns IPs or user agents.
     - links / projects / brands are readable only by their owner. Redirects
       and public pages resolve them server-side with the service-role key.
     - Project slug availability is checked through a SECURITY DEFINER RPC
       instead of letting every user read every project.
     - Unused SECURITY DEFINER analytics functions / views from
       20251012000000 that bypassed RLS are dropped.
     - password_attempts table backs rate limiting of project passwords.
*/

-- ---------------------------------------------------------------------------
-- 1. Click classification columns
-- ---------------------------------------------------------------------------

ALTER TABLE link_clicks
  ADD COLUMN IF NOT EXISTS traffic_type text NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS bot_reason text,
  ADD COLUMN IF NOT EXISTS asn text,
  ADD COLUMN IF NOT EXISTS isp text,
  ADD COLUMN IF NOT EXISTS is_hosting boolean,
  ADD COLUMN IF NOT EXISTS visitor_hash text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'link_clicks_traffic_type_check'
  ) THEN
    ALTER TABLE link_clicks
      ADD CONSTRAINT link_clicks_traffic_type_check
      CHECK (traffic_type IN ('human', 'bot', 'datacenter', 'suspicious'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_traffic
  ON link_clicks (link_id, traffic_type);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_visitor_date
  ON link_clicks (link_id, visitor_hash, clicked_at DESC);

-- Keep the archive table (if it was created) column-compatible.
ALTER TABLE IF EXISTS link_clicks_archive
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS traffic_type text NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS bot_reason text,
  ADD COLUMN IF NOT EXISTS asn text,
  ADD COLUMN IF NOT EXISTS isp text,
  ADD COLUMN IF NOT EXISTS is_hosting boolean,
  ADD COLUMN IF NOT EXISTS visitor_hash text;

-- Backfill: classify existing clicks by user agent (mirrors lib/bot-detection.ts).
UPDATE link_clicks
SET traffic_type = 'bot',
    bot_reason = CASE
      WHEN coalesce(user_agent, '') = '' THEN 'Empty user agent'
      WHEN user_agent ~* '(facebookexternalhit|facebookcatalog|meta-externalagent|meta-externalfetcher)' THEN 'Meta link preview'
      WHEN user_agent ~* 'whatsapp' THEN 'WhatsApp link preview'
      WHEN user_agent ~* 'twitterbot' THEN 'X/Twitter link preview'
      WHEN user_agent ~* 'linkedinbot' THEN 'LinkedIn link preview'
      WHEN user_agent ~* '(slackbot|slack-imgproxy)' THEN 'Slack link preview'
      WHEN user_agent ~* 'telegrambot' THEN 'Telegram link preview'
      WHEN user_agent ~* 'discordbot' THEN 'Discord link preview'
      WHEN user_agent ~* '(googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|apis-google|feedfetcher-google|google-read-aloud|storebot-google)' THEN 'Google crawler'
      WHEN user_agent ~* '(bingbot|bingpreview|msnbot|adidxbot)' THEN 'Bing crawler'
      WHEN user_agent ~* 'applebot' THEN 'Apple crawler'
      WHEN user_agent ~* '(gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|ccbot|bytespider|amazonbot)' THEN 'AI crawler'
      WHEN user_agent ~* '(headlesschrome|phantomjs|puppeteer|playwright|selenium)' THEN 'Headless browser'
      WHEN user_agent ~* '(^curl/|^wget/|python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|java/|apache-httpclient|node-fetch|axios/|undici|postmanruntime|scrapy)' THEN 'HTTP library'
      WHEN user_agent !~* '^mozilla/' THEN 'Non-browser user agent'
      ELSE 'Generic bot'
    END
WHERE traffic_type = 'human'
  AND (
    coalesce(user_agent, '') = ''
    OR user_agent !~* '^mozilla/'
    OR user_agent ~* '(facebookexternalhit|facebookcatalog|meta-externalagent|meta-externalfetcher|whatsapp|twitterbot|linkedinbot|slackbot|slack-imgproxy|telegrambot|discordbot|skypeuripreview|pinterestbot|redditbot|vkshare|kakaotalk-scrap|iframely|embedly|outbrain|bitlybot|google-pagerenderer)'
    OR user_agent ~* '(googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|apis-google|feedfetcher-google|google-read-aloud|storebot-google|bingbot|bingpreview|msnbot|adidxbot|applebot|yandex|baiduspider|duckduckbot|duckassistbot|sogou|exabot|seznambot|petalbot)'
    OR user_agent ~* '(ahrefsbot|semrushbot|mj12bot|dotbot|rogerbot|screaming frog|dataforseobot|blexbot|serpstatbot)'
    OR user_agent ~* '(gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|ccbot|bytespider|amazonbot|cohere-ai|diffbot|youbot)'
    OR user_agent ~* '(uptimerobot|pingdom|statuscake|site24x7|newrelicpinger|censysinspect|zgrab|masscan|nessus|qualys|virustotal|urlscan|safebrowsing|phishtank|netcraft)'
    OR user_agent ~* '(headlesschrome|phantomjs|puppeteer|playwright|selenium)'
    OR user_agent ~* '(python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|java/|apache-httpclient|libwww-perl|node-fetch|axios/|undici|postmanruntime|scrapy)'
    OR user_agent ~* '(\ybot\y|bot/|crawler|spider|scraper|preview|fetcher)'
  );

-- Backfill: the old OS parser recorded iPhones as macOS and Android phones as
-- Linux. Re-derive OS for those rows from the stored user agent.
UPDATE link_clicks SET os = 'iOS'
WHERE os = 'macOS' AND user_agent ~* '(iphone|ipad|ipod)';

UPDATE link_clicks SET os = 'Android'
WHERE os = 'Linux' AND user_agent ~* 'android';

-- Android tablets were recorded as desktop.
UPDATE link_clicks SET device_type = 'tablet'
WHERE device_type = 'desktop' AND user_agent ~* 'android' AND user_agent !~* 'mobile';

-- ---------------------------------------------------------------------------
-- 2. Link features
-- ---------------------------------------------------------------------------

ALTER TABLE links
  ADD COLUMN IF NOT EXISTS submission_number text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS utm_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_links_project_short_code
  ON links (project_id, short_code);

-- ---------------------------------------------------------------------------
-- 3. Row level security lockdown
-- ---------------------------------------------------------------------------

-- link_clicks: owner-only reads; writes only via service role.
DROP POLICY IF EXISTS "Anyone can view link clicks" ON link_clicks;
DROP POLICY IF EXISTS "Anyone can record link clicks" ON link_clicks;
DROP POLICY IF EXISTS "Users can view clicks on own links" ON link_clicks;

CREATE POLICY "Users can view clicks on own links"
  ON link_clicks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM links
      JOIN projects ON projects.id = links.project_id
      WHERE links.id = link_clicks.link_id
      AND projects.user_id = auth.uid()
    )
  );

-- links: owner-only reads.
DROP POLICY IF EXISTS "Anyone can view link basic info" ON links;
DROP POLICY IF EXISTS "Anyone can view all links" ON links;
DROP POLICY IF EXISTS "Users can view own project links" ON links;

CREATE POLICY "Users can view own project links"
  ON links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = links.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- projects / brands: owner-only reads ("Users can view own ..." already exist).
DROP POLICY IF EXISTS "Anyone can view project basic info" ON projects;
DROP POLICY IF EXISTS "Anyone can view projects by slug" ON projects;
DROP POLICY IF EXISTS "Anyone can view brands by slug" ON brands;

-- project_passwords: remove duplicate policies left by 20251016000000.
DROP POLICY IF EXISTS "Project owners can view project passwords" ON project_passwords;
DROP POLICY IF EXISTS "Project owners can create project passwords" ON project_passwords;
DROP POLICY IF EXISTS "Project owners can delete project passwords" ON project_passwords;

-- Project slugs are globally unique (used in public URLs), so availability has
-- to be checked across all users without exposing their projects.
CREATE OR REPLACE FUNCTION is_project_slug_available(
  p_slug text,
  p_exclude_project_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM projects
    WHERE lower(slug) = lower(p_slug)
      AND (p_exclude_project_id IS NULL OR id <> p_exclude_project_id)
  );
$$;

REVOKE ALL ON FUNCTION is_project_slug_available(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_project_slug_available(text, uuid) TO authenticated;

-- Drop unused SECURITY DEFINER objects that exposed every user's clicks.
DROP VIEW IF EXISTS link_clicks_all;
DROP FUNCTION IF EXISTS get_link_analytics(uuid, date, date);
DROP FUNCTION IF EXISTS get_link_summary_stats(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS refresh_link_analytics();
DROP FUNCTION IF EXISTS archive_old_link_clicks(integer);
DROP MATERIALIZED VIEW IF EXISTS link_analytics_daily;

-- ---------------------------------------------------------------------------
-- 4. Password attempt log (rate limiting); service role only.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS password_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_hash text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_attempts_lookup
  ON password_attempts (project_id, client_hash, attempted_at DESC);

ALTER TABLE password_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON password_attempts FROM anon, authenticated;
