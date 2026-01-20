/*
  # Create Accounting Periods Table

  ## Summary
  Creates table to support period locking for tax-ready accounting compliance.
  
  ## New Table: `accounting_periods`
  - `id`: Primary key
  - `profile_id`: Links to profiles (required)
  - `period_name`: Display name (e.g., "January 2025")
  - `start_date`: Period start date
  - `end_date`: Period end date
  - `lock_date`: Date through which transactions are locked
  - `is_locked`: Boolean flag for full period lock
  - `created_at`, `updated_at`: Audit timestamps
  
  ## Security
  - RLS enabled
  - Users can only access periods for profiles they're members of
  - Indexes for performance
  
  ## Notes
  - Period locking prevents undo post of transactions within locked periods
  - Used by undo_post RPCs to enforce compliance
*/

-- Create accounting_periods table
CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  lock_date DATE,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure no overlapping periods for same profile
  CONSTRAINT valid_period_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_lock_date CHECK (lock_date IS NULL OR lock_date >= start_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounting_periods_profile 
  ON accounting_periods(profile_id);
  
CREATE INDEX IF NOT EXISTS idx_accounting_periods_dates 
  ON accounting_periods(profile_id, start_date, end_date);

-- Enable RLS
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view periods for their profiles"
  ON accounting_periods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = accounting_periods.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create periods for their profiles"
  ON accounting_periods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = accounting_periods.profile_id
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update periods for their profiles"
  ON accounting_periods
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = accounting_periods.profile_id
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete periods for their profiles"
  ON accounting_periods
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = accounting_periods.profile_id
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin')
    )
  );
