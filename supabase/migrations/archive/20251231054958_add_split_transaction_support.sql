/*
  # Add Split Transaction Support
  
  ## Overview
  This migration adds support for splitting a single transaction across multiple categories.
  This is useful for transactions that contain multiple types of expenses (e.g., a Costco trip
  that includes groceries, household items, and gas).
  
  ## Schema Changes
  
  ### New Table: transaction_splits
  Stores the individual line items when a transaction is split across categories
  - `id` (uuid, primary key) - Unique identifier
  - `transaction_id` (uuid, references transactions) - Parent transaction
  - `user_id` (uuid, references auth.users) - Transaction owner
  - `profile_id` (uuid, references profiles) - Profile this split belongs to
  - `category_account_id` (uuid, references user_chart_of_accounts) - Category for this split
  - `amount` (numeric) - Amount allocated to this category (must be positive)
  - `description` (text) - Optional description for this split line item
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### Existing Table Updates: transactions
  - Add `is_split` (boolean) - Indicates if transaction has been split into multiple categories
  
  ## Business Rules
  1. When is_split = true:
     - The transaction's category_account_id is ignored
     - The sum of all split amounts should equal the transaction amount
     - Budget tracking uses the split amounts, not the parent transaction amount
  
  2. When is_split = false or NULL:
     - Normal behavior - use the transaction's category_account_id
  
  3. Validation:
     - Split amounts must be positive
     - At least 2 splits required when is_split = true
     - Sum of splits should equal transaction amount (enforced at app level)
  
  ## Security
  - Enable RLS on transaction_splits table
  - Add policies ensuring users can only access splits for their own transactions
  - Ensure splits can only reference categories in the same profile
  
  ## Indexes
  - Create index on transaction_id for fast split lookups
  - Create index on (profile_id, category_account_id) for budget aggregation
  - Create index on user_id for user-specific queries
  
  ## Important Notes
  1. Splits are only applicable to income and expense transactions, not transfers
  2. When a transaction is split, budget tracking sums the individual split amounts
  3. Deleting a transaction cascades to delete all its splits
  4. The parent transaction amount remains unchanged; splits subdivide it
*/

-- Add is_split column to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'is_split'
  ) THEN
    ALTER TABLE transactions ADD COLUMN is_split boolean DEFAULT false;
  END IF;
END $$;

-- Create transaction_splits table
CREATE TABLE IF NOT EXISTS transaction_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE RESTRICT NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE transaction_splits ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_id 
  ON transaction_splits(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_profile_category 
  ON transaction_splits(profile_id, category_account_id);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_user_id 
  ON transaction_splits(user_id);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_profile_id 
  ON transaction_splits(profile_id);

-- RLS Policies for transaction_splits
CREATE POLICY "Users can view splits for their own transactions"
  ON transaction_splits FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = transaction_splits.profile_id 
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create splits for their own transactions"
  ON transaction_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM transactions 
      WHERE transactions.id = transaction_id 
      AND transactions.user_id = auth.uid()
      AND transactions.profile_id = transaction_splits.profile_id
    )
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = transaction_splits.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
    AND EXISTS (
      SELECT 1 FROM user_chart_of_accounts 
      WHERE user_chart_of_accounts.id = category_account_id 
      AND user_chart_of_accounts.profile_id = transaction_splits.profile_id
    )
  );

CREATE POLICY "Users can update splits for their own transactions"
  ON transaction_splits FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = transaction_splits.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM transactions 
      WHERE transactions.id = transaction_id 
      AND transactions.user_id = auth.uid()
      AND transactions.profile_id = transaction_splits.profile_id
    )
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = transaction_splits.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
    AND EXISTS (
      SELECT 1 FROM user_chart_of_accounts 
      WHERE user_chart_of_accounts.id = category_account_id 
      AND user_chart_of_accounts.profile_id = transaction_splits.profile_id
    )
  );

CREATE POLICY "Users can delete splits for their own transactions"
  ON transaction_splits FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = transaction_splits.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transaction_splits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transaction_splits_updated_at ON transaction_splits;

CREATE TRIGGER transaction_splits_updated_at
  BEFORE UPDATE ON transaction_splits
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_splits_updated_at();

-- Create helper function to validate split totals
CREATE OR REPLACE FUNCTION validate_transaction_splits(p_transaction_id uuid)
RETURNS TABLE (
  is_valid boolean,
  transaction_amount numeric,
  splits_total numeric,
  difference numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (t.amount = COALESCE(SUM(ts.amount), 0)) as is_valid,
    t.amount as transaction_amount,
    COALESCE(SUM(ts.amount), 0) as splits_total,
    (t.amount - COALESCE(SUM(ts.amount), 0)) as difference
  FROM transactions t
  LEFT JOIN transaction_splits ts ON ts.transaction_id = t.id
  WHERE t.id = p_transaction_id
  GROUP BY t.id, t.amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;