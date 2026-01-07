/*
  # Remove Journal Entry Status and Simplify System

  ## Problem
  Having status on both transactions and journal_entries creates complexity:
  - Need to keep them in sync
  - Confusing which status controls balance calculations
  - Not aligned with QuickBooks/accounting software standards

  ## Solution
  Remove journal_entries.status entirely. Balance calculation logic:
  - **Transaction-linked journal entries**: Only count when transaction.status = 'posted'
  - **Manual journal entries**: Always count (no transaction link)
  - This matches QuickBooks behavior where journal entries are permanent records

  ## Changes
  1. Drop journal_entries.status column and constraint
  2. Update recalculate_account_balance() to filter by transaction status
  3. Update balance trigger functions to remove status checks
  4. Drop status sync trigger and function
  5. Update journal entry creation/query functions

  ## Benefits
  - Simpler data model (one less column)
  - Single source of truth (only transaction.status controls balance)
  - QuickBooks-aligned behavior
  - Clearer semantics (journal entries are always permanent)
  - No sync issues between transaction and journal entry status
*/

-- ============================================================================
-- STEP 1: Drop Status Sync Trigger and Function
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_sync_journal_entry_status ON transactions;
DROP FUNCTION IF EXISTS sync_journal_entry_status_with_transaction();

COMMENT ON TABLE journal_entries IS
'Journal entries are permanent accounting records. Balance calculations are controlled by transaction.status for transaction-linked entries, or always included for manual entries.';

-- ============================================================================
-- STEP 2: Drop Status Change Trigger and Function
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_balances_on_status_change ON journal_entries;
DROP FUNCTION IF EXISTS update_balances_on_journal_status_change();

-- ============================================================================
-- STEP 3: Update recalculate_account_balance Function
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id uuid)
RETURNS numeric AS $$
DECLARE
  v_balance numeric := 0;
  v_account_class text;
BEGIN
  SELECT class INTO v_account_class
  FROM user_chart_of_accounts
  WHERE id = p_account_id;

  IF v_account_class IN ('asset', 'expense') THEN
    SELECT COALESCE(SUM(
      CASE
        WHEN jel.debit_amount IS NOT NULL THEN jel.debit_amount
        WHEN jel.credit_amount IS NOT NULL THEN -jel.credit_amount
        ELSE 0
      END
    ), 0)
    INTO v_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.journal_entry_id = je.id
    WHERE jel.chart_account_id = p_account_id
      AND (t.id IS NULL OR t.status = 'posted');
  ELSE
    SELECT COALESCE(SUM(
      CASE
        WHEN jel.credit_amount IS NOT NULL THEN jel.credit_amount
        WHEN jel.debit_amount IS NOT NULL THEN -jel.debit_amount
        ELSE 0
      END
    ), 0)
    INTO v_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.journal_entry_id = je.id
    WHERE jel.chart_account_id = p_account_id
      AND (t.id IS NULL OR t.status = 'posted');
  END IF;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_account_balance IS
'Calculates account balance from journal entries. Includes manual entries (no transaction link) and transaction-linked entries where transaction.status = posted.';

-- ============================================================================
-- STEP 4: Update Balance Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(OLD.chart_account_id)
    WHERE id = OLD.chart_account_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.chart_account_id != NEW.chart_account_id THEN
      UPDATE user_chart_of_accounts
      SET current_balance = recalculate_account_balance(OLD.chart_account_id)
      WHERE id = OLD.chart_account_id;
    END IF;
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(NEW.chart_account_id)
    WHERE id = NEW.chart_account_id;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(NEW.chart_account_id)
    WHERE id = NEW.chart_account_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_account_balance_from_journal IS
'Updates account balances when journal entry lines are modified. Balance calculation respects transaction status for linked entries.';

-- ============================================================================
-- STEP 5: Add Trigger to Update Balances When Transaction Status Changes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_balance_on_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.journal_entry_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(user_chart_of_accounts.id)
    WHERE id IN (
      SELECT DISTINCT chart_account_id
      FROM journal_entry_lines
      WHERE journal_entry_id = NEW.journal_entry_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_balance_on_transaction_status_change ON transactions;
CREATE TRIGGER trigger_update_balance_on_transaction_status_change
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_balance_on_transaction_status_change();

COMMENT ON TRIGGER trigger_update_balance_on_transaction_status_change ON transactions IS
'Recalculates account balances when transaction status changes between pending and posted.';

-- ============================================================================
-- STEP 6: Update Journal Entry Creation Functions
-- ============================================================================

DROP FUNCTION IF EXISTS create_journal_entry(uuid, uuid, date, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION create_journal_entry(
  p_profile_id uuid,
  p_user_id uuid,
  p_entry_date date,
  p_description text,
  p_entry_type text,
  p_source text,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_entry_number text;
  v_line jsonb;
  v_line_number integer := 1;
BEGIN
  IF NOT validate_journal_entry_balance(p_lines) THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits must equal credits.';
  END IF;

  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry must have at least 2 lines.';
  END IF;

  v_entry_number := get_next_journal_entry_number(p_profile_id);

  INSERT INTO journal_entries (
    profile_id, user_id, entry_date, entry_number,
    description, entry_type, source
  ) VALUES (
    p_profile_id, p_user_id, p_entry_date, v_entry_number,
    p_description, p_entry_type, p_source
  ) RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_entry_lines (
      journal_entry_id, profile_id, user_id, account_id,
      line_number, debit_amount, credit_amount, description
    ) VALUES (
      v_entry_id, p_profile_id, p_user_id, (v_line->>'account_id')::uuid,
      v_line_number,
      CASE WHEN v_line->>'debit_amount' = 'null' OR v_line->>'debit_amount' IS NULL
           THEN NULL ELSE (v_line->>'debit_amount')::numeric END,
      CASE WHEN v_line->>'credit_amount' = 'null' OR v_line->>'credit_amount' IS NULL
           THEN NULL ELSE (v_line->>'credit_amount')::numeric END,
      v_line->>'description'
    );
    v_line_number := v_line_number + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entry_number', v_entry_number,
    'entry_date', p_entry_date,
    'description', p_description,
    'entry_type', p_entry_type
  );
END;
$$;

COMMENT ON FUNCTION create_journal_entry IS
'Creates a complete journal entry with lines. Journal entries are permanent records - balances controlled by linked transaction status.';

-- ============================================================================
-- STEP 7: Update Journal Entry Query Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_journal_entry_with_lines(p_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', je.id,
    'profile_id', je.profile_id,
    'user_id', je.user_id,
    'entry_date', je.entry_date,
    'entry_number', je.entry_number,
    'description', je.description,
    'entry_type', je.entry_type,
    'source', je.source,
    'created_at', je.created_at,
    'updated_at', je.updated_at,
    'lines', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', jel.id,
          'line_number', jel.line_number,
          'account_id', jel.account_id,
          'account_number', ucoa.account_number,
          'debit_amount', jel.debit_amount,
          'credit_amount', jel.credit_amount,
          'description', jel.description
        ) ORDER BY jel.line_number
      )
      FROM journal_entry_lines jel
      JOIN user_chart_of_accounts ucoa ON jel.account_id = ucoa.id
      WHERE jel.journal_entry_id = je.id
    ),
    'total_debits', (
      SELECT COALESCE(SUM(debit_amount), 0)
      FROM journal_entry_lines WHERE journal_entry_id = je.id
    ),
    'total_credits', (
      SELECT COALESCE(SUM(credit_amount), 0)
      FROM journal_entry_lines WHERE journal_entry_id = je.id
    )
  ) INTO v_result
  FROM journal_entries je
  WHERE je.id = p_entry_id;
  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS get_account_journal_lines(uuid, uuid, date, date);

CREATE OR REPLACE FUNCTION get_account_journal_lines(
  p_profile_id uuid,
  p_account_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  line_id uuid,
  entry_id uuid,
  entry_number text,
  entry_date date,
  entry_description text,
  line_description text,
  debit_amount numeric,
  credit_amount numeric,
  offsetting_accounts text,
  transaction_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jel.id, je.id, je.entry_number, je.entry_date,
    je.description, jel.description,
    jel.debit_amount, jel.credit_amount,
    (
      SELECT string_agg(
        COALESCE(ucoa2.custom_display_name, ucoa2.account_name), ', '
      )
      FROM journal_entry_lines jel2
      JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
      WHERE jel2.journal_entry_id = je.id AND jel2.account_id != p_account_id
    ),
    COALESCE(t.status, 'posted')
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  LEFT JOIN transactions t ON t.journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
  AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  ORDER BY je.entry_date, je.entry_number, jel.line_number;
END;
$$;

COMMENT ON FUNCTION get_account_journal_lines IS
'Returns all journal lines for an account with transaction status. Lines only affect balance if transaction_status = posted or NULL (manual entry).';

-- ============================================================================
-- STEP 8: Update Auto-Create Journal Entry Function
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_journal_entry_from_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_journal_entry_id uuid;
  v_entry_number text;
  v_entry_type text;
  v_bank_account_class text;
  v_category_account_class text;
  v_has_splits boolean;
  v_split_record record;
  v_line_number integer;
BEGIN
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.category_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.transfer_pair_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM transaction_splits WHERE transaction_id = NEW.id
  ) INTO v_has_splits;

  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts WHERE id = NEW.bank_account_id;

  IF NEW.category_account_id IS NOT NULL THEN
    SELECT class INTO v_category_account_class
    FROM user_chart_of_accounts WHERE id = NEW.category_account_id;
  END IF;

  IF NEW.source = 'opening_balance' THEN
    v_entry_type := 'opening_balance';
  ELSIF NEW.original_type = 'transfer' THEN
    v_entry_type := 'transfer';
  ELSE
    v_entry_type := 'adjustment';
  END IF;

  v_entry_number := generate_journal_entry_number(NEW.profile_id);

  INSERT INTO journal_entries (
    profile_id, user_id, entry_date, entry_number,
    description, entry_type, source
  ) VALUES (
    NEW.profile_id, NEW.user_id, NEW.transaction_date,
    v_entry_number, NEW.original_description, v_entry_type,
    COALESCE(NEW.source, 'import')
  ) RETURNING id INTO v_journal_entry_id;

  v_line_number := 1;

  IF v_has_splits THEN
    FOR v_split_record IN
      SELECT * FROM transaction_splits
      WHERE transaction_id = NEW.id ORDER BY split_number
    LOOP
      SELECT class INTO v_category_account_class
      FROM user_chart_of_accounts WHERE id = v_split_record.category_account_id;

      IF v_category_account_class IN ('expense', 'asset') THEN
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id,
          line_number, debit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id,
          v_split_record.category_account_id, v_line_number,
          ABS(v_split_record.amount), v_split_record.description
        );
      ELSE
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id,
          line_number, credit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id,
          v_split_record.category_account_id, v_line_number,
          ABS(v_split_record.amount), v_split_record.description
        );
      END IF;
      v_line_number := v_line_number + 1;
    END LOOP;

    IF v_category_account_class IN ('expense', 'asset') THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.display_amount), 'Split transaction total'
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.display_amount), 'Split transaction total'
      );
    END IF;
  ELSE
    IF v_category_account_class = 'expense' THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.category_account_id,
        1, ABS(NEW.display_amount), NEW.original_description
      );
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        2, ABS(NEW.display_amount), NEW.original_description
      );
    ELSIF v_category_account_class = 'income' THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        1, ABS(NEW.display_amount), NEW.original_description
      );
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.category_account_id,
        2, ABS(NEW.display_amount), NEW.original_description
      );
    ELSIF v_category_account_class = 'asset' THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.category_account_id,
        1, ABS(NEW.display_amount), NEW.original_description
      );
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        2, ABS(NEW.display_amount), NEW.original_description
      );
    ELSIF v_category_account_class = 'liability' THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.category_account_id,
        1, ABS(NEW.display_amount), NEW.original_description
      );
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        2, ABS(NEW.display_amount), NEW.original_description
      );
    END IF;
  END IF;

  NEW.journal_entry_id := v_journal_entry_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_create_journal_entry_from_transaction IS
'Auto-creates journal entries for transactions. Journal entries are permanent records - balance impact controlled by transaction.status.';

-- ============================================================================
-- STEP 9: Remove Status Column from journal_entries
-- ============================================================================

ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS status;

COMMENT ON TABLE journal_entries IS
'Permanent journal entry records. For transaction-linked entries, balance impact is controlled by transactions.status. For manual entries, always affects balance.';
