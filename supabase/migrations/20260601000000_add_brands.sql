/*
  # Add brands organizational layer

  - brands: user-owned folders for grouping projects (dashboard only)
  - projects.brand_id: optional FK to brands (ON DELETE SET NULL)
*/

CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_user_name_lower
  ON brands (user_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_brands_user_id ON brands(user_id);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brands"
  ON brands FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own brands"
  ON brands FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brands"
  ON brands FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own brands"
  ON brands FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_brand_id ON projects(brand_id);

DROP POLICY IF EXISTS "Users can update own projects" ON projects;

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      brand_id IS NULL
      OR EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = brand_id AND b.user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION update_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brands_updated_at ON brands;
CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_brands_updated_at();
