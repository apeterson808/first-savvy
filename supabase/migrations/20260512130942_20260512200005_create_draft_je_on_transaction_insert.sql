/*
  # Create draft JE on transaction INSERT trigger

  ## Overview
  Replaces the old trigger that only created JEs when posting.
  Now every transaction gets a JE immediately on INSERT with status='draft'.

  ## Behavior
  - Fires BEFORE INSERT on transactions
  - Assigns JE-XXXX number immediately from the global sequence
  - Creates a draft journal entry with two lines:
    1. Bank/account side (debit or credit based on account class and transaction type)
    2. Category account OR Uncategorized Transactions suspense if no category
  - Sets transaction.journal_entry_id, current_journal_entry_id, original_journal_entry_id

  ## Suspense Account
  Uses account_number=9999 (Uncategorized Transactions, is_system_account=true) as the
  offset when no category is assigned. When the user later categorizes the transaction,
  the JE sync trigger replaces the suspense line with the real category line.

  ## Status Defaults
  - Transactions default to 'pending' status (changed from 'posted' default)
  - JEs created by this trigger always start as 'draft'
*/

-- Change the default status on transactions from 'posted' to 'pending'
ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'pending';

-- Drop the old trigger that created JEs only at post time
DROP TRIGGER IF EXISTS auto_create_journal_entry_trigger ON transactions;

-- Core function: determine debit/credit direction for a line
-- Returns true if the amount should be a debit, false if credit
-- For the BANK side of a transaction:
--   asset/bank: money out = credit (expense/withdrawal), money in = debit (income/deposit)
--   liability: charge (expense) = credit (balance goes up), payment (income) = debit
-- For the CATEGORY side it's the mirror image
CREATE OR REPLACE FUNCTION get_je_debit_side_for_bank(
  p_account_class text,
  p_transaction_type text,
  p_amount numeric
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  CASE p_account_class
    WHEN 'asset', 'bank' THEN
      -- positive amount = deposit/income = debit bank
      -- negative or expense = withdrawal = credit bank
      RETURN (p_transaction_type = 'income' OR p_amount > 0);
    WHEN 'liability' THEN
      -- payment (paying off card) = debit liability (reduces balance)
      -- charge (buying on card) = credit liability (increases balance)
      RETURN (p_transaction_type = 'income' OR p_transaction_type = 'payment');
    ELSE
      RETURN (p_amount > 0);
  END CASE;
END;
$$;

-- Main trigger function: create draft JE on transaction insert
CREATE OR REPLACE FUNCTION create_draft_je_on_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_je_id uuid;
  v_entry_number text;
  v_bank_class text;
  v_category_class text;
  v_suspense_id uuid;
  v_offset_account_id uuid;
  v_bank_is_debit boolean;
  v_line_num integer := 1;
  v_amount numeric;
BEGIN
  -- Don't create JE for voided transactions
  IF NEW.status = 'voided' THEN
    RETURN NEW;
  END IF;

  -- Skip if JE already assigned (shouldn't happen on INSERT but be safe)
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Need a bank account to create JE
  IF NEW.bank_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_amount := ABS(COALESCE(NEW.amount, 0));
  IF v_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Get bank account class
  SELECT class INTO v_bank_class
  FROM user_chart_of_accounts WHERE id = NEW.bank_account_id;

  IF v_bank_class IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find suspense account for this profile
  SELECT id INTO v_suspense_id
  FROM user_chart_of_accounts
  WHERE profile_id = NEW.profile_id
    AND account_number = 9999
    AND is_system_account = true
  LIMIT 1;

  -- Determine the offset account
  IF NEW.category_account_id IS NOT NULL THEN
    v_offset_account_id := NEW.category_account_id;
    SELECT class INTO v_category_class
    FROM user_chart_of_accounts WHERE id = NEW.category_account_id;
  ELSIF v_suspense_id IS NOT NULL THEN
    v_offset_account_id := v_suspense_id;
    v_category_class := 'expense'; -- suspense is expense-side
  ELSE
    -- No suspense account seeded yet — skip JE creation
    RETURN NEW;
  END IF;

  -- Get the JE number
  v_entry_number := get_next_je_number(NEW.profile_id);

  -- Determine direction for bank side
  v_bank_is_debit := get_je_debit_side_for_bank(v_bank_class, COALESCE(NEW.type, 'expense'), NEW.amount);

  -- Create the draft journal entry
  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source,
    status
  ) VALUES (
    NEW.profile_id,
    COALESCE(NEW.user_id, auth.uid()),
    NEW.date,
    v_entry_number,
    COALESCE(NEW.description, NEW.original_description, ''),
    CASE NEW.type
      WHEN 'transfer' THEN 'transfer'
      WHEN 'income'   THEN 'deposit'
      WHEN 'expense'  THEN
        CASE v_bank_class
          WHEN 'liability' THEN 'charge'
          ELSE 'withdrawal'
        END
      ELSE 'adjustment'
    END,
    CASE
      WHEN NEW.source = 'import' THEN 'import'
      WHEN NEW.source = 'manual' THEN 'manual'
      ELSE 'system'
    END,
    'draft'
  )
  RETURNING id INTO v_je_id;

  -- Line 1: Category / suspense side
  IF v_category_class IN ('expense', 'asset') THEN
    -- Expense/asset = debit when spending, credit when refunding
    INSERT INTO journal_entry_lines (
      journal_entry_id, profile_id, user_id, account_id, line_number,
      debit_amount, description
    ) VALUES (
      v_je_id, NEW.profile_id, COALESCE(NEW.user_id, auth.uid()),
      v_offset_account_id, v_line_num,
      v_amount, COALESCE(NEW.description, NEW.original_description, '')
    );
  ELSE
    -- Income/liability = credit
    INSERT INTO journal_entry_lines (
      journal_entry_id, profile_id, user_id, account_id, line_number,
      credit_amount, description
    ) VALUES (
      v_je_id, NEW.profile_id, COALESCE(NEW.user_id, auth.uid()),
      v_offset_account_id, v_line_num,
      v_amount, COALESCE(NEW.description, NEW.original_description, '')
    );
  END IF;

  v_line_num := v_line_num + 1;

  -- Line 2: Bank side (mirror of category)
  IF v_bank_is_debit THEN
    INSERT INTO journal_entry_lines (
      journal_entry_id, profile_id, user_id, account_id, line_number,
      debit_amount, description
    ) VALUES (
      v_je_id, NEW.profile_id, COALESCE(NEW.user_id, auth.uid()),
      NEW.bank_account_id, v_line_num,
      v_amount, COALESCE(NEW.description, NEW.original_description, '')
    );
  ELSE
    INSERT INTO journal_entry_lines (
      journal_entry_id, profile_id, user_id, account_id, line_number,
      credit_amount, description
    ) VALUES (
      v_je_id, NEW.profile_id, COALESCE(NEW.user_id, auth.uid()),
      NEW.bank_account_id, v_line_num,
      v_amount, COALESCE(NEW.description, NEW.original_description, '')
    );
  END IF;

  -- Assign JE back to transaction
  NEW.journal_entry_id := v_je_id;
  NEW.current_journal_entry_id := v_je_id;
  IF NEW.original_journal_entry_id IS NULL THEN
    NEW.original_journal_entry_id := v_je_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger (BEFORE INSERT so we can set the FK columns)
DROP TRIGGER IF EXISTS create_draft_je_on_insert_trigger ON transactions;
CREATE TRIGGER create_draft_je_on_insert_trigger
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_draft_je_on_transaction_insert();
