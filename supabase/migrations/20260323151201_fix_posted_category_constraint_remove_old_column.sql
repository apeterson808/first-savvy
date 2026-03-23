/*
  # Fix Posted Transaction Category Constraint

  1. Changes
    - Drop old check constraint that references non-existent cc_payment_pair_id column
    - Recreate constraint using paired_transfer_id instead
    
  2. Constraint Logic
    - If status = 'posted'
    - AND type is NOT 'transfer' or 'credit_card_payment'
    - AND no paired_transfer_id
    - AND is_split = false
    - THEN category_account_id MUST NOT be NULL
    
  3. Notes
    - The old constraint referenced transfer_pair_id and cc_payment_pair_id
    - Both have been replaced by paired_transfer_id in the unified matching system
*/

-- Drop the old constraint
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS check_posted_has_category;

-- Add updated check constraint using paired_transfer_id
ALTER TABLE transactions
ADD CONSTRAINT check_posted_has_category
CHECK (
  -- Allow any non-posted transaction
  status != 'posted'
  -- OR it's a transfer/cc payment (exempt from category requirement)
  OR type IN ('transfer', 'credit_card_payment')
  OR paired_transfer_id IS NOT NULL
  -- OR it's a split transaction (has split lines)
  OR is_split = true
  -- OR it has a category
  OR category_account_id IS NOT NULL
);
