/*
  # Remove is_active column from links table

  ## Overview
  This migration removes the is_active column from the links table since all links
  should now be considered active by default.

  ## Changes
  - Remove is_active column from links table
  - Update RLS policy to allow anonymous access to all links (not just active ones)
*/

-- Remove the is_active column from links table
ALTER TABLE links DROP COLUMN IF EXISTS is_active;

-- Drop the old policy that restricted anonymous access to active links only
DROP POLICY IF EXISTS "Anyone can view active links" ON links;

-- Create new policy that allows anonymous access to all links
DROP POLICY IF EXISTS "Anyone can view all links" ON links;
CREATE POLICY "Anyone can view all links"
  ON links FOR SELECT
  TO anon
  USING (true);
