/*
  # Create Profile View Preferences Table

  1. New Tables
    - `profile_view_preferences`
      - `id` (uuid, primary key) - Unique identifier for the preference record
      - `profile_id` (uuid, foreign key) - References the profile that owns these preferences
      - `view_name` (text, not null) - Name of the view (e.g., 'transactions_filters', 'transactions_status')
      - `preferences` (jsonb, not null) - JSON object containing all preference settings
      - `created_at` (timestamptz) - When the preference was first created
      - `updated_at` (timestamptz) - When the preference was last updated

  2. Security
    - Enable RLS on `profile_view_preferences` table
    - Add policies for authenticated users to manage their own profile preferences
    - Users can only access preferences for profiles they have membership in

  3. Indexes
    - Add index on profile_id for fast lookups
    - Add unique index on (profile_id, view_name) to prevent duplicates

  4. Notes
    - Each profile can have one preference record per view_name
    - Preferences are automatically deleted when profile is deleted (CASCADE)
    - The preferences JSONB column allows flexible storage of any view settings
*/

-- Create the profile_view_preferences table
CREATE TABLE IF NOT EXISTS profile_view_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  view_name text NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_profile_view UNIQUE (profile_id, view_name)
);

-- Create index on profile_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_profile_view_preferences_profile_id 
  ON profile_view_preferences(profile_id);

-- Create index on view_name for filtering
CREATE INDEX IF NOT EXISTS idx_profile_view_preferences_view_name 
  ON profile_view_preferences(view_name);

-- Enable Row Level Security
ALTER TABLE profile_view_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read preferences for profiles they have membership in
CREATE POLICY "Users can read own profile view preferences"
  ON profile_view_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = profile_view_preferences.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

-- Policy: Users can insert preferences for profiles they have membership in
CREATE POLICY "Users can insert own profile view preferences"
  ON profile_view_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = profile_view_preferences.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

-- Policy: Users can update preferences for profiles they have membership in
CREATE POLICY "Users can update own profile view preferences"
  ON profile_view_preferences
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = profile_view_preferences.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = profile_view_preferences.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

-- Policy: Users can delete preferences for profiles they have membership in
CREATE POLICY "Users can delete own profile view preferences"
  ON profile_view_preferences
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = profile_view_preferences.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_view_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_profile_view_preferences_updated_at
  BEFORE UPDATE ON profile_view_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_view_preferences_updated_at();