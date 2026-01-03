/*
  # External Integrations and User Collaboration Schema

  ## Overview
  This migration creates the complete database schema for external service integrations 
  (Amazon, Netflix, etc.) and user collaboration features (family sharing, households, 
  invitations, and granular permission controls).

  ## 1. New Tables

  ### service_connections
  Stores third-party service integration credentials and status
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users) - Owner of the connection
  - `service_name` (text) - Service identifier (amazon, netflix, spotify, etc.)
  - `connection_type` (text) - Type of auth (oauth, api_key, credentials)
  - `connection_status` (text) - Current status (active, expired, error, disconnected)
  - `access_token` (text) - OAuth access token (encrypted)
  - `refresh_token` (text) - OAuth refresh token (encrypted)
  - `token_expiry` (timestamptz) - When the access token expires
  - `encrypted_credentials` (jsonb) - Encrypted credentials for non-OAuth services
  - `metadata` (jsonb) - Service-specific data (account_id, subscription_tier, etc.)
  - `last_sync_at` (timestamptz) - Last successful data sync
  - `is_active` (boolean) - Whether connection is currently active
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### user_relationships
  Manages connections between users (spouse, partner, family, roommate, friend)
  - `id` (uuid, primary key)
  - `user_id` (uuid) - User who initiated the relationship
  - `related_user_id` (uuid) - User who received the relationship request
  - `relationship_type` (text) - Type of relationship (spouse, partner, family, roommate, friend)
  - `status` (text) - Current status (pending, accepted, declined, blocked)
  - `permissions` (jsonb) - What data is shared (view_transactions, view_budgets, etc.)
  - `created_by` (uuid) - Who created this relationship
  - `accepted_at` (timestamptz) - When the relationship was accepted
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### shared_resources
  Provides granular control over what specific items are shared between users
  - `id` (uuid, primary key)
  - `owner_user_id` (uuid) - Owner of the resource
  - `shared_with_user_id` (uuid) - User the resource is shared with
  - `resource_type` (text) - Type of resource (account, category, budget, contact, transaction)
  - `resource_id` (uuid) - ID of the specific item being shared
  - `permission_level` (text) - Level of access (view, edit, manage)
  - `created_at` (timestamptz)

  ### household_groups
  Represents multi-user households (families, roommates, couples)
  - `id` (uuid, primary key)
  - `name` (text) - Household name
  - `created_by_user_id` (uuid) - User who created the household
  - `group_type` (text) - Type of household (family, roommates, couple)
  - `settings` (jsonb) - Household preferences and configurations
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### household_members
  Links users to household groups with specific roles
  - `id` (uuid, primary key)
  - `household_id` (uuid, references household_groups)
  - `user_id` (uuid) - Member user
  - `role` (text) - Member role (admin, member, viewer)
  - `joined_at` (timestamptz)

  ### invitations
  Manages invitations sent to non-users or existing users
  - `id` (uuid, primary key)
  - `inviter_user_id` (uuid) - User sending the invitation
  - `invitee_email` (text) - Email address of invitee
  - `invitee_phone` (text, optional) - Phone number of invitee
  - `invitation_type` (text) - Type (user_connection, household_member, shared_resource)
  - `relationship_metadata` (jsonb) - Intended relationship and permissions
  - `status` (text) - Current status (pending, accepted, expired, cancelled)
  - `token` (uuid) - Secure token for invite links
  - `expires_at` (timestamptz) - When invitation expires (default 7 days)
  - `accepted_at` (timestamptz) - When invitation was accepted
  - `accepted_by_user_id` (uuid) - User who accepted the invite
  - `created_at` (timestamptz)

  ## 2. Security
  All tables have RLS enabled with appropriate policies:
  - service_connections: Users can only manage their own connections
  - user_relationships: Both users in relationship can view it
  - shared_resources: Owner and shared user can view, only owner can manage
  - household_groups: Members can view, creator/admins can manage
  - household_members: Members can view their household
  - invitations: Inviter can view/manage their sent invitations

  Note: For demo purposes, policies use COALESCE(auth.uid(), user_id) pattern to allow 
  anonymous access while still enforcing proper security when auth is enabled.

  ## 3. Indexes
  Added indexes for common query patterns on all tables for optimal performance.
*/

-- =====================================================
-- STEP 1: CREATE ALL TABLES
-- =====================================================

-- Service Connections Table
CREATE TABLE IF NOT EXISTS service_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_name text NOT NULL,
  connection_type text NOT NULL DEFAULT 'oauth',
  connection_status text NOT NULL DEFAULT 'active',
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  encrypted_credentials jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT service_connections_connection_type_check 
    CHECK (connection_type IN ('oauth', 'api_key', 'credentials')),
  CONSTRAINT service_connections_connection_status_check 
    CHECK (connection_status IN ('active', 'expired', 'error', 'disconnected'))
);

-- User Relationships Table
CREATE TABLE IF NOT EXISTS user_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  related_user_id uuid NOT NULL,
  relationship_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  permissions jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT user_relationships_different_users_check 
    CHECK (user_id != related_user_id),
  CONSTRAINT user_relationships_relationship_type_check 
    CHECK (relationship_type IN ('spouse', 'partner', 'family', 'roommate', 'friend')),
  CONSTRAINT user_relationships_status_check 
    CHECK (status IN ('pending', 'accepted', 'declined', 'blocked'))
);

-- Shared Resources Table
CREATE TABLE IF NOT EXISTS shared_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  shared_with_user_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  permission_level text NOT NULL DEFAULT 'view',
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT shared_resources_resource_type_check 
    CHECK (resource_type IN ('account', 'category', 'budget', 'contact', 'transaction')),
  CONSTRAINT shared_resources_permission_level_check 
    CHECK (permission_level IN ('view', 'edit', 'manage'))
);

-- Household Groups Table
CREATE TABLE IF NOT EXISTS household_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by_user_id uuid NOT NULL,
  group_type text NOT NULL DEFAULT 'family',
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT household_groups_group_type_check 
    CHECK (group_type IN ('family', 'roommates', 'couple'))
);

-- Household Members Table
CREATE TABLE IF NOT EXISTS household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES household_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  
  CONSTRAINT household_members_role_check 
    CHECK (role IN ('admin', 'member', 'viewer')),
  CONSTRAINT household_members_unique_member 
    UNIQUE (household_id, user_id)
);

-- Invitations Table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL,
  invitee_email text NOT NULL,
  invitee_phone text,
  invitation_type text NOT NULL,
  relationship_metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by_user_id uuid,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT invitations_invitation_type_check 
    CHECK (invitation_type IN ('user_connection', 'household_member', 'shared_resource')),
  CONSTRAINT invitations_status_check 
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- =====================================================
-- STEP 2: CREATE INDEXES
-- =====================================================

-- Service Connections Indexes
CREATE INDEX IF NOT EXISTS idx_service_connections_user_id 
  ON service_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_service_connections_service_name 
  ON service_connections(service_name);
CREATE INDEX IF NOT EXISTS idx_service_connections_status 
  ON service_connections(connection_status) WHERE is_active = true;

-- User Relationships Indexes
CREATE INDEX IF NOT EXISTS idx_user_relationships_user_id 
  ON user_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_relationships_related_user_id 
  ON user_relationships(related_user_id);
CREATE INDEX IF NOT EXISTS idx_user_relationships_status 
  ON user_relationships(status);

-- Shared Resources Indexes
CREATE INDEX IF NOT EXISTS idx_shared_resources_owner 
  ON shared_resources(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_resources_shared_with 
  ON shared_resources(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_resources_resource 
  ON shared_resources(resource_type, resource_id);

-- Household Groups Indexes
CREATE INDEX IF NOT EXISTS idx_household_groups_created_by 
  ON household_groups(created_by_user_id);

-- Household Members Indexes
CREATE INDEX IF NOT EXISTS idx_household_members_household_id 
  ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user_id 
  ON household_members(user_id);

-- Invitations Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token 
  ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_inviter 
  ON invitations(inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_email 
  ON invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invitations_status 
  ON invitations(status) WHERE status = 'pending';

-- =====================================================
-- STEP 3: ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE service_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: CREATE RLS POLICIES
-- =====================================================

-- Service Connections Policies
CREATE POLICY "Users can view own service connections"
  ON service_connections FOR SELECT
  USING (user_id = COALESCE(auth.uid(), user_id));

CREATE POLICY "Users can insert own service connections"
  ON service_connections FOR INSERT
  WITH CHECK (user_id = COALESCE(auth.uid(), user_id));

CREATE POLICY "Users can update own service connections"
  ON service_connections FOR UPDATE
  USING (user_id = COALESCE(auth.uid(), user_id))
  WITH CHECK (user_id = COALESCE(auth.uid(), user_id));

CREATE POLICY "Users can delete own service connections"
  ON service_connections FOR DELETE
  USING (user_id = COALESCE(auth.uid(), user_id));

-- User Relationships Policies
CREATE POLICY "Users can view relationships they are part of"
  ON user_relationships FOR SELECT
  USING (
    user_id = COALESCE(auth.uid(), user_id) OR 
    related_user_id = COALESCE(auth.uid(), related_user_id)
  );

CREATE POLICY "Users can create relationships"
  ON user_relationships FOR INSERT
  WITH CHECK (
    user_id = COALESCE(auth.uid(), user_id) OR 
    related_user_id = COALESCE(auth.uid(), related_user_id)
  );

CREATE POLICY "Users can update their relationships"
  ON user_relationships FOR UPDATE
  USING (
    user_id = COALESCE(auth.uid(), user_id) OR 
    related_user_id = COALESCE(auth.uid(), related_user_id)
  )
  WITH CHECK (
    user_id = COALESCE(auth.uid(), user_id) OR 
    related_user_id = COALESCE(auth.uid(), related_user_id)
  );

CREATE POLICY "Users can delete their relationships"
  ON user_relationships FOR DELETE
  USING (
    user_id = COALESCE(auth.uid(), user_id) OR 
    related_user_id = COALESCE(auth.uid(), related_user_id)
  );

-- Shared Resources Policies
CREATE POLICY "Owners and shared users can view shared resources"
  ON shared_resources FOR SELECT
  USING (
    owner_user_id = COALESCE(auth.uid(), owner_user_id) OR 
    shared_with_user_id = COALESCE(auth.uid(), shared_with_user_id)
  );

CREATE POLICY "Owners can create shared resources"
  ON shared_resources FOR INSERT
  WITH CHECK (owner_user_id = COALESCE(auth.uid(), owner_user_id));

CREATE POLICY "Owners can update shared resources"
  ON shared_resources FOR UPDATE
  USING (owner_user_id = COALESCE(auth.uid(), owner_user_id))
  WITH CHECK (owner_user_id = COALESCE(auth.uid(), owner_user_id));

CREATE POLICY "Owners can delete shared resources"
  ON shared_resources FOR DELETE
  USING (owner_user_id = COALESCE(auth.uid(), owner_user_id));

-- Household Groups Policies
CREATE POLICY "Household members can view their household"
  ON household_groups FOR SELECT
  USING (
    created_by_user_id = COALESCE(auth.uid(), created_by_user_id) OR
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = household_groups.id
      AND household_members.user_id = COALESCE(auth.uid(), household_members.user_id)
    )
  );

CREATE POLICY "Users can create household groups"
  ON household_groups FOR INSERT
  WITH CHECK (created_by_user_id = COALESCE(auth.uid(), created_by_user_id));

CREATE POLICY "Admins can update household groups"
  ON household_groups FOR UPDATE
  USING (
    created_by_user_id = COALESCE(auth.uid(), created_by_user_id) OR
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = household_groups.id
      AND household_members.user_id = COALESCE(auth.uid(), household_members.user_id)
      AND household_members.role = 'admin'
    )
  )
  WITH CHECK (
    created_by_user_id = COALESCE(auth.uid(), created_by_user_id) OR
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = household_groups.id
      AND household_members.user_id = COALESCE(auth.uid(), household_members.user_id)
      AND household_members.role = 'admin'
    )
  );

CREATE POLICY "Creators can delete household groups"
  ON household_groups FOR DELETE
  USING (created_by_user_id = COALESCE(auth.uid(), created_by_user_id));

-- Household Members Policies
CREATE POLICY "Household members can view members"
  ON household_members FOR SELECT
  USING (
    user_id = COALESCE(auth.uid(), user_id) OR
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
      AND hm.user_id = COALESCE(auth.uid(), hm.user_id)
    )
  );

CREATE POLICY "Admins can add household members"
  ON household_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM household_groups
      WHERE household_groups.id = household_members.household_id
      AND household_groups.created_by_user_id = COALESCE(auth.uid(), household_groups.created_by_user_id)
    ) OR
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
      AND hm.user_id = COALESCE(auth.uid(), hm.user_id)
      AND hm.role = 'admin'
    )
  );

CREATE POLICY "Admins can update household members"
  ON household_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM household_groups
      WHERE household_groups.id = household_members.household_id
      AND household_groups.created_by_user_id = COALESCE(auth.uid(), household_groups.created_by_user_id)
    ) OR
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
      AND hm.user_id = COALESCE(auth.uid(), hm.user_id)
      AND hm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM household_groups
      WHERE household_groups.id = household_members.household_id
      AND household_groups.created_by_user_id = COALESCE(auth.uid(), household_groups.created_by_user_id)
    ) OR
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
      AND hm.user_id = COALESCE(auth.uid(), hm.user_id)
      AND hm.role = 'admin'
    )
  );

CREATE POLICY "Admins and members can remove themselves"
  ON household_members FOR DELETE
  USING (
    user_id = COALESCE(auth.uid(), user_id) OR
    EXISTS (
      SELECT 1 FROM household_groups
      WHERE household_groups.id = household_members.household_id
      AND household_groups.created_by_user_id = COALESCE(auth.uid(), household_groups.created_by_user_id)
    ) OR
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
      AND hm.user_id = COALESCE(auth.uid(), hm.user_id)
      AND hm.role = 'admin'
    )
  );

-- Invitations Policies
CREATE POLICY "Inviters can view their sent invitations"
  ON invitations FOR SELECT
  USING (inviter_user_id = COALESCE(auth.uid(), inviter_user_id));

CREATE POLICY "Users can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (inviter_user_id = COALESCE(auth.uid(), inviter_user_id));

CREATE POLICY "Inviters can update their invitations"
  ON invitations FOR UPDATE
  USING (inviter_user_id = COALESCE(auth.uid(), inviter_user_id))
  WITH CHECK (inviter_user_id = COALESCE(auth.uid(), inviter_user_id));

CREATE POLICY "Inviters can delete their invitations"
  ON invitations FOR DELETE
  USING (inviter_user_id = COALESCE(auth.uid(), inviter_user_id));

-- =====================================================
-- STEP 5: CREATE FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
DROP TRIGGER IF EXISTS update_service_connections_updated_at ON service_connections;
CREATE TRIGGER update_service_connections_updated_at
  BEFORE UPDATE ON service_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_relationships_updated_at ON user_relationships;
CREATE TRIGGER update_user_relationships_updated_at
  BEFORE UPDATE ON user_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_household_groups_updated_at ON household_groups;
CREATE TRIGGER update_household_groups_updated_at
  BEFORE UPDATE ON household_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();