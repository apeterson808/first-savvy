/*
  # Fix Journal Entry Functions - Final Corrections
  
  1. Changes
    - Fix `auto_create_journal_entry_from_transaction()`: Remove inner DECLARE/BEGIN/END block in split validation
    - Fix `protect_journal_entry_immutability()`: Use current_role instead of current_user
    - Fix `create_reversal_entry()`: Ensure session flag cleanup with BEGIN/EXCEPTION wrapper
  
  2. Security
    - Maintains SECURITY DEFINER with SET search_path
    - Proper role detection using current_role
    - Guaranteed flag cleanup on all code paths
*/

-- ============================================================================
-- 1. Fix auto_create_journal_entry_from_transaction() - Split Validation
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_journal_entry_from_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_journal_entry_id uuid;
  v_entry_number text;
  v_line_number integer := 1;
  v_category_account_class text;
  v_bank_account_class text;
  v_split_count integer;
  v_split_record record;
  v_split_total_abs numeric := 0;
  v_total_split_debits numeric := 0;
  v_total_split_credits numeric := 0;
  v_bank_offset_amount numeric;
BEGIN
  -- Only create journal entries for POSTED transactions with categories
  IF NEW.status != 'posted' OR NEW.category_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if journal entry already exists
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- =========================================================================
  -- Generate entry number based on transaction type
  -- =========================================================================
  IF NEW.type = 'transfer' THEN
    v_entry_number := generate_journal_entry_number(NEW.profile_id, 'transfer');
  ELSIF NEW.credit_card_payment_id IS NOT NULL THEN
    v_entry_number := generate_journal_entry_number(NEW.profile_id, 'cc_payment');
  ELSE
    v_entry_number := generate_journal_entry_number(NEW.profile_id, 'transaction');
  END IF;

  -- =========================================================================
  -- Create journal entry header
  -- =========================================================================
  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source
  ) VALUES (
    NEW.profile_id,
    NEW.user_id,
    NEW.transaction_date,
    v_entry_number,
    COALESCE(NEW.description, NEW.original_description),
    CASE
      WHEN NEW.type = 'transfer' THEN 'transfer'
      WHEN NEW.credit_card_payment_id IS NOT NULL THEN 'cc_payment'
      ELSE 'transaction'
    END,
    CASE
      WHEN NEW.source = 'import' THEN 'bank_import'
      WHEN NEW.source = 'manual' THEN 'manual'
      ELSE 'system'
    END
  )
  RETURNING id INTO v_journal_entry_id;

  -- =========================================================================
  -- Get account classes
  -- =========================================================================
  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.bank_account_id;

  SELECT class INTO v_category_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.category_account_id;

  -- =========================================================================
  -- Check for split transactions
  -- =========================================================================
  SELECT COUNT(*) INTO v_split_count
  FROM transaction_splits
  WHERE transaction_id = NEW.id;

  -- =========================================================================
  -- Handle NON-SPLIT transactions
  -- =========================================================================
  IF v_split_count = 0 THEN
    -- Line 1: Category account side
    IF v_category_account_class IN ('expense', 'asset') THEN
      -- Debit expense or asset
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        debit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.category_account_id,
        v_line_number,
        ABS(NEW.amount),
        COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      -- Credit income or liability
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        credit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.category_account_id,
        v_line_number,
        ABS(NEW.amount),
        COALESCE(NEW.description, NEW.original_description)
      );
    END IF;

    v_line_number := v_line_number + 1;

    -- Line 2: Bank account offset (opposite of category)
    IF v_category_account_class IN ('expense', 'asset') THEN
      -- Credit bank (asset decrease)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        credit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.bank_account_id,
        v_line_number,
        ABS(NEW.amount),
        COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      -- Debit bank (asset increase)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        debit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.bank_account_id,
        v_line_number,
        ABS(NEW.amount),
        COALESCE(NEW.description, NEW.original_description)
      );
    END IF;

  -- =========================================================================
  -- Handle split transactions (FIXED - ABS comparison)
  -- =========================================================================
  ELSE
    FOR v_split_record IN
      SELECT * FROM transaction_splits
      WHERE transaction_id = NEW.id
      ORDER BY split_number
    LOOP
      SELECT class INTO v_category_account_class
      FROM user_chart_of_accounts
      WHERE id = v_split_record.category_account_id;

      -- Track absolute total of splits
      v_split_total_abs := v_split_total_abs + ABS(v_split_record.amount);

      -- Create split line (debit or credit based on account class)
      IF v_category_account_class IN ('expense', 'asset') THEN
        INSERT INTO journal_entry_lines (
          journal_entry_id,
          profile_id,
          user_id,
          account_id,
          line_number,
          debit_amount,
          description
        ) VALUES (
          v_journal_entry_id,
          NEW.profile_id,
          NEW.user_id,
          v_split_record.category_account_id,
          v_line_number,
          ABS(v_split_record.amount),
          v_split_record.description
        );
        
        v_total_split_debits := v_total_split_debits + ABS(v_split_record.amount);
      ELSE
        INSERT INTO journal_entry_lines (
          journal_entry_id,
          profile_id,
          user_id,
          account_id,
          line_number,
          credit_amount,
          description
        ) VALUES (
          v_journal_entry_id,
          NEW.profile_id,
          NEW.user_id,
          v_split_record.category_account_id,
          v_line_number,
          ABS(v_split_record.amount),
          v_split_record.description
        );
        
        v_total_split_credits := v_total_split_credits + ABS(v_split_record.amount);
      END IF;

      v_line_number := v_line_number + 1;
    END LOOP;

    -- Calculate bank offset based on net split amounts
    v_bank_offset_amount := v_total_split_debits - v_total_split_credits;

    -- Enforce: splits must match transaction amount (compare absolute values)
    IF ABS(v_split_total_abs - ABS(NEW.amount)) > 0.01 THEN
      RAISE EXCEPTION 'Split totals ($%) do not match transaction amount ($%). Difference: $%',
        v_split_total_abs, ABS(NEW.amount), ABS(v_split_total_abs - ABS(NEW.amount));
    END IF;

    -- Prevent $0 bank offset lines
    IF ABS(v_bank_offset_amount) < 0.01 THEN
      RAISE EXCEPTION 'Bank offset amount is zero. Split debits ($%) equal split credits ($%)',
        v_total_split_debits, v_total_split_credits;
    END IF;

    -- Bank offset is opposite of net split amount
    IF v_bank_offset_amount > 0 THEN
      -- Net debits in splits = credit bank account
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        credit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.bank_account_id,
        v_line_number,
        ABS(v_bank_offset_amount),
        COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      -- Net credits in splits = debit bank account
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        debit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.bank_account_id,
        v_line_number,
        ABS(v_bank_offset_amount),
        COALESCE(NEW.description, NEW.original_description)
      );
    END IF;
  END IF;

  -- =========================================================================
  -- Update transaction with journal_entry_id
  -- =========================================================================
  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Fix protect_journal_entry_immutability() - Use current_role
-- ============================================================================

CREATE OR REPLACE FUNCTION protect_journal_entry_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_flag text;
  v_current_role text;
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cannot delete posted journal entries. Use create_reversal_entry() to reverse entries.';
  END IF;

  -- Handle UPDATE
  -- Check for session flag from create_reversal_entry()
  v_session_flag := current_setting('app.internal_reversal_write', true);
  
  -- Check current database role
  v_current_role := current_role;
  
  -- Allow ONLY reversed_by_entry_id update when session flag is set OR role is service_role
  IF v_session_flag = 'true' OR v_current_role = 'service_role' THEN
    -- Verify this is specifically a reversed_by_entry_id update
    IF NEW.reversed_by_entry_id IS NOT NULL 
       AND OLD.reversed_by_entry_id IS NULL
       AND NEW.id = OLD.id
       AND NEW.profile_id = OLD.profile_id
       AND NEW.user_id = OLD.user_id
       AND NEW.entry_date = OLD.entry_date
       AND NEW.entry_number = OLD.entry_number
       AND NEW.description = OLD.description
       AND NEW.entry_type = OLD.entry_type
       AND NEW.source = OLD.source
       AND (NEW.reference_entry_id IS NOT DISTINCT FROM OLD.reference_entry_id)
    THEN
      -- This is the allowed update from create_reversal_entry() or service_role
      RETURN NEW;
    END IF;
  END IF;
  
  -- Block all other UPDATE attempts
  RAISE EXCEPTION 'Cannot modify posted journal entries. Use create_reversal_entry() to reverse entries.';
END;
$$;

COMMENT ON FUNCTION protect_journal_entry_immutability IS
'Prevents modification and deletion of posted journal entries except for reversed_by_entry_id.
Uses session flag app.internal_reversal_write set by create_reversal_entry().
Allows service_role bypass for administrative operations.';

-- ============================================================================
-- 3. Fix create_reversal_entry() - Ensure Flag Cleanup
-- ============================================================================

CREATE OR REPLACE FUNCTION create_reversal_entry(
  p_original_entry_id uuid,
  p_reversal_date date DEFAULT CURRENT_DATE,
  p_reversal_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_original_entry record;
  v_original_line record;
  v_reversal_entry_id uuid;
  v_reversal_number text;
  v_reversal_description text;
  v_is_member boolean;
BEGIN
  -- ============================================================================
  -- STEP 1: Validate original entry exists and is not already reversed
  -- ============================================================================
  SELECT * INTO v_original_entry
  FROM journal_entries
  WHERE id = p_original_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original journal entry % not found', p_original_entry_id;
  END IF;

  IF v_original_entry.reversed_by_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Entry % has already been reversed by entry %', 
      p_original_entry_id, v_original_entry.reversed_by_entry_id;
  END IF;

  -- ============================================================================
  -- STEP 1.5: Verify user has access to this profile
  -- ============================================================================
  SELECT EXISTS(
    SELECT 1 FROM profile_memberships
    WHERE profile_id = v_original_entry.profile_id
    AND user_id = auth.uid()
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Access denied: You are not a member of the profile associated with journal entry %',
      p_original_entry_id;
  END IF;

  -- ============================================================================
  -- STEP 2: Generate reversal entry number and description
  -- ============================================================================
  v_reversal_number := generate_journal_entry_number(v_original_entry.profile_id, 'reversal');
  
  v_reversal_description := COALESCE(
    p_reversal_description,
    'REVERSAL of ' || v_original_entry.entry_number || ': ' || v_original_entry.description
  );

  -- ============================================================================
  -- STEP 3: Create reversal entry header
  -- ============================================================================
  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source,
    reference_entry_id
  ) VALUES (
    v_original_entry.profile_id,
    v_original_entry.user_id,
    p_reversal_date,
    v_reversal_number,
    v_reversal_description,
    'reversal',
    'system',
    p_original_entry_id
  )
  RETURNING id INTO v_reversal_entry_id;

  -- ============================================================================
  -- STEP 4: Create reversal lines (flip debit/credit, preserve line_number)
  -- ============================================================================
  FOR v_original_line IN
    SELECT * FROM journal_entry_lines
    WHERE journal_entry_id = p_original_entry_id
    ORDER BY line_number
  LOOP
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
      v_reversal_entry_id,
      v_original_line.profile_id,
      v_original_line.user_id,
      v_original_line.account_id,
      v_original_line.line_number,  -- PRESERVE original line number
      v_original_line.credit_amount,  -- FLIP: credit becomes debit
      v_original_line.debit_amount,   -- FLIP: debit becomes credit
      'Reversal: ' || COALESCE(v_original_line.description, '')
    );
  END LOOP;

  -- ============================================================================
  -- STEP 5: Validate reversal balance (raises exception on failure)
  -- ============================================================================
  PERFORM validate_journal_entry_balance(v_reversal_entry_id);

  -- ============================================================================
  -- STEP 6: Mark original entry as reversed (with session flag bypass)
  -- ============================================================================
  BEGIN
    -- Set session flag to allow immutability trigger bypass
    PERFORM set_config('app.internal_reversal_write', 'true', true);
    
    -- Update original entry with reversed_by_entry_id
    UPDATE journal_entries
    SET reversed_by_entry_id = v_reversal_entry_id
    WHERE id = p_original_entry_id;
    
    -- Clear session flag on success
    PERFORM set_config('app.internal_reversal_write', '', true);
  EXCEPTION
    WHEN OTHERS THEN
      -- Ensure flag is cleared even on error
      PERFORM set_config('app.internal_reversal_write', '', true);
      RAISE;
  END;

  -- ============================================================================
  -- STEP 7: Return complete reversal entry
  -- ============================================================================
  RETURN jsonb_build_object(
    'reversal_entry_id', v_reversal_entry_id,
    'reversal_entry_number', v_reversal_number,
    'original_entry_id', p_original_entry_id,
    'original_entry_number', v_original_entry.entry_number,
    'reversal_date', p_reversal_date,
    'description', v_reversal_description
  );
END;
$$;

COMMENT ON FUNCTION create_reversal_entry IS
'Creates a reversal journal entry for a posted entry.
Flips all debits/credits, preserves original line numbers, validates balance.
Requires profile membership. Uses session flag to bypass immutability trigger.
Ensures flag cleanup even on error.';