/*
  # Fix Transfer Journal Entry Status Check

  ## Problem
  The create_transfer_journal_entry function creates journal entries for transfers
  WITHOUT checking if both transactions are posted. This causes pending transfers
  to appear in account registers.

  ## Evidence
  - Pending transfers have journal_entry_id values
  - These journal entries show up in account registers (which only show posted entries)
  - Users see doubled entries because both sides of the transfer appear

  ## Fix
  Add status check to create_transfer_journal_entry:
  - Only create journal entry if BOTH transactions have status = 'posted'
  - Return NULL if either transaction is still pending

  ## Impact
  - Pending transfers will no longer create journal entries
  - Account registers will only show posted transfers
  - Fixes the "doubled" display issue
*/

CREATE OR REPLACE FUNCTION create_transfer_journal_entry(
  p_transaction_id uuid,
  p_profile_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transaction record;
  v_paired_transaction record;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_source_account_id uuid;
  v_dest_account_id uuid;
  v_amount numeric;
  v_description text;
BEGIN
  -- Get the transaction
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  -- If no transfer_pair_id, this isn't a transfer
  IF v_transaction.transfer_pair_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- CRITICAL: Only create journal entries for POSTED transfers
  IF v_transaction.status != 'posted' THEN
    RETURN NULL;
  END IF;

  -- Find the paired transaction
  SELECT * INTO v_paired_transaction
  FROM transactions
  WHERE transfer_pair_id = v_transaction.transfer_pair_id
    AND id != p_transaction_id
    AND profile_id = p_profile_id;

  -- If paired transaction doesn't exist yet, we'll create entry when it's posted
  IF v_paired_transaction.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- CRITICAL: Paired transaction must also be posted
  IF v_paired_transaction.status != 'posted' THEN
    RETURN NULL;
  END IF;

  -- Check if journal entry already exists for this transfer pair
  -- (Prevent creating duplicate entries)
  IF v_transaction.journal_entry_id IS NOT NULL THEN
    RETURN v_transaction.journal_entry_id;
  END IF;

  IF v_paired_transaction.journal_entry_id IS NOT NULL THEN
    RETURN v_paired_transaction.journal_entry_id;
  END IF;

  -- Determine source and destination based on transaction amounts
  -- Source account: where money comes FROM (negative/outflow)
  -- Dest account: where money goes TO (positive/inflow)
  IF v_transaction.amount < 0 THEN
    -- This transaction is the outflow (source)
    v_source_account_id := v_transaction.bank_account_id;
    v_dest_account_id := v_paired_transaction.bank_account_id;
    v_amount := ABS(v_transaction.amount);
    v_description := COALESCE(v_transaction.description, v_transaction.original_description);
  ELSE
    -- This transaction is the inflow (destination)
    v_dest_account_id := v_transaction.bank_account_id;
    v_source_account_id := v_paired_transaction.bank_account_id;
    v_amount := ABS(v_transaction.amount);
    v_description := COALESCE(v_transaction.description, v_transaction.original_description);
  END IF;

  -- Generate journal entry number
  v_entry_number := generate_journal_entry_number(p_profile_id);

  -- Create journal entry header
  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source
  ) VALUES (
    p_profile_id,
    p_user_id,
    v_transaction.date,
    v_entry_number,
    v_description,
    'transfer',
    COALESCE(v_transaction.source, 'system')
  )
  RETURNING id INTO v_journal_entry_id;

  -- Create journal entry line 1: DEBIT destination account (money coming in)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  ) VALUES (
    v_journal_entry_id,
    p_profile_id,
    p_user_id,
    v_dest_account_id,
    1,
    v_amount,
    NULL,
    'Transfer from account'
  );

  -- Create journal entry line 2: CREDIT source account (money going out)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  ) VALUES (
    v_journal_entry_id,
    p_profile_id,
    p_user_id,
    v_source_account_id,
    2,
    NULL,
    v_amount,
    'Transfer to account'
  );

  -- Link BOTH transactions to this journal entry
  UPDATE transactions
  SET journal_entry_id = v_journal_entry_id
  WHERE id IN (v_transaction.id, v_paired_transaction.id);

  RETURN v_journal_entry_id;
END;
$$;

COMMENT ON FUNCTION create_transfer_journal_entry IS
'Creates a single journal entry for a transfer pair, linking both transactions.
Implements QuickBooks-standard transfer handling: DR destination, CR source.
Only creates one entry per pair, preventing duplicates.
CRITICAL: Only creates entries when BOTH transactions are posted.';
