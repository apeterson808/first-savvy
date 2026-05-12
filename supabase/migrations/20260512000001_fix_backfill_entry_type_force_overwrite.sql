/*
  # Re-backfill entry_type and entry_number with correct direction logic

  ## Problem
  Earlier backfills ran in the wrong order — the first used amount <= 0 for liability
  charges (wrong), the second skipped entries already set to a non-adjustment type.
  So PMT-0001 entries that should be CHG-0001 were never corrected.

  Direction rules:
  - asset/bank:  amount >= 0 → deposit,  amount < 0 → withdrawal
  - liability:   amount < 0  → charge,   amount >= 0 → payment
  - expense:     amount >= 0 → expense,  amount < 0  → refund
*/

UPDATE journal_entries je
SET entry_type = CASE
  WHEN t.type = 'transfer' THEN 'transfer'
  WHEN ca.class IN ('asset', 'bank') THEN
    CASE WHEN t.amount >= 0 THEN 'deposit' ELSE 'withdrawal' END
  WHEN ca.class = 'liability' THEN
    CASE WHEN t.amount < 0 THEN 'charge' ELSE 'payment' END
  WHEN ca.class = 'expense' THEN
    CASE WHEN t.amount >= 0 THEN 'expense' ELSE 'refund' END
  ELSE 'adjustment'
END
FROM transactions t
JOIN user_chart_of_accounts ca ON ca.id = t.bank_account_id
WHERE t.journal_entry_id = je.id
  AND je.entry_type != 'opening_balance';

UPDATE journal_entries je
SET entry_number = (
  CASE je.entry_type
    WHEN 'deposit'    THEN 'DEP'
    WHEN 'withdrawal' THEN 'WD'
    WHEN 'charge'     THEN 'CHG'
    WHEN 'payment'    THEN 'PMT'
    WHEN 'expense'    THEN 'EXP'
    WHEN 'refund'     THEN 'RFD'
    WHEN 'transfer'   THEN 'TRF'
    ELSE LEFT(je.entry_number, POSITION('-' IN je.entry_number) - 1)
  END
  || SUBSTRING(je.entry_number FROM POSITION('-' IN je.entry_number))
)
FROM transactions t
WHERE t.journal_entry_id = je.id
  AND je.entry_type != 'opening_balance'
  AND je.entry_number NOT LIKE (
    CASE je.entry_type
      WHEN 'deposit'    THEN 'DEP-%'
      WHEN 'withdrawal' THEN 'WD-%'
      WHEN 'charge'     THEN 'CHG-%'
      WHEN 'payment'    THEN 'PMT-%'
      WHEN 'expense'    THEN 'EXP-%'
      WHEN 'refund'     THEN 'RFD-%'
      WHEN 'transfer'   THEN 'TRF-%'
      ELSE 'ADJ-%'
    END
  );
