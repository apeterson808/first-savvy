/*
  # Add Database Constraint for Posted Transaction Categories

  1. New Constraints
    - Add check constraint to transactions table
    - Ensures posted transactions have categories (except transfers and credit card payments)
  
  2. Constraint Logic
    - If status = 'posted'
    - AND type is NOT 'transfer' or 'credit_card_payment'
    - AND no transfer_pair_id or cc_payment_pair_id
    - AND is_split = false
    - THEN category_account_id MUST NOT be NULL
  
  3. Benefits
    - Data integrity enforced at database level
    - Prevents orphaned posted transactions without journal entries
    - Final safeguard if frontend/backend validations are bypassed
*/

-- Add check constraint to ensure posted transactions have categories
ALTER TABLE transactions
ADD CONSTRAINT check_posted_has_category
CHECK (
  -- Allow any non-posted transaction
  status != 'posted'
  -- OR it's a transfer/cc payment (exempt from category requirement)
  OR type IN ('transfer', 'credit_card_payment')
  OR transfer_pair_id IS NOT NULL
  OR cc_payment_pair_id IS NOT NULL
  -- OR it's a split transaction (has split lines)
  OR is_split = true
  -- OR it has a category
  OR category_account_id IS NOT NULL
);