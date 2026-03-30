/*
  # Chores and Rewards System

  1. New Tables
    - `chores`
      - Task assignments for children with points values
      - Supports recurring patterns and approval workflows
      - Tracks completion and approval status
    
    - `rewards`
      - Catalog of rewards children can redeem
      - Supports both points and cash costs
      - Configurable approval thresholds
    
    - `reward_redemptions`
      - Tracks when children redeem rewards
      - Manages approval workflow and fulfillment
    
    - `allowance_schedules`
      - Automates regular allowance payments
      - Supports both points and cash modes
      - Configurable frequency and amounts
    
    - `child_transactions`
      - Extended transaction tracking for child activities
      - Links to chores, rewards, and allowances
      - Supports approval workflows for spending

  2. Security
    - Enable RLS on all tables
    - Parents control chore assignments and reward catalog
    - Children can view and complete based on permission level
    - Approval workflows enforce parent oversight
    
  3. Important Notes
    - Chores can be assigned by parent or created by child (Level 2+)
    - Rewards have tiered approval based on cost and child level
    - Allowances auto-deposit on schedule with notifications
    - All financial changes are tracked in child_transactions
*/

-- Chores table
CREATE TABLE IF NOT EXISTS chores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to_child_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  points_value integer NOT NULL DEFAULT 0 CHECK (points_value >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'approved', 'rejected')),
  due_date timestamptz,
  recurrence_pattern text CHECK (recurrence_pattern IN ('once', 'daily', 'weekly', 'biweekly', 'monthly')),
  is_recurring boolean NOT NULL DEFAULT false,
  next_recurrence_date timestamptz,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  approved_by_user_id uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  bonus_multiplier numeric(3,2) DEFAULT 1.0,
  streak_count integer DEFAULT 0,
  icon text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rewards catalog table
CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  points_cost integer DEFAULT 0 CHECK (points_cost >= 0),
  cash_cost numeric(10,2) DEFAULT 0 CHECK (cash_cost >= 0),
  category text,
  icon text,
  color text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  requires_approval_threshold integer DEFAULT 100,
  stock_quantity integer,
  times_redeemed integer DEFAULT 0,
  expires_at timestamptz,
  age_restriction integer,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (points_cost > 0 OR cash_cost > 0)
);

-- Reward redemptions table
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  points_spent integer DEFAULT 0 CHECK (points_spent >= 0),
  cash_spent numeric(10,2) DEFAULT 0 CHECK (cash_spent >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by_user_id uuid REFERENCES auth.users(id),
  fulfilled_at timestamptz,
  fulfilled_by_user_id uuid REFERENCES auth.users(id),
  rejection_reason text,
  notes text,
  metadata jsonb
);

-- Allowance schedules table
CREATE TABLE IF NOT EXISTS allowance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  mode text NOT NULL CHECK (mode IN ('points', 'cash', 'both')),
  points_amount integer DEFAULT 0 CHECK (points_amount >= 0),
  cash_amount numeric(10,2) DEFAULT 0 CHECK (cash_amount >= 0),
  is_active boolean NOT NULL DEFAULT true,
  next_payment_date date NOT NULL,
  last_payment_date date,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  auto_deposit boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Child transactions table (extends the concept for children)
CREATE TABLE IF NOT EXISTS child_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'allowance', 'chore_payment', 'reward_redemption', 'parent_gift', 
    'spending', 'savings_deposit', 'savings_withdrawal', 'bonus', 'penalty'
  )),
  amount numeric(10,2) NOT NULL,
  currency_type text NOT NULL CHECK (currency_type IN ('points', 'cash')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected', 'cancelled')),
  requires_approval boolean NOT NULL DEFAULT false,
  approved_by_user_id uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  related_chore_id uuid REFERENCES chores(id) ON DELETE SET NULL,
  related_reward_id uuid REFERENCES rewards(id) ON DELETE SET NULL,
  related_allowance_id uuid REFERENCES allowance_schedules(id) ON DELETE SET NULL,
  balance_after numeric(10,2),
  category text,
  notes text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chore templates for quick creation
CREATE TABLE IF NOT EXISTS chore_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  suggested_points integer DEFAULT 0,
  category text,
  icon text,
  color text,
  age_group text,
  is_public boolean DEFAULT false,
  created_by_user_id uuid REFERENCES auth.users(id),
  times_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chores_child ON chores(assigned_to_child_id);
CREATE INDEX IF NOT EXISTS idx_chores_profile ON chores(profile_id);
CREATE INDEX IF NOT EXISTS idx_chores_status ON chores(status);
CREATE INDEX IF NOT EXISTS idx_chores_due_date ON chores(due_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_chores_recurring ON chores(next_recurrence_date) WHERE is_recurring = true;

CREATE INDEX IF NOT EXISTS idx_rewards_profile ON rewards(profile_id);
CREATE INDEX IF NOT EXISTS idx_rewards_active ON rewards(is_active);
CREATE INDEX IF NOT EXISTS idx_rewards_category ON rewards(category);

CREATE INDEX IF NOT EXISTS idx_redemptions_child ON reward_redemptions(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_reward ON reward_redemptions(reward_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON reward_redemptions(status);

CREATE INDEX IF NOT EXISTS idx_allowances_child ON allowance_schedules(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_allowances_active ON allowance_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_allowances_next_payment ON allowance_schedules(next_payment_date) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_child_transactions_child ON child_transactions(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_child_transactions_type ON child_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_child_transactions_date ON child_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_chore_templates_profile ON chore_templates(profile_id);
CREATE INDEX IF NOT EXISTS idx_chore_templates_public ON chore_templates(is_public) WHERE is_public = true;

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_chores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chores_updated_at
  BEFORE UPDATE ON chores
  FOR EACH ROW
  EXECUTE FUNCTION update_chores_updated_at();

CREATE TRIGGER update_rewards_updated_at
  BEFORE UPDATE ON rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_chores_updated_at();

CREATE TRIGGER update_allowances_updated_at
  BEFORE UPDATE ON allowance_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_chores_updated_at();

-- Enable RLS
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chores
CREATE POLICY "Parents and children can view chores"
  ON chores FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
    OR assigned_to_child_id IN (
      SELECT id FROM child_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Parents can create chores"
  ON chores FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Parents and qualified children can update chores"
  ON chores FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR (
      assigned_to_child_id IN (
        SELECT id FROM child_profiles 
        WHERE user_id = auth.uid() AND current_permission_level >= 2
      )
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR (
      assigned_to_child_id IN (
        SELECT id FROM child_profiles 
        WHERE user_id = auth.uid() AND current_permission_level >= 2
      )
    )
  );

-- RLS Policies for rewards
CREATE POLICY "Members can view rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
    OR profile_id IN (
      SELECT parent_profile_id FROM child_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Parents can manage rewards"
  ON rewards FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Parents can update rewards"
  ON rewards FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for reward_redemptions
CREATE POLICY "Children and parents can view redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE user_id = auth.uid()
    )
    OR child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "Children can create redemption requests"
  ON reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Parents and children can update redemptions"
  ON reward_redemptions FOR UPDATE
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE user_id = auth.uid()
    )
    OR child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE user_id = auth.uid()
    )
    OR child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- RLS Policies for allowance_schedules
CREATE POLICY "Parents and children can view allowances"
  ON allowance_schedules FOR SELECT
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE user_id = auth.uid()
    )
    OR child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "Parents can manage allowances"
  ON allowance_schedules FOR INSERT
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

CREATE POLICY "Parents can update allowances"
  ON allowance_schedules FOR UPDATE
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- RLS Policies for child_transactions
CREATE POLICY "Children and parents can view child transactions"
  ON child_transactions FOR SELECT
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE user_id = auth.uid()
    )
    OR child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "System can create child transactions"
  ON child_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid()
      )
      OR user_id = auth.uid()
    )
  );

CREATE POLICY "Parents can update child transactions"
  ON child_transactions FOR UPDATE
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    child_profile_id IN (
      SELECT id FROM child_profiles 
      WHERE parent_profile_id IN (
        SELECT profile_id FROM profile_memberships 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- RLS Policies for chore_templates
CREATE POLICY "Everyone can view public templates"
  ON chore_templates FOR SELECT
  TO authenticated
  USING (
    is_public = true
    OR profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Parents can create templates"
  ON chore_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR profile_id IS NULL
  );
