/*
  # Create Profile Invitations and Sharing System

  ## Overview
  This migration creates a complete system for managing child profile ownership, 
  adult sharing/collaboration, and child invitation/signup flows.

  ## New Tables

  ### 1. profile_invitations
  Tracks email invitations sent to children to claim their profiles.
  - `id` (uuid, primary key)
  - `child_profile_id` (uuid, references child_profiles) - Which profile is being claimed
  - `invited_email` (text) - Email address of the child being invited
  - `invitation_token` (text, unique) - Secure token for signup link
  - `invitation_expires_at` (timestamptz) - When invitation expires (7 days)
  - `invited_by_profile_id` (uuid, references profiles) - Which parent sent invite
  - `status` (text) - pending/accepted/expired/revoked
  - `created_at` (timestamptz)
  - `accepted_at` (timestamptz, nullable)

  ### 2. profile_shares
  Tracks which adult profiles have access to manage child profiles.
  - `id` (uuid, primary key)
  - `child_profile_id` (uuid, references child_profiles) - Profile being shared
  - `shared_with_profile_id` (uuid, references profiles) - Adult getting access
  - `permission_level` (text) - view_only/editor/co_parent
  - `granted_by_profile_id` (uuid, references profiles) - Who granted access
  - `is_active` (boolean) - Whether access is currently active
  - `created_at` (timestamptz)
  - `revoked_at` (timestamptz, nullable)

  ## Schema Changes

  ### child_profiles table
  - Add `owned_by_profile_id` column to track which parent profile created/owns it
  - Add constraint limiting maximum 4 adults (1 owner + 3 shares) per child

  ## Security
  - Enable RLS on all new tables
  - Policies ensure only owners and shared users can access child profiles
  - Invitation tokens are secured and validated
  - Maximum 4 adults per child profile enforced

  ## Important Notes
  - Parents can create and manage child profiles without child having an account
  - Children are invited via email to claim their profile later
  - Multiple adults can collaborate on managing a child's profile
  - Profile ownership is separate from user_id (which links to auth.users)
*/

-- Add owned_by_profile_id to child_profiles
ALTER TABLE child_profiles 
ADD COLUMN IF NOT EXISTS owned_by_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Create index for owned_by queries
CREATE INDEX IF NOT EXISTS idx_child_profiles_owned_by ON child_profiles(owned_by_profile_id);

-- Create profile_invitations table
CREATE TABLE IF NOT EXISTS profile_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invitation_token text UNIQUE NOT NULL,
  invitation_expires_at timestamptz NOT NULL,
  invited_by_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz DEFAULT now() NOT NULL,
  accepted_at timestamptz,
  CONSTRAINT one_active_invitation_per_profile UNIQUE (child_profile_id, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for profile_invitations
CREATE INDEX IF NOT EXISTS idx_invitations_child_profile ON profile_invitations(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON profile_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON profile_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON profile_invitations(invited_email);

-- Create profile_shares table
CREATE TABLE IF NOT EXISTS profile_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  shared_with_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_level text NOT NULL DEFAULT 'view_only' CHECK (permission_level IN ('view_only', 'editor', 'co_parent')),
  granted_by_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT unique_active_share UNIQUE (child_profile_id, shared_with_profile_id, is_active)
);

-- Create indexes for profile_shares
CREATE INDEX IF NOT EXISTS idx_shares_child_profile ON profile_shares(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_shares_shared_with ON profile_shares(shared_with_profile_id);
CREATE INDEX IF NOT EXISTS idx_shares_active ON profile_shares(is_active);

-- Enable RLS
ALTER TABLE profile_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profile_invitations

-- Profile owners and co-parents can view invitations for their child profiles
CREATE POLICY "Users can view invitations for profiles they own or co-parent"
  ON profile_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = profile_invitations.child_profile_id
      AND (
        cp.owned_by_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profile_shares ps
          WHERE ps.child_profile_id = cp.id
          AND ps.shared_with_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
          AND ps.permission_level IN ('co_parent', 'editor')
          AND ps.is_active = true
        )
      )
    )
  );

-- Profile owners and co-parents can create invitations
CREATE POLICY "Users can create invitations for profiles they own or co-parent"
  ON profile_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = profile_invitations.child_profile_id
      AND (
        cp.owned_by_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profile_shares ps
          WHERE ps.child_profile_id = cp.id
          AND ps.shared_with_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
          AND ps.permission_level = 'co_parent'
          AND ps.is_active = true
        )
      )
    )
  );

-- Profile owners and co-parents can update invitation status
CREATE POLICY "Users can update invitations for profiles they own or co-parent"
  ON profile_invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = profile_invitations.child_profile_id
      AND (
        cp.owned_by_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profile_shares ps
          WHERE ps.child_profile_id = cp.id
          AND ps.shared_with_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
          AND ps.permission_level = 'co_parent'
          AND ps.is_active = true
        )
      )
    )
  );

-- RLS Policies for profile_shares

-- Users can view shares for profiles they own or are shared with
CREATE POLICY "Users can view shares for their profiles"
  ON profile_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = profile_shares.child_profile_id
      AND (
        cp.owned_by_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR profile_shares.shared_with_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profile_shares ps
          WHERE ps.child_profile_id = cp.id
          AND ps.shared_with_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
          AND ps.permission_level = 'co_parent'
          AND ps.is_active = true
        )
      )
    )
  );

-- Only profile owners and co-parents can create shares
CREATE POLICY "Users can create shares for profiles they own or co-parent"
  ON profile_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = profile_shares.child_profile_id
      AND (
        cp.owned_by_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profile_shares ps
          WHERE ps.child_profile_id = cp.id
          AND ps.shared_with_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
          AND ps.permission_level = 'co_parent'
          AND ps.is_active = true
        )
      )
    )
    -- Validate maximum 4 adults per child
    AND (
      SELECT COUNT(*) FROM profile_shares ps
      WHERE ps.child_profile_id = profile_shares.child_profile_id
      AND ps.is_active = true
    ) < 3
  );

-- Only profile owners and co-parents can update shares (revoke)
CREATE POLICY "Users can update shares for profiles they own or co-parent"
  ON profile_shares FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = profile_shares.child_profile_id
      AND (
        cp.owned_by_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profile_shares ps
          WHERE ps.child_profile_id = cp.id
          AND ps.shared_with_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
          AND ps.permission_level = 'co_parent'
          AND ps.is_active = true
        )
      )
    )
  );

-- Function to check adult limit (1 owner + 3 shares max = 4 total)
CREATE OR REPLACE FUNCTION check_adult_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*) 
    FROM profile_shares 
    WHERE child_profile_id = NEW.child_profile_id 
    AND is_active = true
  ) >= 3 THEN
    RAISE EXCEPTION 'Maximum of 4 adults (1 owner + 3 shared) allowed per child profile';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to enforce adult limit
DROP TRIGGER IF EXISTS enforce_adult_limit ON profile_shares;
CREATE TRIGGER enforce_adult_limit
  BEFORE INSERT ON profile_shares
  FOR EACH ROW
  EXECUTE FUNCTION check_adult_limit();

-- Function to expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profile_invitations
  SET status = 'expired'
  WHERE status = 'pending'
  AND invitation_expires_at < now();
END;
$$;

-- Function to validate and accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(
  p_token text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation profile_invitations;
  v_child_profile child_profiles;
BEGIN
  -- Get invitation
  SELECT * INTO v_invitation
  FROM profile_invitations
  WHERE invitation_token = p_token
  AND status = 'pending';

  -- Validate invitation exists and not expired
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  IF v_invitation.invitation_expires_at < now() THEN
    UPDATE profile_invitations
    SET status = 'expired'
    WHERE id = v_invitation.id;
    
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  -- Get child profile
  SELECT * INTO v_child_profile
  FROM child_profiles
  WHERE id = v_invitation.child_profile_id;

  -- Check if profile already claimed
  IF v_child_profile.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile has already been claimed');
  END IF;

  -- Link user to child profile
  UPDATE child_profiles
  SET user_id = p_user_id
  WHERE id = v_invitation.child_profile_id;

  -- Mark invitation as accepted
  UPDATE profile_invitations
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true, 
    'child_profile_id', v_invitation.child_profile_id,
    'child_name', v_child_profile.child_name
  );
END;
$$;

-- Update child_profiles RLS to include shared profiles
DROP POLICY IF EXISTS "Users can view own child profiles" ON child_profiles;
CREATE POLICY "Users can view own child profiles"
  ON child_profiles FOR SELECT
  TO authenticated
  USING (
    parent_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR owned_by_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
    OR id IN (
      SELECT child_profile_id FROM profile_shares
      WHERE shared_with_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can update own child profiles" ON child_profiles;
CREATE POLICY "Users can update own child profiles"
  ON child_profiles FOR UPDATE
  TO authenticated
  USING (
    parent_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR owned_by_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
    OR id IN (
      SELECT child_profile_id FROM profile_shares
      WHERE shared_with_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND permission_level IN ('editor', 'co_parent')
      AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can insert own child profiles" ON child_profiles;
CREATE POLICY "Users can insert own child profiles"
  ON child_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR owned_by_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own child profiles" ON child_profiles;
CREATE POLICY "Users can delete own child profiles"
  ON child_profiles FOR DELETE
  TO authenticated
  USING (
    owned_by_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR id IN (
      SELECT child_profile_id FROM profile_shares
      WHERE shared_with_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND permission_level = 'co_parent'
      AND is_active = true
    )
  );
