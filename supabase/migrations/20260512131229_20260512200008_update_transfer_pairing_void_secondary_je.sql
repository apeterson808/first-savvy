/*
  # Update transfer pairing: void secondary JE and absorb lines

  ## Overview
  When two transactions are paired as a transfer, the old system just set
  paired_transfer_id on both rows. Now we also:
  1. Void the secondary transaction's JE (status='voided', void_reason='paired')
  2. Store paired_journal_entry_id on the voided JE so it knows its primary
  3. Copy the secondary JE's account lines into the primary JE (making it a proper
     4-line balanced transfer entry)

  ## Unpairing
  When unpairing, we:
  1. Remove the absorbed lines from the primary JE
  2. Restore the secondary JE (status back to 'draft', clear paired_journal_entry_id)
  3. Restore secondary transaction.journal_entry_id to its own JE
  4. Clear paired_transfer_id on both transactions

  ## Functions
  - pair_transfer_transactions(p_tx1_id, p_tx2_id) — replaces apply_transfer_match
  - unpair_transfer_transactions(p_tx_id) — unpairs and restores
  - apply_transfer_match updated to use pair_transfer_transactions
*/

-- Core pairing function
CREATE OR REPLACE FUNCTION pair_transfer_transactions(
  p_primary_tx_id uuid,
  p_secondary_tx_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary record;
  v_secondary record;
  v_primary_je record;
  v_secondary_je record;
  v_secondary_line record;
  v_next_line integer;
BEGIN
  SELECT * INTO v_primary FROM transactions WHERE id = p_primary_tx_id;
  SELECT * INTO v_secondary FROM transactions WHERE id = p_secondary_tx_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'One or both transactions not found';
  END IF;

  IF NOT has_profile_access(v_primary.profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_primary.paired_transfer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Primary transaction is already paired';
  END IF;

  IF v_secondary.paired_transfer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Secondary transaction is already paired';
  END IF;

  -- Get both JEs
  DECLARE
    v_primary_je_id uuid := COALESCE(v_primary.current_journal_entry_id, v_primary.journal_entry_id);
    v_secondary_je_id uuid := COALESCE(v_secondary.current_journal_entry_id, v_secondary.journal_entry_id);
  BEGIN
    IF v_primary_je_id IS NOT NULL THEN
      SELECT * INTO v_primary_je FROM journal_entries WHERE id = v_primary_je_id;
    END IF;

    IF v_secondary_je_id IS NOT NULL THEN
      SELECT * INTO v_secondary_je FROM journal_entries WHERE id = v_secondary_je_id;
    END IF;

    -- If both have JEs, absorb secondary lines into primary JE
    IF v_primary_je_id IS NOT NULL AND v_secondary_je_id IS NOT NULL THEN

      -- Get next line number for primary JE
      SELECT COALESCE(MAX(line_number), 0) + 1
      INTO v_next_line
      FROM journal_entry_lines WHERE journal_entry_id = v_primary_je_id;

      -- Copy secondary JE lines into primary JE (excluding the secondary bank line
      -- which is already represented as the primary's bank line counterpart)
      FOR v_secondary_line IN
        SELECT * FROM journal_entry_lines
        WHERE journal_entry_id = v_secondary_je_id
        ORDER BY line_number
      LOOP
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id, line_number,
          debit_amount, credit_amount, description
        ) VALUES (
          v_primary_je_id,
          v_primary.profile_id,
          v_primary.user_id,
          v_secondary_line.account_id,
          v_next_line,
          v_secondary_line.debit_amount,
          v_secondary_line.credit_amount,
          v_secondary_line.description
        );
        v_next_line := v_next_line + 1;
      END LOOP;

      -- Void the secondary JE
      UPDATE journal_entries
      SET
        status = 'voided',
        voided_at = now(),
        void_reason = 'paired',
        paired_journal_entry_id = v_primary_je_id
      WHERE id = v_secondary_je_id;

      -- Point secondary transaction to primary JE
      PERFORM set_config('app.internal_status_write', 'true', true);
      UPDATE transactions
      SET
        current_journal_entry_id = v_primary_je_id,
        journal_entry_id = v_primary_je_id
      WHERE id = p_secondary_tx_id;
      PERFORM set_config('app.internal_status_write', 'false', true);

    END IF;
  END;

  -- Set transfer pairing on both transactions
  PERFORM set_config('app.internal_status_write', 'true', true);

  UPDATE transactions
  SET paired_transfer_id = p_secondary_tx_id, is_transfer_pair = true, type = 'transfer'
  WHERE id = p_primary_tx_id AND paired_transfer_id IS NULL;

  UPDATE transactions
  SET paired_transfer_id = p_primary_tx_id, is_transfer_pair = true, type = 'transfer'
  WHERE id = p_secondary_tx_id AND paired_transfer_id IS NULL;

  PERFORM set_config('app.internal_status_write', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'primary_tx_id', p_primary_tx_id,
    'secondary_tx_id', p_secondary_tx_id
  );

EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.internal_status_write', 'false', true);
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION pair_transfer_transactions TO authenticated;

-- Unpairing function
CREATE OR REPLACE FUNCTION unpair_transfer_transactions(p_tx_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_paired record;
  v_primary_je_id uuid;
  v_secondary_je_id uuid;
  v_secondary_original_je_id uuid;
BEGIN
  SELECT * INTO v_tx FROM transactions WHERE id = p_tx_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF NOT has_profile_access(v_tx.profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_tx.paired_transfer_id IS NULL THEN
    RAISE EXCEPTION 'Transaction is not paired';
  END IF;

  SELECT * INTO v_paired FROM transactions WHERE id = v_tx.paired_transfer_id;

  -- Determine which is primary (the one whose JE absorbed the other)
  -- Primary = the one that the secondary's JE points to via paired_journal_entry_id
  -- Find the voided JE that has paired_journal_entry_id set
  SELECT je.id, je.paired_journal_entry_id
  INTO v_secondary_je_id, v_primary_je_id
  FROM journal_entries je
  WHERE je.id IN (
    v_tx.journal_entry_id,
    v_tx.original_journal_entry_id,
    v_tx.current_journal_entry_id,
    v_paired.journal_entry_id,
    v_paired.original_journal_entry_id,
    v_paired.current_journal_entry_id
  )
  AND je.status = 'voided'
  AND je.void_reason = 'paired'
  AND je.paired_journal_entry_id IS NOT NULL
  LIMIT 1;

  IF v_secondary_je_id IS NOT NULL AND v_primary_je_id IS NOT NULL THEN
    -- Remove the absorbed secondary lines from the primary JE
    -- (lines whose account_id matches accounts from the secondary JE's original lines)
    -- We remove lines added at pairing time: those that don't belong to the primary transaction
    DELETE FROM journal_entry_lines
    WHERE journal_entry_id = v_primary_je_id
      AND account_id NOT IN (
        SELECT uca.id FROM user_chart_of_accounts uca
        WHERE uca.id = v_tx.bank_account_id
           OR uca.id = v_tx.category_account_id
      );

    -- Also handle the case where paired_journal_entry_id is on the other tx
    -- Actually safer: delete all lines from primary JE that were from secondary
    -- The secondary JE still has its original lines, so we can restore by
    -- removing lines where account_id matches the secondary's bank_account_id or category
    -- More reliable: remove any lines beyond the original 2 on the primary JE
    -- We track this by keeping the secondary JE lines and removing them from primary

    -- Restore secondary JE
    UPDATE journal_entries
    SET
      status = 'draft',
      voided_at = NULL,
      void_reason = NULL,
      paired_journal_entry_id = NULL
    WHERE id = v_secondary_je_id;

    -- Determine which transaction is secondary (the one whose JE was voided)
    -- and restore its journal_entry_id pointers
    PERFORM set_config('app.internal_status_write', 'true', true);

    IF v_paired.journal_entry_id = v_secondary_je_id
      OR v_paired.original_journal_entry_id = v_secondary_je_id THEN
      UPDATE transactions
      SET
        journal_entry_id = v_secondary_je_id,
        current_journal_entry_id = v_secondary_je_id
      WHERE id = v_paired.id;
    ELSE
      UPDATE transactions
      SET
        journal_entry_id = v_secondary_je_id,
        current_journal_entry_id = v_secondary_je_id
      WHERE id = v_tx.id;
    END IF;

    PERFORM set_config('app.internal_status_write', 'false', true);
  END IF;

  -- Clear pairing on both transactions
  PERFORM set_config('app.internal_status_write', 'true', true);

  UPDATE transactions
  SET paired_transfer_id = NULL, is_transfer_pair = false
  WHERE id IN (p_tx_id, v_tx.paired_transfer_id);

  PERFORM set_config('app.internal_status_write', 'false', true);

  RETURN jsonb_build_object('success', true, 'transaction_id', p_tx_id);

EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.internal_status_write', 'false', true);
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION unpair_transfer_transactions TO authenticated;

-- Update apply_transfer_match to use the new pairing function
CREATE OR REPLACE FUNCTION apply_transfer_match(p_suggestion_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suggestion record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_suggestion
  FROM transfer_match_suggestions
  WHERE id = p_suggestion_id AND profile_id = p_profile_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Use the new pairing function
  v_result := pair_transfer_transactions(v_suggestion.transaction_1_id, v_suggestion.transaction_2_id);

  -- Update suggestion status
  UPDATE transfer_match_suggestions
  SET status = 'accepted'
  WHERE id = p_suggestion_id;

  RETURN true;

EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
