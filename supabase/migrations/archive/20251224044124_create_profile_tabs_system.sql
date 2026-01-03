/*
  # Create Profile Tabs System
  
  ## Overview
  This migration creates the infrastructure for a browser-like multi-profile tab system where
  users can have multiple profile contexts open simultaneously (personal, household members, businesses).
  
  ## New Tables
  
  ### profile_tabs
  Represents an open profile tab/workspace for a user
  - `id` (uuid, primary key) - Unique identifier for the tab
  - `owner_user_id` (uuid, references auth.users) - The user who owns this tab
  - `profile_user_id` (uuid, references auth.users) - Whose data this tab displays
  - `profile_type` (text) - Type of profile: 'personal', 'household', 'business'
  - `profile_name` (text) - Display name for the tab
  - `profile_metadata` (jsonb) - Additional metadata like permissions, color, etc.
  - `tab_order` (integer) - Display order of tabs
  - `is_pinned` (boolean) - Whether this tab is pinned to stay open
  - `is_active` (boolean) - Currently active tab
  - `state_data` (jsonb) - Stores tab-specific UI state (filters, selections, etc.)
  - `last_accessed_at` (timestamptz) - Last time this tab was active
  - `created_at` (timestamptz) - When the tab was created
  - `updated_at` (timestamptz) - Last update time
  
  ## Security
  - Enable RLS on profile_tabs table
  - Users can only access their own profile tabs
  - Add policies for viewing, creating, updating, and deleting tabs
  
  ## Performance
  - Add index on owner_user_id for fast lookups
  - Add index on tab_order for efficient sorting
  - Add index on is_active for finding active tab
  
  ## Important Notes
  - Each user automatically gets a default personal profile tab on first use
  - Maximum of 10 tabs per user to prevent performance issues
  - Tab state is persisted to maintain context when switching
*/

-- Create profile_tabs table
CREATE TABLE IF NOT EXISTS profile_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type text NOT NULL DEFAULT 'personal' CHECK (profile_type IN ('personal', 'household', 'business')),
  profile_name text NOT NULL,
  profile_metadata jsonb DEFAULT '{}'::jsonb,
  tab_order integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  state_data jsonb DEFAULT '{}'::jsonb,
  last_accessed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_tab_order CHECK (tab_order >= 0)
);

-- Create partial unique index to ensure only one active tab per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_tabs_unique_active_per_user 
  ON profile_tabs(owner_user_id) 
  WHERE (is_active = true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_tabs_owner_user_id ON profile_tabs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_tabs_tab_order ON profile_tabs(owner_user_id, tab_order);
CREATE INDEX IF NOT EXISTS idx_profile_tabs_is_active ON profile_tabs(owner_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_profile_tabs_last_accessed ON profile_tabs(owner_user_id, last_accessed_at DESC);

-- Enable RLS
ALTER TABLE profile_tabs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profile_tabs

-- Users can view their own profile tabs
CREATE POLICY "Users can view own profile tabs"
  ON profile_tabs FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

-- Users can create their own profile tabs (max 10 tabs)
CREATE POLICY "Users can create own profile tabs"
  ON profile_tabs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND (
      SELECT COUNT(*) 
      FROM profile_tabs 
      WHERE owner_user_id = auth.uid()
    ) < 10
  );

-- Users can update their own profile tabs
CREATE POLICY "Users can update own profile tabs"
  ON profile_tabs FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Users can delete their own profile tabs
CREATE POLICY "Users can delete own profile tabs"
  ON profile_tabs FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_tabs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_profile_tabs_updated_at_trigger
  BEFORE UPDATE ON profile_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_tabs_updated_at();

-- Function to ensure only one active tab per user
CREATE OR REPLACE FUNCTION ensure_single_active_tab()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE profile_tabs
    SET is_active = false
    WHERE owner_user_id = NEW.owner_user_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to enforce single active tab
CREATE TRIGGER ensure_single_active_tab_trigger
  BEFORE INSERT OR UPDATE ON profile_tabs
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_tab();