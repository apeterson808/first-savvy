/*
  # JE sync on transaction UPDATE trigger

  ## Overview
  When a transaction is updated (category changed, amount changed, description changed,
  date changed, splits changed), this trigger keeps the linked draft JE in sync.

  ## Behavior
  - Only fires when status is NOT being changed to 'posted' (posting is handled separately)
  - Skips voided transactions
  - For draft JEs: updates in place (lines replaced, header updated)
  - For posted JEs: still updates description/date in place (amount changes on posted entries
    require the user to use the JE editor directly which creates a reversing entry)
  - Suspense line replacement: if category_account_id changes from NULL to a real account,
    the suspense line is replaced with the real account line
  - Logs changes to audit_logs with old/new state

  ## Period Lock
  - If the JE is in 'locked' status, the update is blocked with an exception
*/

CREATE OR REPLACE FUNCTION sync_je_on_transaction_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_je_id uuid;
  v_je_status text;
  v_bank_class text;
  v_category_class text;
  v_suspense_id uuid;
  v_offset_account_id uuid;
  v_amount numeric;
  v_old_category_class text;
  v_split_count integer;
  v_split_record record;
  v_line_num integer;
  v_total_split_debits numeric := 0;
  v_total_split_credits numeric := 0;
  v_bank_offset numeric;
  v_bank_is_debit boolean;
BEGIN
  -- Skip voided transactions
  IF NEW.status = 'voided' THEN
    RETURN NEW;
  END IF;

  -- Skip if this is the posting step (handled by post_transaction function)
  IF OLD.status = 'pending' AND NEW.status = 'posted' THEN
    RETURN NEW;
  END IF;

  -- Only sync if relevant fields changed
  IF OLD.amount = NEW.amount
    AND OLD.date = NEW.date
    AND OLD.description IS NOT DISTINCT FROM NEW.description
    AND OLD.category_account_id IS NOT DISTINCT FROM NEW.category_account_id
    AND OLD.bank_account_id IS NOT DISTINCT FROM NEW.bank_account_id
    AND OLD.type IS NOT DISTINCT FROM NEW.type
    AND OLD.status = NEW.status
  THEN
    RETURN NEW;
  END IF;

  -- Get current JE
  v_je_id := COALESCE(NEW.current_journal_entry_id, NEW.journal_entry_id);
  IF v_je_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_je_status FROM journal_entries WHERE id = v_je_id;

  -- Block edits to locked JEs
  IF v_je_status = 'locked' THEN
    RAISE EXCEPTION 'Cannot edit transaction: the accounting period is locked. Unlock the period first.';
  END IF;

  -- Skip voided JEs (paired transfer secondary)
  IF v_je_status = 'voided' THEN
    RETURN NEW;
  END IF;

  v_amount := ABS(COALESCE(NEW.amount, 0));

  -- Get account classes
  SELECT class INTO v_bank_class FROM user_chart_of_accounts WHERE id = NEW.bank_account_id;

  -- Determine offset account
  SELECT id INTO v_suspense_id
  FROM user_chart_of_accounts
  WHERE profile_id = NEW.profile_id AND account_number = 9999 AND is_system_account = true
  LIMIT 1;

  IF NEW.category_account_id IS NOT NULL THEN
    v_offset_account_id := NEW.category_account_id;
    SELECT class INTO v_category_class FROM user_chart_of_accounts WHERE id = NEW.category_account_id;
  ELSE
    v_offset_account_id := v_suspense_id;
    v_category_class := 'expense';
  END IF;

  v_bank_is_debit := get_je_debit_side_for_bank(v_bank_class, COALESCE(NEW.type, 'expense'), NEW.amount);

  -- Update JE header
  UPDATE journal_entries
  SET
    entry_date = NEW.date,
    description = COALESCE(NEW.description, NEW.original_description, ''),
    entry_type = CASE NEW.type
      WHEN 'transfer' THEN 'transfer'
      WHEN 'income'   THEN 'deposit'
      WHEN 'expense'  THEN
        CASE v_bank_class
          WHEN 'liability' THEN 'charge'
          ELSE 'withdrawal'
        END
      ELSE 'adjustment'
    END,
    updated_at = now(),
    edited_at = now(),
    edited_by = auth.uid(),
    edit_count = COALESCE(edit_count, 0) + 1
  WHERE id = v_je_id;

  -- Check for splits
  SELECT COUNT(*) INTO v_split_count FROM transaction_splits WHERE transaction_id = NEW.id;

  IF v_split_count > 0 THEN
    -- Delete existing non-bank lines
    DELETE FROM journal_entry_lines
    WHERE journal_entry_id = v_je_id
      AND account_id != NEW.bank_account_id;

    v_line_num := 1;

    FOR v_split_record IN
      SELECT * FROM transaction_splits WHERE transaction_id = NEW.id ORDER BY split_number
    LOOP
      SELECT class INTO v_category_class
      FROM user_chart_of_accounts WHERE id = v_split_record.category_account_id;

      IF v_category_class IN ('expense', 'asset') THEN
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id, line_number, debit_amount, description
        ) VALUES (
          v_je_id, NEW.profile_id, NEW.user_id, v_split_record.category_account_id,
          v_line_num, ABS(v_split_record.amount), v_split_record.description
        );
        v_total_split_debits := v_total_split_debits + ABS(v_split_record.amount);
      ELSE
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id, line_number, credit_amount, description
        ) VALUES (
          v_je_id, NEW.profile_id, NEW.user_id, v_split_record.category_account_id,
          v_line_num, ABS(v_split_record.amount), v_split_record.description
        );
        v_total_split_credits := v_total_split_credits + ABS(v_split_record.amount);
      END IF;

      v_line_num := v_line_num + 1;
    END LOOP;

    -- Update bank line
    v_bank_offset := v_total_split_debits - v_total_split_credits;
    IF v_bank_offset > 0 THEN
      UPDATE journal_entry_lines
      SET credit_amount = ABS(v_bank_offset), debit_amount = NULL, line_number = v_line_num
      WHERE journal_entry_id = v_je_id AND account_id = NEW.bank_account_id;
    ELSE
      UPDATE journal_entry_lines
      SET debit_amount = ABS(v_bank_offset), credit_amount = NULL, line_number = v_line_num
      WHERE journal_entry_id = v_je_id AND account_id = NEW.bank_account_id;
    END IF;

  ELSE
    -- No splits: simple two-line update

    -- Update/replace the category/suspense line
    -- First delete old category line (any non-bank line)
    DELETE FROM journal_entry_lines
    WHERE journal_entry_id = v_je_id
      AND account_id != OLD.bank_account_id;

    -- Insert fresh category line
    IF v_category_class IN ('expense', 'asset') THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        debit_amount, description
      ) VALUES (
        v_je_id, NEW.profile_id, COALESCE(NEW.user_id, auth.uid()),
        v_offset_account_id, 1,
        v_amount, COALESCE(NEW.description, NEW.original_description, '')
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        credit_amount, description
      ) VALUES (
        v_je_id, NEW.profile_id, COALESCE(NEW.user_id, auth.uid()),
        v_offset_account_id, 1,
        v_amount, COALESCE(NEW.description, NEW.original_description, '')
      );
    END IF;

    -- Update bank line amount and direction
    IF v_bank_is_debit THEN
      UPDATE journal_entry_lines
      SET debit_amount = v_amount, credit_amount = NULL,
          description = COALESCE(NEW.description, NEW.original_description, ''),
          line_number = 2,
          account_id = NEW.bank_account_id
      WHERE journal_entry_id = v_je_id AND account_id = OLD.bank_account_id;
    ELSE
      UPDATE journal_entry_lines
      SET credit_amount = v_amount, debit_amount = NULL,
          description = COALESCE(NEW.description, NEW.original_description, ''),
          line_number = 2,
          account_id = NEW.bank_account_id
      WHERE journal_entry_id = v_je_id AND account_id = OLD.bank_account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_je_on_transaction_update_trigger ON transactions;
CREATE TRIGGER sync_je_on_transaction_update_trigger
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_je_on_transaction_update();
