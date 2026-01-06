/*
  # Backfill Journal Entries for Historical Categorized Transactions

  ## Overview
  This migration fixes existing transactions that have categories but no journal entries.
  This occurs when transactions were categorized before the UPDATE trigger was enabled.

  ## Process
  1. Find all transactions with category_account_id but no journal_entry_id
  2. Create journal entries for each transaction
  3. Recalculate account balances
  4. This will fix the Citi Card balance issue where categorization didn't update balances

  ## Safety
  - Uses temporary function that's dropped after execution
  - Only processes transactions that need journal entries
  - Creates proper double-entry bookkeeping entries
  - Recalculates balances after all entries are created
*/

-- Create temporary function to backfill journal entries
CREATE OR REPLACE FUNCTION backfill_categorized_transaction_journal_entries()
RETURNS TABLE (
  transactions_processed integer,
  journal_entries_created integer,
  accounts_updated integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_record record;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_entry_type text;
  v_bank_account_class text;
  v_category_account_class text;
  v_has_splits boolean;
  v_split_record record;
  v_line_number integer;
  v_transactions_processed integer := 0;
  v_journal_entries_created integer := 0;
  v_affected_accounts uuid[];
BEGIN
  -- Loop through all transactions that have categories but no journal entries
  FOR v_transaction_record IN
    SELECT *
    FROM transactions
    WHERE category_account_id IS NOT NULL
      AND journal_entry_id IS NULL
      AND transfer_pair_id IS NULL
      AND status = 'posted'
    ORDER BY date, created_at
  LOOP
    v_transactions_processed := v_transactions_processed + 1;

    -- Check if transaction has splits
    SELECT EXISTS(
      SELECT 1 FROM transaction_splits
      WHERE transaction_id = v_transaction_record.id
    ) INTO v_has_splits;

    -- Get account classes
    SELECT class INTO v_bank_account_class
    FROM user_chart_of_accounts
    WHERE id = v_transaction_record.bank_account_id;

    SELECT class INTO v_category_account_class
    FROM user_chart_of_accounts
    WHERE id = v_transaction_record.category_account_id;

    -- Determine entry type
    IF v_transaction_record.source = 'opening_balance' THEN
      v_entry_type := 'opening_balance';
    ELSIF v_transaction_record.original_type = 'transfer' THEN
      v_entry_type := 'transfer';
    ELSE
      v_entry_type := 'adjustment';
    END IF;

    -- Generate journal entry number
    v_entry_number := generate_journal_entry_number(v_transaction_record.profile_id);

    -- Create journal entry header
    INSERT INTO journal_entries (
      profile_id,
      user_id,
      entry_date,
      entry_number,
      description,
      entry_type,
      status,
      source
    ) VALUES (
      v_transaction_record.profile_id,
      v_transaction_record.user_id,
      v_transaction_record.date,
      v_entry_number,
      v_transaction_record.original_description,
      v_entry_type,
      'posted',
      COALESCE(v_transaction_record.source, 'import')
    )
    RETURNING id INTO v_journal_entry_id;

    v_journal_entries_created := v_journal_entries_created + 1;

    -- Create journal entry lines
    v_line_number := 1;

    IF v_has_splits THEN
      -- Handle split transactions
      FOR v_split_record IN
        SELECT * FROM transaction_splits
        WHERE transaction_id = v_transaction_record.id
        ORDER BY split_number
      LOOP
        -- Get the split category class
        SELECT class INTO v_category_account_class
        FROM user_chart_of_accounts
        WHERE id = v_split_record.category_account_id;

        -- Debit the category (expense/asset) or Credit (income/liability)
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
            v_transaction_record.profile_id,
            v_transaction_record.user_id,
            v_split_record.category_account_id,
            v_line_number,
            ABS(v_split_record.amount),
            v_split_record.description
          );
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
            v_transaction_record.profile_id,
            v_transaction_record.user_id,
            v_split_record.category_account_id,
            v_line_number,
            ABS(v_split_record.amount),
            v_split_record.description
          );
        END IF;

        v_line_number := v_line_number + 1;
      END LOOP;

      -- Credit/Debit bank account for total
      IF v_bank_account_class IN ('asset') THEN
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
          v_transaction_record.profile_id,
          v_transaction_record.user_id,
          v_transaction_record.bank_account_id,
          v_line_number,
          ABS(v_transaction_record.amount),
          'Payment from account'
        );
      ELSE
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
          v_transaction_record.profile_id,
          v_transaction_record.user_id,
          v_transaction_record.bank_account_id,
          v_line_number,
          ABS(v_transaction_record.amount),
          'Payment from account'
        );
      END IF;

    ELSE
      -- No splits - use category_account_id
      IF v_category_account_class IN ('expense', 'asset') THEN
        -- Debit category (expense/asset)
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
          v_transaction_record.profile_id,
          v_transaction_record.user_id,
          v_transaction_record.category_account_id,
          v_line_number,
          ABS(v_transaction_record.amount),
          v_transaction_record.description
        );

        v_line_number := v_line_number + 1;

        -- Credit bank account
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
          v_transaction_record.profile_id,
          v_transaction_record.user_id,
          v_transaction_record.bank_account_id,
          v_line_number,
          ABS(v_transaction_record.amount),
          'Payment from account'
        );

      ELSE
        -- Income: Debit bank account, Credit category
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
          v_transaction_record.profile_id,
          v_transaction_record.user_id,
          v_transaction_record.bank_account_id,
          v_line_number,
          ABS(v_transaction_record.amount),
          'Deposit to account'
        );

        v_line_number := v_line_number + 1;

        -- Credit category (income)
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
          v_transaction_record.profile_id,
          v_transaction_record.user_id,
          v_transaction_record.category_account_id,
          v_line_number,
          ABS(v_transaction_record.amount),
          v_transaction_record.description
        );
      END IF;
    END IF;

    -- Link journal entry to transaction
    UPDATE transactions
    SET journal_entry_id = v_journal_entry_id
    WHERE id = v_transaction_record.id;

    -- Track affected accounts for balance recalculation
    v_affected_accounts := array_append(v_affected_accounts, v_transaction_record.bank_account_id);
    v_affected_accounts := array_append(v_affected_accounts, v_transaction_record.category_account_id);
  END LOOP;

  -- Recalculate balances for all affected accounts
  UPDATE user_chart_of_accounts
  SET current_balance = recalculate_account_balance(id)
  WHERE id = ANY(v_affected_accounts);

  -- Return results
  RETURN QUERY SELECT 
    v_transactions_processed,
    v_journal_entries_created,
    (SELECT COUNT(DISTINCT unnest) FROM unnest(v_affected_accounts))::integer;
END;
$$;

-- Execute the backfill
DO $$
DECLARE
  v_result record;
BEGIN
  SELECT * INTO v_result FROM backfill_categorized_transaction_journal_entries();
  
  RAISE NOTICE 'Backfill complete: % transactions processed, % journal entries created, % accounts updated',
    v_result.transactions_processed,
    v_result.journal_entries_created,
    v_result.accounts_updated;
END $$;

-- Drop the temporary function
DROP FUNCTION IF EXISTS backfill_categorized_transaction_journal_entries();