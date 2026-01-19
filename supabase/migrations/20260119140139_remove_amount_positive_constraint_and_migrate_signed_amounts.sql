/*
  # Remove Amount Positive Constraint and Migrate to Signed Amounts

  1. Changes
    - Drop the `transactions_amount_positive` CHECK constraint that was preventing negative amounts
    - Migrate existing transaction amounts to use signed values (negative for expenses, positive for income)
  
  2. Migration Details
    - Expenses will have negative amounts
    - Income will have positive amounts
    - Transfers and other types will maintain their current amounts
  
  3. Reasoning
    - Allows proper double-entry accounting representation
    - Fixes display issues where expenses were showing as positive
    - Aligns with standard accounting practices
*/

-- Drop the constraint that prevents negative amounts
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_amount_positive;

-- Migrate existing transactions to use signed amounts
-- Make expenses negative, keep income positive
UPDATE transactions
SET amount = -1 * ABS(amount)
WHERE type = 'expense' AND amount > 0;

-- Ensure income is positive (should already be, but being explicit)
UPDATE transactions
SET amount = ABS(amount)
WHERE type = 'income' AND amount < 0;
