/*
  # Rename Transaction Columns for Clarity

  1. Changes
    - Rename account_id → bank_account_id
    - Rename chart_account_id → category_account_id
    
  2. Rationale
    - Both columns reference user_chart_of_accounts table but mean different things
    - account_id = which bank/credit card account the transaction belongs to
    - chart_account_id = income/expense category for the transaction
    - Current naming is confusing and not self-documenting
    
  3. New Naming Convention
    - bank_account_id: Clearly indicates the financial account (checking, savings, credit card)
    - category_account_id: Clearly indicates the income/expense categorization
    
  4. Impact
    - Improves code readability significantly
    - Makes intent clear when reading queries
    - Critical for maintainability as system scales to business profiles
    
  5. Migration Strategy
    - Rename columns with CASCADE to update all foreign keys
    - Update all indexes and constraints
    - All existing data preserved
*/

-- Rename account_id to bank_account_id
ALTER TABLE transactions 
RENAME COLUMN account_id TO bank_account_id;

-- Rename chart_account_id to category_account_id  
ALTER TABLE transactions 
RENAME COLUMN chart_account_id TO category_account_id;

-- Update index names to match new column names
ALTER INDEX IF EXISTS idx_transactions_account_id 
RENAME TO idx_transactions_bank_account_id;

ALTER INDEX IF EXISTS idx_transactions_chart_account_id 
RENAME TO idx_transactions_category_account_id;

-- Add comments explaining the columns
COMMENT ON COLUMN transactions.bank_account_id IS 'Foreign key to user_chart_of_accounts. Identifies which bank account (checking, savings, credit card) this transaction belongs to.';

COMMENT ON COLUMN transactions.category_account_id IS 'Foreign key to user_chart_of_accounts. Identifies the income/expense category for this transaction (e.g., groceries, salary, utilities).';
