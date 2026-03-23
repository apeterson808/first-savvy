/*
  # Fix Auto Journal Entry Function - Remove cc_payment_pair_id Reference

  1. Changes
    - Update `auto_create_journal_entry_from_transaction` function
    - Replace `NEW.cc_payment_pair_id` with `NEW.paired_transfer_id`
    - This fixes the error: "record 'new' has no field 'cc_payment_pair_id'"
    
  2. Notes
    - The function is a trigger that runs on INSERT/UPDATE of transactions
    - The old column cc_payment_pair_id was replaced by paired_transfer_id
    - Function logic remains the same, just updating the column reference
*/

CREATE OR REPLACE FUNCTION auto_create_journal_entry_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
v_counter_entry_type text;
v_je_entry_type text;
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
-- Determine entry types (counter type vs journal entry type)
-- =========================================================================
IF NEW.type = 'transfer' THEN
v_counter_entry_type := 'transfer';
v_je_entry_type := 'transfer';
ELSIF NEW.paired_transfer_id IS NOT NULL THEN
v_counter_entry_type := 'adjustment';
v_je_entry_type := 'adjustment';
ELSE
v_counter_entry_type := 'adjustment';
v_je_entry_type := 'adjustment';
END IF;

-- Generate entry number using valid counter type
v_entry_number := generate_journal_entry_number(NEW.profile_id, v_counter_entry_type);

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
NEW.date,
v_entry_number,
COALESCE(NEW.description, NEW.original_description),
v_je_entry_type,
CASE
WHEN NEW.source = 'import' THEN 'import'
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
-- Handle split transactions
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
-- Update transaction with ALL journal entry references
-- =========================================================================
NEW.journal_entry_id := v_journal_entry_id;
NEW.current_journal_entry_id := v_journal_entry_id;

-- Set original_journal_entry_id only if this is the first time posting
IF NEW.original_journal_entry_id IS NULL THEN
NEW.original_journal_entry_id := v_journal_entry_id;
END IF;

RETURN NEW;
END;
$function$;
