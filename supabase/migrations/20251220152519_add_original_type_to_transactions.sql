/*
  # Add original_type column to transactions
  
  1. Changes
    - Add `original_type` column to `transactions` table
      - Type: text (nullable)
      - Purpose: Stores the transaction type before matching occurs
      - Value is set when a transaction is matched and restored on unmatch
    
  2. Performance
    - Add index on `original_type` for query performance
    - Partial index (only where original_type IS NOT NULL) to save space
  
  3. Notes
    - This field preserves the imported/pre-match type value
    - NULL means transaction has never been matched
    - Used to restore transaction type when unmatching transfers
*/

-- Add original_type column to store pre-match transaction type
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS original_type text;

-- Create partial index for performance (only index non-null values)
CREATE INDEX IF NOT EXISTS idx_transactions_original_type 
ON transactions(original_type) 
WHERE original_type IS NOT NULL;