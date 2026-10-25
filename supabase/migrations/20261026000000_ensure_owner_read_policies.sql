/*
  # Ensure owners can read their own data

  20261025000000 removed the public SELECT policies on projects, links,
  brands and link_clicks, assuming owner-only SELECT policies already
  existed. Some databases never had the owner policy on projects (they relied
  on the public one), so owners saw 0 projects / links / clicks.

  This (re)creates every owner SELECT policy explicitly. Safe to run more
  than once.
*/

GRANT SELECT ON projects, links, brands, link_clicks, project_passwords TO authenticated;

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own brands" ON brands;
CREATE POLICY "Users can view own brands"
  ON brands FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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

DROP POLICY IF EXISTS "Owners can view project passwords" ON project_passwords;
CREATE POLICY "Owners can view project passwords"
  ON project_passwords FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_passwords.project_id
      AND projects.user_id = auth.uid()
    )
  );
