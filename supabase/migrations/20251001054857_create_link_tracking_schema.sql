/*
  # Link Tracking System Schema

  ## Overview
  This migration creates a complete link tracking system for brands to manage projects,
  track links, and analyze traffic data.

  ## 1. New Tables

  ### `profiles`
  - `id` (uuid, primary key) - References auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `company_name` (text, optional) - Brand or company name
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `projects`
  - `id` (uuid, primary key) - Unique project identifier
  - `user_id` (uuid, foreign key) - Owner of the project
  - `name` (text) - Project name (e.g., "Website Campaign", "App Launch")
  - `description` (text, optional) - Project description
  - `slug` (text, unique) - URL-friendly identifier for the project
  - `created_at` (timestamptz) - Project creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `links`
  - `id` (uuid, primary key) - Unique link identifier
  - `project_id` (uuid, foreign key) - Associated project
  - `destination_url` (text) - Original URL to redirect to
  - `short_code` (text, unique) - Short identifier for the link
  - `title` (text) - Link title/description
  - `created_at` (timestamptz) - Link creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `link_clicks`
  - `id` (uuid, primary key) - Unique click identifier
  - `link_id` (uuid, foreign key) - Associated link
  - `platform_name` (text, optional) - Platform name (e.g., "goc")
  - `creator_username` (text, optional) - Creator's username
  - `submission_number` (text, optional) - Submission identifier (e.g., "sub1")
  - `ip_address` (text, optional) - Visitor IP address (hashed for privacy)
  - `user_agent` (text, optional) - Browser user agent string
  - `referrer` (text, optional) - Referrer URL
  - `country` (text, optional) - Visitor country
  - `city` (text, optional) - Visitor city
  - `device_type` (text, optional) - Device type (mobile, desktop, tablet)
  - `browser` (text, optional) - Browser name
  - `os` (text, optional) - Operating system
  - `clicked_at` (timestamptz) - Timestamp of click

  ## 2. Security
  - Enable Row Level Security (RLS) on all tables
  - Users can only access their own profiles
  - Users can only manage their own projects
  - Users can only manage links in their own projects
  - Users can only view analytics for their own links
  - Link clicks are publicly insertable (for tracking) but only viewable by link owners

  ## 3. Indexes
  - Index on project slugs for fast lookup
  - Index on link short codes for fast redirects
  - Index on link_clicks.link_id for analytics queries
  - Index on link_clicks.clicked_at for time-based queries

  ## 4. Important Notes
  - All tables use UUID primary keys for security
  - Timestamps use timestamptz for proper timezone handling
  - RLS policies ensure data isolation between users
  - Link clicks are tracked anonymously but link owners can view aggregated data
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  company_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index on project slugs
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Create links table
CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  destination_url text NOT NULL,
  short_code text UNIQUE NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE links ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can create links in own projects"
  ON links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = links.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project links"
  ON links FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = links.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = links.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project links"
  ON links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = links.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Allow anonymous users to view all links for redirects
CREATE POLICY "Anyone can view all links"
  ON links FOR SELECT
  TO anon
  USING (true);

-- Create index on link short codes
CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);
CREATE INDEX IF NOT EXISTS idx_links_project_id ON links(project_id);

-- Create link_clicks table
CREATE TABLE IF NOT EXISTS link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  platform_name text,
  creator_username text,
  submission_number text,
  ip_address text,
  user_agent text,
  referrer text,
  country text,
  city text,
  device_type text,
  browser text,
  os text,
  clicked_at timestamptz DEFAULT now()
);

ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert click data
CREATE POLICY "Anyone can record link clicks"
  ON link_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view clicks for their own links
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

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_clicks_platform ON link_clicks(platform_name);
CREATE INDEX IF NOT EXISTS idx_link_clicks_creator ON link_clicks(creator_username);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at'
  ) THEN
    CREATE TRIGGER update_projects_updated_at
      BEFORE UPDATE ON projects
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_links_updated_at'
  ) THEN
    CREATE TRIGGER update_links_updated_at
      BEFORE UPDATE ON links
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;