-- Add state/region to link click geo tracking
ALTER TABLE link_clicks
  ADD COLUMN IF NOT EXISTS state text;
