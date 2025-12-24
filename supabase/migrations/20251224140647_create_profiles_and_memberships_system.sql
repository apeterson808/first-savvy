/*
  # Create Multi-Profile Foundation System

  ## Overview
  This migration establishes the foundation for a multi-profile system that supports
  personal, family, and business profiles. Initially, each user gets one personal profile,
  with future expansion to support multiple profiles per user.

  ## Key Design Decisions
  1. **Data Safety First**: All foreign keys use ON DELETE RESTRICT to prevent accidental data loss
  2. **Soft Deletes**: profiles.is_deleted allows safe profile deactivation without losing history
  3. **Profile Access**: Centralized has_profile_access() function for consistent security checks
  4. **Auto-Provisioning**: Trigger creates default profile on user signup, with RPC fallback

  ## New Tables

  ### profiles
  Represents a profile (personal, family, or business) that owns financial data.
  - `id` (uuid, primary key)
  - `user_id` (uuid, reference to auth.users) - Owner of the profile
  - `profile_type` (text) - 'personal', 'family', or 'business'
  - `display_name` (text) - User-friendly name
  - `is_deleted` (boolean) - Soft delete flag
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### profile_memberships
  Tracks which users have access to which profiles and their roles.
  - `id` (uuid, primary key)
  - `profile_id` (uuid, reference to profiles) - ON DELETE RESTRICT
  - `user_id` (uuid, reference to auth.users)
  - `role` (text) - 'owner', 'admin', 'member', 'viewer'
  - `created_at` (timestamptz)

  ## Security Functions

  ### has_profile_access(profile_id)
  Checks if the currently authenticated user has access to a profile.
  Uses auth.uid() internally for safety and simplicity.

  ## Auto-Provisioning

  ### handle_new_user_profile() trigger
  Automatically creates a personal profile and membership when a user signs up.

  ### ensure_default_profile() RPC
  Idempotent function to ensure a user has at least one profile.
  Can be called defensively on first access as backup to trigger.

  ## RLS Policies
  - Users can view profiles they have membership to
  - Only profile owners can update/delete their profiles
  - Users can view their own memberships
  - Only profile owners can manage memberships
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  profile_type text NOT NULL CHECK (profile_type IN ('personal', 'family', 'business')),
  display_name text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create profile_memberships table
CREATE TABLE IF NOT EXISTS profile_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_profiles_type ON profiles(profile_type) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_profile_memberships_profile_id ON profile_memberships(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_memberships_user_id ON profile_memberships(user_id);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_memberships ENABLE ROW LEVEL SECURITY;

-- Create helper function for profile access checking
CREATE OR REPLACE FUNCTION has_profile_access(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check if current user has membership to this profile
  RETURN EXISTS (
    SELECT 1 
    FROM profile_memberships 
    WHERE profile_id = p_profile_id 
      AND user_id = auth.uid()
  );
END;
$$;

-- RLS Policies for profiles

CREATE POLICY "Users can view profiles they have access to"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (has_profile_access(id) AND NOT is_deleted);

CREATE POLICY "Profile owners can update their profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Profile owners can soft-delete their profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for profile_memberships

CREATE POLICY "Users can view memberships for profiles they access"
  ON profile_memberships
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Profile owners can insert memberships"
  ON profile_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = profile_id 
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Profile owners can update memberships"
  ON profile_memberships
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = profile_id 
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = profile_id 
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Profile owners can delete memberships"
  ON profile_memberships
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = profile_id 
        AND user_id = auth.uid()
    )
  );

-- Auto-provisioning trigger function
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile_id uuid;
BEGIN
  -- Create a personal profile for the new user
  INSERT INTO profiles (user_id, profile_type, display_name)
  VALUES (NEW.id, 'personal', 'Personal')
  RETURNING id INTO new_profile_id;

  -- Create owner membership
  INSERT INTO profile_memberships (profile_id, user_id, role)
  VALUES (new_profile_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- Idempotent RPC for ensuring default profile exists
CREATE OR REPLACE FUNCTION ensure_default_profile()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a profile
  SELECT p.id INTO v_profile_id
  FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = v_user_id
    AND p.is_deleted = false
  LIMIT 1;

  -- If no profile exists, create one
  IF v_profile_id IS NULL THEN
    INSERT INTO profiles (user_id, profile_type, display_name)
    VALUES (v_user_id, 'personal', 'Personal')
    RETURNING id INTO v_profile_id;

    INSERT INTO profile_memberships (profile_id, user_id, role)
    VALUES (v_profile_id, v_user_id, 'owner');
  END IF;

  RETURN v_profile_id;
END;
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
