/*
  # Create User Provisioning Functions

  ## Overview
  This migration creates functions to automatically provision user profiles when they don't exist.
  These functions ensure every authenticated user has a default profile created.

  ## New Functions

  ### 1. manual_provision_current_user()
  - Creates a profile for the currently authenticated user if one doesn't exist
  - Creates associated profile_membership record linking user to profile
  - Creates profile_tabs record for UI state management
  - Returns success status

  ### 2. verify_user_provisioning()
  - Checks if current user has proper provisioning (profile + membership + tab)
  - Returns verification status with details

  ## Security
  - Functions use SECURITY DEFINER to run with elevated privileges
  - Only authenticated users can call these functions
  - Functions validate user is authenticated before proceeding
*/

-- Function to manually provision a profile for current user
CREATE OR REPLACE FUNCTION manual_provision_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_display_name text;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if user already has a profile
  SELECT p.id INTO v_profile_id
  FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = v_user_id
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Profile already exists', 'profile_id', v_profile_id);
  END IF;

  -- Get user email for display name
  SELECT COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_display_name
  FROM auth.users
  WHERE id = v_user_id;

  -- Create profile
  INSERT INTO profiles (user_id, profile_type, display_name, is_deleted)
  VALUES (v_user_id, 'personal', COALESCE(v_display_name, 'My Profile'), false)
  RETURNING id INTO v_profile_id;

  -- Create profile membership
  INSERT INTO profile_memberships (user_id, profile_id, role)
  VALUES (v_user_id, v_profile_id, 'owner');

  -- Create profile tab
  INSERT INTO profile_tabs (owner_user_id, profile_id, display_name, is_active)
  VALUES (v_user_id, v_profile_id, COALESCE(v_display_name, 'My Profile'), true);

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Profile created successfully',
    'profile_id', v_profile_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to verify user provisioning
CREATE OR REPLACE FUNCTION verify_user_provisioning()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_has_profile boolean;
  v_has_membership boolean;
  v_has_tab boolean;
  v_profile_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check for profile
  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = v_user_id)
  INTO v_has_profile;

  -- Check for membership
  SELECT pm.profile_id INTO v_profile_id
  FROM profile_memberships pm
  WHERE pm.user_id = v_user_id
  LIMIT 1;
  
  v_has_membership := v_profile_id IS NOT NULL;

  -- Check for tab
  SELECT EXISTS(SELECT 1 FROM profile_tabs WHERE owner_user_id = v_user_id)
  INTO v_has_tab;

  RETURN jsonb_build_object(
    'success', true,
    'has_profile', v_has_profile,
    'has_membership', v_has_membership,
    'has_tab', v_has_tab,
    'profile_id', v_profile_id,
    'is_fully_provisioned', v_has_profile AND v_has_membership AND v_has_tab
  );
END;
$$;
