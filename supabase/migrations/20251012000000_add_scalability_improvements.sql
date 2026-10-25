/*
  # Scalability Improvements Migration
  
  This migration adds critical scalability improvements:
  1. Composite indexes for faster analytics queries
  2. Materialized view for pre-aggregated analytics
  3. Functions for efficient data aggregation
  4. Partial indexes for recent data
  5. Archive table for old data
*/

-- 1. Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_creator_date 
  ON link_clicks(link_id, creator_username, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_submission_date 
  ON link_clicks(link_id, submission_number, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_country 
  ON link_clicks(link_id, country);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_device 
  ON link_clicks(link_id, device_type);

-- Index for recent-data queries. (A partial index on NOW() is not allowed:
-- index predicates must be IMMUTABLE, which made this migration fail.)
CREATE INDEX IF NOT EXISTS idx_link_clicks_recent
  ON link_clicks(link_id, clicked_at DESC);

-- 2. Create materialized view for daily aggregated analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS link_analytics_daily AS
SELECT 
  link_id,
  DATE(clicked_at) as date,
  creator_username,
  submission_number,
  country,
  city,
  device_type,
  browser,
  os,
  platform_name,
  COUNT(*) as click_count
FROM link_clicks
GROUP BY 
  link_id, 
  DATE(clicked_at), 
  creator_username, 
  submission_number, 
  country,
  city,
  device_type, 
  browser,
  os,
  platform_name;

-- Create indexes on the materialized view
CREATE INDEX IF NOT EXISTS idx_link_analytics_daily_link_date 
  ON link_analytics_daily(link_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_link_analytics_daily_creator 
  ON link_analytics_daily(link_id, creator_username, date DESC);

-- 3. Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_link_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY link_analytics_daily;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to get aggregated analytics for a link efficiently
CREATE OR REPLACE FUNCTION get_link_analytics(
  p_link_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  date date,
  creator_username text,
  submission_number text,
  country text,
  city text,
  device_type text,
  browser text,
  os text,
  total_clicks bigint
) AS $$
BEGIN
  -- Use materialized view if available, otherwise query directly
  RETURN QUERY
  SELECT 
    DATE(clicked_at) as date,
    lc.creator_username,
    lc.submission_number,
    lc.country,
    lc.city,
    lc.device_type,
    lc.browser,
    lc.os,
    COUNT(*)::bigint as total_clicks
  FROM link_clicks lc
  WHERE lc.link_id = p_link_id
    AND (p_start_date IS NULL OR DATE(lc.clicked_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(lc.clicked_at) <= p_end_date)
  GROUP BY 
    DATE(lc.clicked_at),
    lc.creator_username,
    lc.submission_number,
    lc.country,
    lc.city,
    lc.device_type,
    lc.browser,
    lc.os
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Function to get summary statistics for a link
CREATE OR REPLACE FUNCTION get_link_summary_stats(
  p_link_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_clicks', COUNT(*),
    'unique_creators', COUNT(DISTINCT creator_username),
    'unique_countries', COUNT(DISTINCT country),
    'unique_devices', COUNT(DISTINCT device_type),
    'clicks_by_device', (
      SELECT json_object_agg(device_type, cnt)
      FROM (
        SELECT device_type, COUNT(*) as cnt
        FROM link_clicks
        WHERE link_id = p_link_id
          AND (p_start_date IS NULL OR clicked_at >= p_start_date)
          AND (p_end_date IS NULL OR clicked_at <= p_end_date)
        GROUP BY device_type
      ) sub
    ),
    'clicks_by_country', (
      SELECT json_object_agg(country, cnt)
      FROM (
        SELECT country, COUNT(*) as cnt
        FROM link_clicks
        WHERE link_id = p_link_id
          AND (p_start_date IS NULL OR clicked_at >= p_start_date)
          AND (p_end_date IS NULL OR clicked_at <= p_end_date)
          AND country IS NOT NULL
        GROUP BY country
        ORDER BY cnt DESC
        LIMIT 20
      ) sub
    ),
    'clicks_by_browser', (
      SELECT json_object_agg(browser, cnt)
      FROM (
        SELECT browser, COUNT(*) as cnt
        FROM link_clicks
        WHERE link_id = p_link_id
          AND (p_start_date IS NULL OR clicked_at >= p_start_date)
          AND (p_end_date IS NULL OR clicked_at <= p_end_date)
        GROUP BY browser
      ) sub
    )
  ) INTO result
  FROM link_clicks
  WHERE link_id = p_link_id
    AND (p_start_date IS NULL OR clicked_at >= p_start_date)
    AND (p_end_date IS NULL OR clicked_at <= p_end_date);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6. Create archive table for old clicks
CREATE TABLE IF NOT EXISTS link_clicks_archive (
  LIKE link_clicks INCLUDING ALL
);

-- Add comment to differentiate
COMMENT ON TABLE link_clicks_archive IS 'Archive for link_clicks older than 1 year';

-- 7. Function to archive old clicks (run monthly)
CREATE OR REPLACE FUNCTION archive_old_link_clicks(older_than_days integer DEFAULT 365)
RETURNS integer AS $$
DECLARE
  rows_archived integer;
BEGIN
  -- Move old clicks to archive
  WITH moved_rows AS (
    INSERT INTO link_clicks_archive
    SELECT * FROM link_clicks
    WHERE clicked_at < NOW() - (older_than_days || ' days')::interval
    RETURNING id
  )
  SELECT COUNT(*) INTO rows_archived FROM moved_rows;
  
  -- Delete archived rows from main table
  DELETE FROM link_clicks
  WHERE clicked_at < NOW() - (older_than_days || ' days')::interval;
  
  RETURN rows_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add RLS policies for new objects
ALTER TABLE link_clicks_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view archived clicks on own links"
  ON link_clicks_archive FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM links
      JOIN projects ON projects.id = links.project_id
      WHERE links.id = link_clicks_archive.link_id
      AND projects.user_id = auth.uid()
    )
  );

-- 9. Create a view that combines active and archived clicks for historical queries
CREATE VIEW link_clicks_all AS
  SELECT *, 'active' as source FROM link_clicks
  UNION ALL
  SELECT *, 'archive' as source FROM link_clicks_archive;

-- Grant permissions
GRANT SELECT ON link_clicks_all TO authenticated;
GRANT SELECT ON link_analytics_daily TO authenticated;
GRANT EXECUTE ON FUNCTION get_link_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_link_summary_stats TO authenticated;

-- Note: refresh_link_analytics and archive_old_link_clicks should be called by scheduled jobs
-- For Supabase: Use pg_cron or external cron jobs
-- Example: SELECT cron.schedule('refresh-analytics', '0 * * * *', 'SELECT refresh_link_analytics()');

