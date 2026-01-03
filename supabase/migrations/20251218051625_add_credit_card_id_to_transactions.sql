/*
  # Add Credit Card Support to Transactions

  1. Changes
    - Add credit_card_id column to transactions table
    - Add CHECK constraint to ensure either bank_account_id OR credit_card_id is set (not both, not neither)
    - Add foreign key relationship to credit_cards table
    - Create index on credit_card_id for query performance
    - Update RLS policies to handle credit_card_id lookups
    - Create trigger to update credit card current_balance when transactions change
    
  2. Security
    - Update RLS policies to check both bank_account_id and credit_card_id
    
  3. Performance
    - Add index on credit_card_id
*/

-- Add credit_card_id column to transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'credit_card_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN credit_card_id uuid REFERENCES credit_cards(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add CHECK constraint to ensure either bank_account_id OR credit_card_id is set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transactions_account_check'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_account_check
      CHECK (
        (bank_account_id IS NOT NULL AND credit_card_id IS NULL) OR
        (bank_account_id IS NULL AND credit_card_id IS NOT NULL)
      );
  END IF;
END $$;

-- Create index on credit_card_id
CREATE INDEX IF NOT EXISTS idx_transactions_credit_card_id ON transactions(credit_card_id);

-- Drop existing RLS policies to recreate them with credit card support
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

-- Recreate RLS policies with credit card support
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM bank_accounts
      WHERE bank_accounts.id = transactions.bank_account_id
      AND bank_accounts.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM credit_cards
      WHERE credit_cards.id = transactions.credit_card_id
      AND credit_cards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM bank_accounts
      WHERE bank_accounts.id = transactions.bank_account_id
      AND bank_accounts.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM credit_cards
      WHERE credit_cards.id = transactions.credit_card_id
      AND credit_cards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM bank_accounts
      WHERE bank_accounts.id = transactions.bank_account_id
      AND bank_accounts.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM credit_cards
      WHERE credit_cards.id = transactions.credit_card_id
      AND credit_cards.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM bank_accounts
      WHERE bank_accounts.id = transactions.bank_account_id
      AND bank_accounts.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM credit_cards
      WHERE credit_cards.id = transactions.credit_card_id
      AND credit_cards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM bank_accounts
      WHERE bank_accounts.id = transactions.bank_account_id
      AND bank_accounts.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM credit_cards
      WHERE credit_cards.id = transactions.credit_card_id
      AND credit_cards.user_id = auth.uid()
    )
  );

-- Create function to update credit card balance
CREATE OR REPLACE FUNCTION update_credit_card_balance()
RETURNS TRIGGER AS $$
DECLARE
  card_id uuid;
BEGIN
  -- Determine which credit card to update
  IF TG_OP = 'DELETE' THEN
    card_id := OLD.credit_card_id;
  ELSE
    card_id := NEW.credit_card_id;
  END IF;

  -- Only proceed if transaction involves a credit card
  IF card_id IS NOT NULL THEN
    -- Recalculate balance from all transactions
    UPDATE credit_cards
    SET current_balance = COALESCE((
      SELECT SUM(amount)
      FROM transactions
      WHERE credit_card_id = card_id
    ), 0)
    WHERE id = card_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update credit card balance
DROP TRIGGER IF EXISTS update_credit_card_balance_trigger ON transactions;
CREATE TRIGGER update_credit_card_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_card_balance();
