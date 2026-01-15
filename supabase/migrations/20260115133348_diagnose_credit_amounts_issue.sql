/*
  # Diagnose Credit Amounts Issue

  This diagnostic migration checks the state of journal entries to identify
  why credit amounts might not be showing up in the account register.

  Checks:
  1. Count of journal lines with NULL credit vs NULL debit
  2. Count of journal entries where all lines have NULL credits
  3. Sample of journal entries with missing credits
  4. Validation of double-entry bookkeeping (debits = credits per entry)
*/

-- Check 1: Count of lines with NULL credit vs NULL debit
DO $$
DECLARE
  v_null_credit_count integer;
  v_null_debit_count integer;
  v_both_null_count integer;
  v_both_set_count integer;
  v_total_lines integer;
BEGIN
  SELECT COUNT(*) INTO v_total_lines FROM journal_entry_lines;
  SELECT COUNT(*) INTO v_null_credit_count FROM journal_entry_lines WHERE credit_amount IS NULL;
  SELECT COUNT(*) INTO v_null_debit_count FROM journal_entry_lines WHERE debit_amount IS NULL;
  SELECT COUNT(*) INTO v_both_null_count FROM journal_entry_lines WHERE credit_amount IS NULL AND debit_amount IS NULL;
  SELECT COUNT(*) INTO v_both_set_count FROM journal_entry_lines WHERE credit_amount IS NOT NULL AND debit_amount IS NOT NULL;

  RAISE NOTICE '=== JOURNAL ENTRY LINES ANALYSIS ===';
  RAISE NOTICE 'Total lines: %', v_total_lines;
  RAISE NOTICE 'Lines with NULL credit: % (%.1f%%)', v_null_credit_count, (v_null_credit_count::float / NULLIF(v_total_lines, 0) * 100);
  RAISE NOTICE 'Lines with NULL debit: % (%.1f%%)', v_null_debit_count, (v_null_debit_count::float / NULLIF(v_total_lines, 0) * 100);
  RAISE NOTICE 'Lines with BOTH NULL: %', v_both_null_count;
  RAISE NOTICE 'Lines with BOTH set: %', v_both_set_count;
END $$;

-- Check 2: Identify journal entries with imbalanced debits/credits
DO $$
DECLARE
  v_imbalanced_count integer;
  v_total_entries integer;
BEGIN
  SELECT COUNT(*) INTO v_total_entries FROM journal_entries;

  SELECT COUNT(DISTINCT je.id) INTO v_imbalanced_count
  FROM journal_entries je
  WHERE ABS(
    COALESCE((SELECT SUM(debit_amount) FROM journal_entry_lines WHERE journal_entry_id = je.id), 0) -
    COALESCE((SELECT SUM(credit_amount) FROM journal_entry_lines WHERE journal_entry_id = je.id), 0)
  ) > 0.01;

  RAISE NOTICE '';
  RAISE NOTICE '=== JOURNAL ENTRY BALANCE ANALYSIS ===';
  RAISE NOTICE 'Total entries: %', v_total_entries;
  RAISE NOTICE 'Imbalanced entries (debits != credits): % (%.1f%%)', v_imbalanced_count, (v_imbalanced_count::float / NULLIF(v_total_entries, 0) * 100);
END $$;

-- Check 3: Sample entries with issues
DO $$
DECLARE
  v_sample record;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== SAMPLE ENTRIES WITH ONLY DEBITS (NO CREDITS) ===';

  FOR v_sample IN
    SELECT
      je.entry_number,
      je.entry_date,
      je.description,
      (SELECT SUM(debit_amount) FROM journal_entry_lines WHERE journal_entry_id = je.id) as total_debits,
      (SELECT SUM(credit_amount) FROM journal_entry_lines WHERE journal_entry_id = je.id) as total_credits,
      (SELECT COUNT(*) FROM journal_entry_lines WHERE journal_entry_id = je.id AND credit_amount IS NOT NULL) as credit_line_count
    FROM journal_entries je
    WHERE EXISTS (
      SELECT 1 FROM journal_entry_lines jel
      WHERE jel.journal_entry_id = je.id
      AND jel.debit_amount IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM journal_entry_lines jel2
      WHERE jel2.journal_entry_id = je.id
      AND jel2.credit_amount IS NOT NULL
    )
    ORDER BY je.entry_date DESC
    LIMIT 5
  LOOP
    RAISE NOTICE 'Entry: %, Date: %, Desc: %, Debits: %, Credits: %, Credit lines: %',
      v_sample.entry_number, v_sample.entry_date, v_sample.description,
      v_sample.total_debits, v_sample.total_credits, v_sample.credit_line_count;
  END LOOP;
END $$;

-- Check 4: Verify constraint is working
DO $$
DECLARE
  v_has_constraint boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'line_has_debit_or_credit'
  ) INTO v_has_constraint;

  RAISE NOTICE '';
  RAISE NOTICE '=== CONSTRAINT CHECK ===';
  RAISE NOTICE 'line_has_debit_or_credit constraint exists: %', v_has_constraint;
END $$;

COMMENT ON COLUMN journal_entry_lines.debit_amount IS 'Debit amount (NULL if this line is a credit)';
COMMENT ON COLUMN journal_entry_lines.credit_amount IS 'Credit amount (NULL if this line is a debit)';
