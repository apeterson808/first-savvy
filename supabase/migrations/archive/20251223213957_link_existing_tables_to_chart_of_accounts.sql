/*
  # Link Existing Tables to Chart of Accounts

  ## Overview
  Adds foreign key columns to existing tables to link them with the unified chart of accounts system.

  ## Changes

  1. **Transactions Table**
     - Add `chart_account_id` column referencing user_chart_of_accounts
     - Maintains existing category_id for backward compatibility during migration

  2. **Budgets Table**
     - Add `chart_account_id` column referencing user_chart_of_accounts
     - Links budgets to income/expense chart accounts

  3. **Accounts Table (Bank/Credit)**
     - Add `chart_account_id` column referencing user_chart_of_accounts
     - Links transactional accounts to asset accounts in chart

  4. **Assets, Liabilities, Equity Tables**
     - Add `chart_account_id` column referencing user_chart_of_accounts
     - Links balance sheet items to their chart of accounts entries

  ## Indexes
  - Foreign key indexes for performance
*/

-- Add chart_account_id to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'chart_account_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN chart_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_transactions_chart_account_id ON transactions(chart_account_id);
  END IF;
END $$;

-- Add chart_account_id to budgets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'chart_account_id'
  ) THEN
    ALTER TABLE budgets ADD COLUMN chart_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_budgets_chart_account_id ON budgets(chart_account_id);
  END IF;
END $$;

-- Add chart_account_id to accounts table (transactional accounts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'chart_account_id'
  ) THEN
    ALTER TABLE accounts ADD COLUMN chart_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_accounts_chart_account_id ON accounts(chart_account_id);
  END IF;
END $$;

-- Add chart_account_id to bank_accounts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'chart_account_id'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN chart_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_chart_account_id ON bank_accounts(chart_account_id);
  END IF;
END $$;

-- Add chart_account_id to credit_cards table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_cards' AND column_name = 'chart_account_id'
  ) THEN
    ALTER TABLE credit_cards ADD COLUMN chart_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_credit_cards_chart_account_id ON credit_cards(chart_account_id);
  END IF;
END $$;

-- Add chart_account_id to assets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'chart_account_id'
  ) THEN
    ALTER TABLE assets ADD COLUMN chart_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_assets_chart_account_id ON assets(chart_account_id);
  END IF;
END $$;

-- Add chart_account_id to liabilities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'chart_account_id'
  ) THEN
    ALTER TABLE liabilities ADD COLUMN chart_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_liabilities_chart_account_id ON liabilities(chart_account_id);
  END IF;
END $$;

-- Add chart_account_id to equity table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equity' AND column_name = 'chart_account_id'
  ) THEN
    ALTER TABLE equity ADD COLUMN chart_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_equity_chart_account_id ON equity(chart_account_id);
  END IF;
END $$;

-- Add category_id to transactions if it doesn't exist (for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN category_id uuid;
  END IF;
END $$;