/*
  # Create Equity Table

  ## Overview
  Creates the equity table to store equity accounts following the same pattern as
  assets and liabilities tables. Equity represents ownership in a business or net
  worth for personal finance.

  ## Changes

  ### 1. Create equity table
  - Standard fields: id, user_id, name, type
  - Balance tracking: current_balance
  - Metadata: description, notes
  - Parent/child relationships via parent_account_id
  - Institution tracking (for external accounts)
  - Active status tracking
  - Timestamps

  ### 2. Indexes
  - user_id for filtering by user
  - parent_account_id for hierarchical queries
  - is_active for filtering active accounts

  ### 3. Security
  - Enable RLS
  - Policies for SELECT, INSERT, UPDATE, DELETE (user-scoped)

  ## Equity Account Types
  - owners_equity: Owner's Equity / Capital
  - partner_capital: Partner Capital
  - common_stock: Common Stock
  - preferred_stock: Preferred Stock
  - paid_in_capital: Paid-in Capital
  - retained_earnings: Retained Earnings
  - current_year_earnings: Current Year Earnings
  - owners_draw: Owner's Draw (contra-equity)
  - partner_distributions: Partner Distributions (contra-equity)
  - dividends_paid: Dividends Paid (contra-equity)
  - treasury_stock: Treasury Stock (contra-equity)
  - opening_balance_equity: Opening Balance Equity (temporary)
  - accumulated_adjustment: Accumulated Other Comprehensive Income
  - personal_equity: Personal Net Worth
  - home_equity: Home Equity
*/

-- Step 1: Create equity table
CREATE TABLE IF NOT EXISTS equity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic identification
  name text NOT NULL,
  type text,
  
  -- Balance tracking (credit balance is positive for most equity accounts)
  current_balance decimal(15,2) DEFAULT 0,
  
  -- Metadata
  description text,
  notes text,
  
  -- Hierarchical structure
  parent_account_id uuid REFERENCES equity(id) ON DELETE SET NULL,
  
  -- Institution tracking (for external equity accounts)
  institution text,
  logo_url text,
  
  -- Dates
  start_date date,
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_equity_user_id ON equity(user_id);
CREATE INDEX IF NOT EXISTS idx_equity_parent_account_id ON equity(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_equity_is_active ON equity(is_active) WHERE is_active = true;

-- Step 3: Enable RLS
ALTER TABLE equity ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
CREATE POLICY "Users can view own equity accounts"
  ON equity FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own equity accounts"
  ON equity FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own equity accounts"
  ON equity FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own equity accounts"
  ON equity FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 5: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_equity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_equity_updated_at
  BEFORE UPDATE ON equity
  FOR EACH ROW
  EXECUTE FUNCTION update_equity_updated_at();
