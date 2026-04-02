/*
  # Add Star System and Task Completion Workflow

  ## Changes
  1. New Tables
    - `task_completions` - tracks when children complete tasks and approval workflow
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `child_profile_id` (uuid, references child_profiles)
      - `status` (text: pending/approved/rejected)
      - `stars_earned` (integer) - snapshot of stars at submission time
      - `submission_notes` (text, nullable) - optional notes from child
      - `review_notes` (text, nullable) - optional feedback from parent
      - `submitted_at` (timestamptz)
      - `reviewed_at` (timestamptz, nullable)
      - `reviewed_by` (uuid, nullable, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Updated Tables
    - `child_profiles`
      - Add `stars_balance` (integer, default 0) - approved stars available to spend
      - Add `stars_pending` (integer, default 0) - stars awaiting parent approval
      
    - `tasks`
      - Add `star_reward` (integer, default 1) - stars earned for completion
      - Add `requires_approval` (boolean, default true) - whether parent must approve
      - Add `frequency` (text: daily/weekly/one_time, default 'one_time')
      - Add `repeatable` (boolean, default false) - can be completed multiple times
      
    - `rewards`
      - Add `star_cost` (integer, default 10) - stars needed to redeem
      - Add `assigned_to_child_id` (uuid, references child_profiles) - which child can redeem
      - Add `status` (text: available/redeemed) - redemption status
      - Add `redeemed_at` (timestamptz, nullable)
      - Add `redeemed_by_child_id` (uuid, nullable, references child_profiles)

  3. Security
    - Enable RLS on `task_completions` table
    - Children can insert and view their own completions
    - Parents can view and update completions for their children
    - Only parents can approve/reject completions

  4. Indexes
    - Index on task_completions(child_profile_id, status)
    - Index on task_completions(task_id)
    - Index on tasks(assigned_to_child_id, frequency)
*/

-- Add star balance fields to child_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'child_profiles' AND column_name = 'stars_balance'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN stars_balance integer DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'child_profiles' AND column_name = 'stars_pending'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN stars_pending integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add star reward and workflow fields to tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'star_reward'
  ) THEN
    ALTER TABLE tasks ADD COLUMN star_reward integer DEFAULT 1 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'requires_approval'
  ) THEN
    ALTER TABLE tasks ADD COLUMN requires_approval boolean DEFAULT true NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'frequency'
  ) THEN
    ALTER TABLE tasks ADD COLUMN frequency text DEFAULT 'one_time' NOT NULL 
      CHECK (frequency IN ('daily', 'weekly', 'one_time'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'repeatable'
  ) THEN
    ALTER TABLE tasks ADD COLUMN repeatable boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add star cost and redemption fields to rewards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' AND column_name = 'star_cost'
  ) THEN
    ALTER TABLE rewards ADD COLUMN star_cost integer DEFAULT 10 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' AND column_name = 'assigned_to_child_id'
  ) THEN
    ALTER TABLE rewards ADD COLUMN assigned_to_child_id uuid REFERENCES child_profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' AND column_name = 'status'
  ) THEN
    ALTER TABLE rewards ADD COLUMN status text DEFAULT 'available' NOT NULL 
      CHECK (status IN ('available', 'redeemed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' AND column_name = 'redeemed_at'
  ) THEN
    ALTER TABLE rewards ADD COLUMN redeemed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rewards' AND column_name = 'redeemed_by_child_id'
  ) THEN
    ALTER TABLE rewards ADD COLUMN redeemed_by_child_id uuid REFERENCES child_profiles(id);
  END IF;
END $$;

-- Create task_completions table
CREATE TABLE IF NOT EXISTS task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  stars_earned integer NOT NULL DEFAULT 0,
  submission_notes text,
  review_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_completions_child_status 
  ON task_completions(child_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_task_completions_task 
  ON task_completions(task_id);

CREATE INDEX IF NOT EXISTS idx_tasks_child_frequency 
  ON tasks(assigned_to_child_id, frequency);

CREATE INDEX IF NOT EXISTS idx_rewards_child 
  ON rewards(assigned_to_child_id, status);

-- Enable RLS
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_completions

-- Children can insert their own task completions
CREATE POLICY "Children can submit task completions"
  ON task_completions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM child_profiles
      WHERE child_profiles.id = task_completions.child_profile_id
      AND child_profiles.user_id = auth.uid()
      AND child_profiles.is_active = true
    )
  );

-- Children can view their own task completions
CREATE POLICY "Children can view own task completions"
  ON task_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles
      WHERE child_profiles.id = task_completions.child_profile_id
      AND child_profiles.user_id = auth.uid()
      AND child_profiles.is_active = true
    )
  );

-- Parents can view task completions for their children via parent_profile_id
CREATE POLICY "Parents can view child task completions"
  ON task_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      JOIN profiles p ON p.id = cp.parent_profile_id
      WHERE cp.id = task_completions.child_profile_id
      AND p.user_id = auth.uid()
      AND cp.is_active = true
    )
  );

-- Parents can update (approve/reject) task completions for their children
CREATE POLICY "Parents can review child task completions"
  ON task_completions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      JOIN profiles p ON p.id = cp.parent_profile_id
      WHERE cp.id = task_completions.child_profile_id
      AND p.user_id = auth.uid()
      AND cp.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      JOIN profiles p ON p.id = cp.parent_profile_id
      WHERE cp.id = task_completions.child_profile_id
      AND p.user_id = auth.uid()
      AND cp.is_active = true
    )
  );

-- Function to handle task completion approval
CREATE OR REPLACE FUNCTION approve_task_completion(
  p_completion_id uuid,
  p_review_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completion task_completions;
  v_child_profile child_profiles;
  v_result json;
BEGIN
  -- Get the completion
  SELECT * INTO v_completion
  FROM task_completions
  WHERE id = p_completion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task completion not found';
  END IF;

  -- Verify user is the parent (via parent_profile_id)
  SELECT cp.* INTO v_child_profile
  FROM child_profiles cp
  JOIN profiles p ON p.id = cp.parent_profile_id
  WHERE cp.id = v_completion.child_profile_id
  AND p.user_id = auth.uid()
  AND cp.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to approve this completion';
  END IF;

  -- Check if already reviewed
  IF v_completion.status != 'pending' THEN
    RAISE EXCEPTION 'Task completion already reviewed';
  END IF;

  -- Update completion status
  UPDATE task_completions
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = p_review_notes,
    updated_at = now()
  WHERE id = p_completion_id;

  -- Move stars from pending to balance
  UPDATE child_profiles
  SET 
    stars_pending = stars_pending - v_completion.stars_earned,
    stars_balance = stars_balance + v_completion.stars_earned,
    updated_at = now()
  WHERE id = v_completion.child_profile_id;

  -- Return updated balances
  SELECT json_build_object(
    'stars_balance', stars_balance,
    'stars_pending', stars_pending
  ) INTO v_result
  FROM child_profiles
  WHERE id = v_completion.child_profile_id;

  RETURN v_result;
END;
$$;

-- Function to handle task completion rejection
CREATE OR REPLACE FUNCTION reject_task_completion(
  p_completion_id uuid,
  p_review_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completion task_completions;
  v_child_profile child_profiles;
  v_result json;
BEGIN
  -- Get the completion
  SELECT * INTO v_completion
  FROM task_completions
  WHERE id = p_completion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task completion not found';
  END IF;

  -- Verify user is the parent (via parent_profile_id)
  SELECT cp.* INTO v_child_profile
  FROM child_profiles cp
  JOIN profiles p ON p.id = cp.parent_profile_id
  WHERE cp.id = v_completion.child_profile_id
  AND p.user_id = auth.uid()
  AND cp.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to reject this completion';
  END IF;

  -- Check if already reviewed
  IF v_completion.status != 'pending' THEN
    RAISE EXCEPTION 'Task completion already reviewed';
  END IF;

  -- Update completion status
  UPDATE task_completions
  SET 
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = p_review_notes,
    updated_at = now()
  WHERE id = p_completion_id;

  -- Remove stars from pending
  UPDATE child_profiles
  SET 
    stars_pending = stars_pending - v_completion.stars_earned,
    updated_at = now()
  WHERE id = v_completion.child_profile_id;

  -- Return updated balances
  SELECT json_build_object(
    'stars_balance', stars_balance,
    'stars_pending', stars_pending
  ) INTO v_result
  FROM child_profiles
  WHERE id = v_completion.child_profile_id;

  RETURN v_result;
END;
$$;

-- Function to redeem a reward
CREATE OR REPLACE FUNCTION redeem_reward(
  p_reward_id uuid,
  p_child_profile_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward rewards;
  v_child_profile child_profiles;
  v_result json;
  v_is_authorized boolean := false;
BEGIN
  -- Get the reward
  SELECT * INTO v_reward
  FROM rewards
  WHERE id = p_reward_id
  AND is_active = true
  AND status = 'available';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward not found or not available';
  END IF;

  -- Get child profile
  SELECT * INTO v_child_profile
  FROM child_profiles
  WHERE id = p_child_profile_id
  AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child profile not found';
  END IF;

  -- Verify user is either the child or the parent
  SELECT EXISTS (
    SELECT 1 FROM child_profiles cp
    WHERE cp.id = p_child_profile_id
    AND cp.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM child_profiles cp
    JOIN profiles p ON p.id = cp.parent_profile_id
    WHERE cp.id = p_child_profile_id
    AND p.user_id = auth.uid()
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to redeem this reward';
  END IF;

  -- Check if reward belongs to this child
  IF v_reward.assigned_to_child_id IS NOT NULL AND v_reward.assigned_to_child_id != p_child_profile_id THEN
    RAISE EXCEPTION 'Reward does not belong to this child profile';
  END IF;

  -- Check if child has enough stars
  IF v_child_profile.stars_balance < v_reward.star_cost THEN
    RAISE EXCEPTION 'Insufficient stars';
  END IF;

  -- Check stock quantity if limited
  IF v_reward.stock_quantity IS NOT NULL AND v_reward.stock_quantity <= 0 THEN
    RAISE EXCEPTION 'Reward is no longer available';
  END IF;

  -- Deduct stars
  UPDATE child_profiles
  SET 
    stars_balance = stars_balance - v_reward.star_cost,
    updated_at = now()
  WHERE id = p_child_profile_id;

  -- Update stock quantity if limited
  IF v_reward.stock_quantity IS NOT NULL THEN
    UPDATE rewards
    SET 
      stock_quantity = stock_quantity - 1,
      times_redeemed = COALESCE(times_redeemed, 0) + 1,
      updated_at = now()
    WHERE id = p_reward_id;
  END IF;

  -- Update reward status to redeemed
  UPDATE rewards
  SET 
    status = 'redeemed',
    redeemed_at = now(),
    redeemed_by_child_id = p_child_profile_id,
    updated_at = now()
  WHERE id = p_reward_id;

  -- Return updated balance and reward info
  SELECT json_build_object(
    'stars_balance', cp.stars_balance,
    'reward_title', v_reward.title,
    'stars_spent', v_reward.star_cost
  ) INTO v_result
  FROM child_profiles cp
  WHERE cp.id = p_child_profile_id;

  RETURN v_result;
END;
$$;