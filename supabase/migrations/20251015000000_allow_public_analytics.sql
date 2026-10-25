/*
  # Allow Public Analytics Viewing
  
  1. Fix: Allow public (anon + authenticated) to view link_clicks for analytics
  2. Fix: Ensure the SELECT policy is available to anyone viewing a public project
*/

-- Allow everyone to view link clicks so analytics can be rendered on public pages
DROP POLICY IF EXISTS "Users can view clicks on own links" ON link_clicks;
DROP POLICY IF EXISTS "Anyone can view link clicks" ON link_clicks;

CREATE POLICY "Anyone can view link clicks"
  ON link_clicks FOR SELECT
  TO public
  USING (true);
