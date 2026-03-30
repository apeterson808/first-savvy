/*
  # Child Permission System - Core Schema

  1. New Tables
    - `child_profiles`
      - Links children to parent profiles with permission levels 1-5
      - Tracks points and cash balances for reward systems
      - Stores current permission level and child details
    
    - `permission_levels` (reference table)
      - Defines 5 fixed permission levels from Supervised to Full Control
      - Contains level descriptions and minimum requirements
    
    - `permission_level_features`
      - Maps each level to specific unlocked capabilities
      - Controls what actions children can take at each level
    
    - `level_transition_history`
      - Immutable audit log of all level changes
      - Records who made changes and why
    
    - `parent_access_grants` (for Level 5)
      - Manages what access children grant back to parents
      - Enables ownership inversion at highest level
    
    - `child_achievements`
      - Tracks milestones and badges earned
      - Supports gamification and progress visualization

  2. Security
    - Enable RLS on all tables
    - Parents can manage their children's data
    - Children can view their own data (read-only below Level 4)
    - Level 5 children have full control and grant parent access
    
  3. Important Notes
    - Permission levels are fixed: 1=Supervised, 2=Monitored, 3=Semi-Independent, 4=Independent, 5=Full Control
    - Level 5 inverts ownership - child becomes owner and grants access to parent
    - Supports multiple parents per child for separated family scenarios
*/

-- Child profiles table
CREATE TABLE IF NOT EXISTS child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  child_name text NOT NULL,
  date_of_birth date,
  avatar_url text,
  current_permission_level integer NOT NULL DEFAULT 1 CHECK (current_permission_level BETWEEN 1 AND 5),
  points_balance integer NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  cash_balance numeric(10,2) NOT NULL DEFAULT 0 CHECK (cash_balance >= 0),
  daily_spending_limit numeric(10,2),
  weekly_spending_limit numeric(10,2),
  monthly_spending_limit numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Permission levels reference table
CREATE TABLE IF NOT EXISTS permission_levels (
  level_number integer PRIMARY KEY CHECK (level_number BETWEEN 1 AND 5),
  level_name text NOT NULL,
  level_description text NOT NULL,
  min_age_recommendation integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert fixed permission levels
INSERT INTO permission_levels (level_number, level_name, level_description, min_age_recommendation) VALUES
  (1, 'Supervised', 'Can view assigned chores and mark complete. Parent must approve all actions. View-only access to points balance.', 5),
  (2, 'Monitored', 'Can suggest chores, redeem small rewards independently. Parent receives daily summaries. No cash access.', 8),
  (3, 'Semi-Independent', 'Can create goals, access cash with limits, create basic budgets. Parent gets weekly summaries.', 12),
  (4, 'Independent', 'Full self-management of chores and budgets. Unrestricted cash access. Parent has view-only by default.', 15),
  (5, 'Full Control', 'Complete ownership. Child controls all aspects and explicitly grants parent access. Parent is viewer only.', 18)
ON CONFLICT (level_number) DO NOTHING;

-- Permission level features mapping
CREATE TABLE IF NOT EXISTS permission_level_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number integer NOT NULL REFERENCES permission_levels(level_number) ON DELETE CASCADE,
  feature_key text NOT NULL,
  feature_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT false,
  approval_threshold numeric(10,2),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(level_number, feature_key)
);

-- Insert feature mappings for each level
INSERT INTO permission_level_features (level_number, feature_key, feature_name, is_enabled, requires_approval, approval_threshold, description) VALUES
  -- Level 1 features
  (1, 'view_chores', 'View Assigned Chores', true, false, NULL, 'Can see chores assigned by parents'),
  (1, 'complete_chores', 'Mark Chores Complete', true, true, NULL, 'Can mark chores as done but needs parent approval'),
  (1, 'view_points', 'View Points Balance', true, false, NULL, 'Can see current points balance'),
  (1, 'view_rewards', 'View Reward Catalog', true, false, NULL, 'Can browse available rewards'),
  
  -- Level 2 features (includes all Level 1)
  (2, 'view_chores', 'View Assigned Chores', true, false, NULL, 'Can see chores assigned by parents'),
  (2, 'complete_chores', 'Mark Chores Complete', true, true, NULL, 'Can mark chores as done but needs parent approval'),
  (2, 'suggest_chores', 'Suggest New Chores', true, true, NULL, 'Can propose new chores for parent approval'),
  (2, 'view_points', 'View Points Balance', true, false, NULL, 'Can see current points balance'),
  (2, 'view_rewards', 'View Reward Catalog', true, false, NULL, 'Can browse available rewards'),
  (2, 'redeem_rewards_small', 'Redeem Small Rewards', true, false, 100, 'Auto-approve rewards under 100 points'),
  (2, 'redeem_rewards_large', 'Redeem Large Rewards', true, true, 100, 'Rewards over 100 points need approval'),
  (2, 'view_transaction_history', 'View Transaction History', true, false, NULL, 'Can see past transactions'),
  
  -- Level 3 features (includes Level 2 + new features)
  (3, 'view_chores', 'View Assigned Chores', true, false, NULL, 'Can see chores assigned by parents'),
  (3, 'complete_chores', 'Mark Chores Complete', true, false, NULL, 'Can complete chores without approval'),
  (3, 'suggest_chores', 'Suggest New Chores', true, true, NULL, 'Can propose new chores for parent approval'),
  (3, 'create_chores', 'Create Own Chores', true, false, NULL, 'Can create and manage own chore goals'),
  (3, 'view_points', 'View Points Balance', true, false, NULL, 'Can see current points balance'),
  (3, 'view_rewards', 'View Reward Catalog', true, false, NULL, 'Can browse available rewards'),
  (3, 'redeem_rewards_small', 'Redeem Small Rewards', true, false, 100, 'Auto-approve rewards under 100 points'),
  (3, 'redeem_rewards_large', 'Redeem Large Rewards', true, false, 500, 'Notify parent for rewards 100-500 points'),
  (3, 'redeem_rewards_xlarge', 'Redeem Premium Rewards', true, true, 500, 'Rewards over 500 points need approval'),
  (3, 'view_transaction_history', 'View Transaction History', true, false, NULL, 'Can see past transactions'),
  (3, 'access_cash_balance', 'Access Cash Mode', true, false, NULL, 'Can view and use cash with limits'),
  (3, 'create_savings_goals', 'Create Savings Goals', true, false, NULL, 'Can set and track savings goals'),
  (3, 'create_budgets', 'Create Basic Budgets', true, false, NULL, 'Can create budgets with parent review'),
  
  -- Level 4 features (full independence)
  (4, 'view_chores', 'View All Chores', true, false, NULL, 'Can see all chores'),
  (4, 'complete_chores', 'Complete Chores', true, false, NULL, 'Full chore completion freedom'),
  (4, 'create_chores', 'Create Chores', true, false, NULL, 'Can create any chores'),
  (4, 'manage_chores', 'Manage All Chores', true, false, NULL, 'Full chore management'),
  (4, 'view_points', 'View Points Balance', true, false, NULL, 'Can see current points balance'),
  (4, 'view_rewards', 'View Reward Catalog', true, false, NULL, 'Can browse available rewards'),
  (4, 'redeem_any_reward', 'Redeem Any Reward', true, false, NULL, 'Can redeem any reward independently'),
  (4, 'view_transaction_history', 'View Transaction History', true, false, NULL, 'Can see past transactions'),
  (4, 'access_cash_unlimited', 'Unrestricted Cash Access', true, false, NULL, 'No spending limits'),
  (4, 'create_budgets_full', 'Full Budget Management', true, false, NULL, 'Complete budget control'),
  (4, 'link_external_accounts', 'Link Bank Accounts', true, true, NULL, 'Can link external accounts with parent as co-signer'),
  (4, 'manage_contacts', 'Manage Contacts', true, false, NULL, 'Can add friends and contacts'),
  
  -- Level 5 features (ownership)
  (5, 'full_ownership', 'Complete Profile Ownership', true, false, NULL, 'Full control of entire profile'),
  (5, 'manage_parent_access', 'Manage Parent Access', true, false, NULL, 'Controls what parents can see'),
  (5, 'all_features_unlimited', 'All Features Unlimited', true, false, NULL, 'Access to every feature without restrictions')
ON CONFLICT (level_number, feature_key) DO NOTHING;

-- Level transition history (immutable audit log)
CREATE TABLE IF NOT EXISTS level_transition_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  from_level integer NOT NULL CHECK (from_level BETWEEN 1 AND 5),
  to_level integer NOT NULL CHECK (to_level BETWEEN 1 AND 5),
  changed_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  reason_note text,
  is_trial_period boolean NOT NULL DEFAULT false,
  trial_end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Parent access grants (for Level 5 children)
CREATE TABLE IF NOT EXISTS parent_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  parent_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_view_transactions boolean NOT NULL DEFAULT false,
  can_view_balances boolean NOT NULL DEFAULT false,
  can_view_budgets boolean NOT NULL DEFAULT false,
  can_view_goals boolean NOT NULL DEFAULT false,
  can_comment boolean NOT NULL DEFAULT false,
  can_suggest boolean NOT NULL DEFAULT false,
  full_collaboration boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  UNIQUE(child_profile_id, parent_profile_id)
);

-- Child achievements and badges
CREATE TABLE IF NOT EXISTS child_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,
  achievement_name text NOT NULL,
  achievement_description text,
  icon text,
  color text,
  points_awarded integer DEFAULT 0,
  earned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_child_profiles_parent ON child_profiles(parent_profile_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_user ON child_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_level ON child_profiles(current_permission_level);
CREATE INDEX IF NOT EXISTS idx_level_transitions_child ON level_transition_history(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_parent_access_child ON parent_access_grants(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_parent_access_parent ON parent_access_grants(parent_profile_id);
CREATE INDEX IF NOT EXISTS idx_achievements_child ON child_achievements(child_profile_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_child_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_child_profiles_updated_at
  BEFORE UPDATE ON child_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_child_profile_updated_at();

-- Enable RLS
ALTER TABLE child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_level_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_transition_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for child_profiles
CREATE POLICY "Parents can view their children"
  ON child_profiles FOR SELECT
  TO authenticated
  USING (
    parent_profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Parents can create children"
  ON child_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Parents can update their children"
  ON child_profiles FOR UPDATE
  TO authenticated
  USING (
    parent_profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR (user_id = auth.uid() AND current_permission_level >= 4)
  )
  WITH CHECK (
    parent_profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR (user_id = auth.uid() AND current_permission_level >= 4)
  );

CREATE POLICY "Parents can delete their children"
  ON child_profiles FOR DELETE
  TO authenticated
  USING (
    parent_profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for permission_levels (read-only reference data)
CREATE POLICY "Anyone can view permission levels"
  ON permission_levels FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for permission_level_features (read-only reference data)
CREATE POLICY "Anyone can view permission features"
  ON permission_level_features FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for level_transition_history
CREATE POLICY "Users can view transitions for their children"
  ON level_transition_history FOR SELECT
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
      OR user_id = auth.uid()
    )
  );

CREATE POLICY "Parents can create transitions"
  ON level_transition_history FOR INSERT
  TO authenticated
  WITH CHECK (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
    AND changed_by_user_id = auth.uid()
  );

-- RLS Policies for parent_access_grants
CREATE POLICY "Children and parents can view grants"
  ON parent_access_grants FOR SELECT
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE user_id = auth.uid()
    )
    OR parent_profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Level 5 children can manage parent access"
  ON parent_access_grants FOR INSERT
  TO authenticated
  WITH CHECK (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE user_id = auth.uid() AND current_permission_level = 5
    )
  );

CREATE POLICY "Level 5 children can update parent access"
  ON parent_access_grants FOR UPDATE
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE user_id = auth.uid() AND current_permission_level = 5
    )
  )
  WITH CHECK (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE user_id = auth.uid() AND current_permission_level = 5
    )
  );

-- RLS Policies for child_achievements
CREATE POLICY "Users can view achievements for their children"
  ON child_achievements FOR SELECT
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
      OR user_id = auth.uid()
    )
  );

CREATE POLICY "System can create achievements"
  ON child_achievements FOR INSERT
  TO authenticated
  WITH CHECK (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );
