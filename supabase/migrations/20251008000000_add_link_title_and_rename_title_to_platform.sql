-- Migration to add link_title field and rename title to platform
-- This migration:
-- 1. Adds a new 'link_title' column to store the user-friendly link title
-- 2. Renames the existing 'title' column to 'platform' to better reflect its purpose

-- Step 1: Add the new link_title column
ALTER TABLE links 
ADD COLUMN link_title text;

-- Step 2: Copy existing title values to link_title (temporary data migration)
UPDATE links 
SET link_title = title 
WHERE link_title IS NULL;

-- Step 3: Make link_title NOT NULL after populating it
ALTER TABLE links 
ALTER COLUMN link_title SET NOT NULL;

-- Step 4: Rename title column to platform
ALTER TABLE links 
RENAME COLUMN title TO platform;

-- Add comment to clarify the purpose of each column
COMMENT ON COLUMN links.link_title IS 'User-friendly title for the link (e.g., "My Instagram Post")';
COMMENT ON COLUMN links.platform IS 'Platform name for analytics tracking (e.g., "Instagram", "YouTube", "TikTok")';
