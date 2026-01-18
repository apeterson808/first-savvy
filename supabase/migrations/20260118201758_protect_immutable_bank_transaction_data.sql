/*
  # Protect Immutable Bank Transaction Data

  ## Overview
  Adds database triggers to prevent modification of core bank data fields
  that must remain immutable after import.

  ## Protected Fields
  - amount: The transaction amount from the bank
  - bank_account_id: Which account the transaction belongs to
  - date: The transaction date from the bank
  - description: The original description from the bank

  ## Security
  These fields represent facts from the bank statement and must never change.
  All accounting treatments (categorization, journal entries, etc.) are built
  on top of this immutable foundation.
*/

-- ============================================================================
-- Create trigger function to protect immutable fields
-- ============================================================================

CREATE OR REPLACE FUNCTION protect_immutable_transaction_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent modification of amount
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'Cannot modify transaction amount - this is immutable bank data';
  END IF;

  -- Prevent modification of bank_account_id
  IF OLD.bank_account_id IS DISTINCT FROM NEW.bank_account_id THEN
    RAISE EXCEPTION 'Cannot modify transaction bank_account_id - this is immutable bank data';
  END IF;

  -- Prevent modification of date
  IF OLD.date IS DISTINCT FROM NEW.date THEN
    RAISE EXCEPTION 'Cannot modify transaction date - this is immutable bank data';
  END IF;

  -- Prevent modification of original_description (the source data)
  IF OLD.original_description IS NOT NULL AND OLD.original_description IS DISTINCT FROM NEW.original_description THEN
    RAISE EXCEPTION 'Cannot modify transaction original_description - this is immutable bank data';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- Apply trigger to transactions table
-- ============================================================================

DROP TRIGGER IF EXISTS protect_immutable_transaction_data_trigger ON transactions;

CREATE TRIGGER protect_immutable_transaction_data_trigger
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION protect_immutable_transaction_data();

COMMENT ON FUNCTION protect_immutable_transaction_data IS
'Prevents modification of immutable bank data fields (amount, bank_account_id, date, original_description).
These fields represent facts from bank statements and must never change after import.';
