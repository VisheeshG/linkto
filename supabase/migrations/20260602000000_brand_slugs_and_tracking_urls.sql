/*
  Brand slugs for credible tracking URLs:
  linkto.in/{brandSlug}/{projectSlug}/{shortCode}/{creator}[/sub1]

  Optional submission segment per link via include_submission_in_url.
*/

ALTER TABLE brands ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slugs from name (unique per user)
DO $$
DECLARE
  r RECORD;
  base_slug text;
  candidate text;
  n integer;
BEGIN
  FOR r IN SELECT id, user_id, name FROM brands WHERE slug IS NULL OR slug = '' LOOP
    base_slug := lower(regexp_replace(trim(r.name), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' OR length(base_slug) < 2 THEN
      base_slug := 'brand';
    END IF;
    IF length(base_slug) > 48 THEN
      base_slug := left(base_slug, 48);
    END IF;
    candidate := base_slug;
    n := 0;
    WHILE EXISTS (
      SELECT 1 FROM brands b
      WHERE b.user_id = r.user_id AND lower(b.slug) = lower(candidate) AND b.id <> r.id
    ) LOOP
      n := n + 1;
      candidate := base_slug || '-' || n::text;
    END LOOP;
    UPDATE brands SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE brands ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_user_slug_lower
  ON brands (user_id, lower(slug));

ALTER TABLE links
  ADD COLUMN IF NOT EXISTS include_submission_in_url boolean NOT NULL DEFAULT false;

-- Public read for redirect resolution (matches projects policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'brands'
      AND policyname = 'Anyone can view brands by slug'
  ) THEN
    CREATE POLICY "Anyone can view brands by slug"
      ON brands FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
