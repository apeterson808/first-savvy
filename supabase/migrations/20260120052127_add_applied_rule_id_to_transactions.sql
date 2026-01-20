/*
  # Add Applied Rule Tracking to Transactions

  1. Changes
    - Add `applied_rule_id` column to `transactions` table
      - Foreign key reference to `transaction_rules` table
      - Nullable (transactions without rules have NULL)
      - Indexed for performance
    
  2. Purpose
    - Track which rule was automatically or manually applied to each transaction
    - Enable display of "Rule" badge in UI
    - Support automatic rule application system
    
  3. Security
    - No RLS changes needed (inherits from transactions table policies)
*/

-- Add applied_rule_id column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS applied_rule_id uuid REFERENCES transaction_rules(id) ON DELETE SET NULL;

-- Create index for performance when querying transactions by rule
CREATE INDEX IF NOT EXISTS idx_transactions_applied_rule_id 
ON transactions(applied_rule_id) 
WHERE applied_rule_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN transactions.applied_rule_id IS 'ID of the transaction rule that was applied to categorize this transaction';
