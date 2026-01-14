/*
  # Fix Journal Entry Source Mapping for Transfers

  ## Issue
  The create_transfer_journal_entry function uses transaction source values directly:
  - Transaction sources: 'manual', 'csv', 'ofx', 'pdf', 'api'
  - Journal entry constraint: 'manual', 'import', 'system', 'migration'

  When a transfer with source='csv'/'ofx'/'pdf'/'api' is posted, it violates
  the journal_entries.valid_source constraint.

  ## Solution
  Map transaction source values to valid journal entry source values:
  - 'manual' → 'manual'
  - 'csv', 'ofx', 'pdf', 'api' → 'import'
  - default → 'import'
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
  v_journal_source text;
BEGIN
  -- Get the transaction
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  -- If no transfer_pair_id, this isn't a transfer
  IF v_transaction.transfer_pair_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Use advisory lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(v_transaction.transfer_pair_id::text));

  -- Find the paired transaction
  SELECT * INTO v_paired_transaction
  FROM transactions
  WHERE transfer_pair_id = v_transaction.transfer_pair_id
    AND id != p_transaction_id
    AND profile_id = p_profile_id;

  -- Check if paired transaction is POSTED
  IF v_paired_transaction.id IS NULL OR v_paired_transaction.status != 'posted' THEN
    RETURN NULL;
  END IF;

  -- Check if journal entry already exists for this transfer pair
  IF v_transaction.journal_entry_id IS NOT NULL THEN
    RETURN v_transaction.journal_entry_id;
  END IF;

  -- If paired transaction already has journal entry, reuse it
  IF v_paired_transaction.journal_entry_id IS NOT NULL THEN
    UPDATE transactions
    SET journal_entry_id = v_paired_transaction.journal_entry_id
    WHERE id = v_transaction.id;

    RETURN v_paired_transaction.journal_entry_id;
  END IF;

  -- Map transaction source to valid journal entry source
  v_journal_source := CASE COALESCE(v_transaction.source, 'manual')
    WHEN 'manual' THEN 'manual'
    WHEN 'api' THEN 'import'
    WHEN 'csv' THEN 'import'
    WHEN 'ofx' THEN 'import'
    WHEN 'pdf' THEN 'import'
    ELSE 'import'
  END;

  -- Determine source and destination based on transaction amounts
  IF v_transaction.amount < 0 THEN
    v_source_account_id := v_transaction.bank_account_id;
    v_dest_account_id := v_paired_transaction.bank_account_id;
    v_amount := ABS(v_transaction.amount);
    v_description := COALESCE(v_transaction.description, v_transaction.original_description);
  ELSE
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
    v_journal_source
  )
  RETURNING id INTO v_journal_entry_id;

  -- Create journal entry line 1: DEBIT destination account
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

  -- Create journal entry line 2: CREDIT source account
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
'Creates a single journal entry for a transfer pair with proper source mapping.
Maps transaction sources (csv/ofx/pdf/api) to valid journal entry sources (import).';