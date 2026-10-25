-- Remove unique constraint on short_code to allow same short code for multiple links in a project
-- This allows all links within a project to share the same short code

-- Drop the unique constraint on short_code
ALTER TABLE links DROP CONSTRAINT IF EXISTS links_short_code_key;

-- Create a new unique constraint that allows the same short_code across different projects
-- but ensures uniqueness within a project (project_id + short_code combination)
-- Note: This is optional - we might want to allow the same short_code across projects too
-- For now, we'll just remove the global unique constraint
