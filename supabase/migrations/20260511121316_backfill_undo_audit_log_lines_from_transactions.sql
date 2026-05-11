/*
  # Backfill undo audit log lines from transactions.amount

  ## Problem
  Existing undo audit logs have empty `lines: []` because amounts were not
  captured before deleting the journal entry. The transaction record still
  has the original amount.

  ## Fix
  1. Backfill metadata.lines for existing undo rows using transactions.amount
     and transactions.type (expense = credit on liability).
  2. Update get_account_audit_history_paginated to also fall back to
     transactions.amount when metadata.lines is empty.
*/

-- Backfill lines from transactions.amount for undo logs that have empty lines
DO $$
DECLARE
  r RECORD;
  v_lines jsonb;
  v_account_id uuid;
BEGIN
  FOR r IN
    SELECT
      al.id,
      al.metadata,
      al.entity_id as transaction_id,
      t.amount,
      t.type,
      t.bank_account_id
    FROM audit_logs al
    JOIN transactions t ON t.id = al.entity_id
    WHERE al.action = 'undo_transaction'
    AND al.profile_id = '761b9597-16b7-454d-9a64-861b60cffe13'
    AND (al.metadata->'lines' = '[]'::jsonb OR al.metadata->'lines' IS NULL)
    AND t.amount IS NOT NULL
  LOOP
    -- For expense transactions on a liability account: credit_amount = amount
    -- (charges = credits on a liability like a credit card)
    v_lines := jsonb_build_array(jsonb_build_object(
      'account_id', r.bank_account_id,
      'debit_amount', NULL,
      'credit_amount', r.amount,
      'line_number', 1
    ));

    UPDATE audit_logs
    SET metadata = metadata || jsonb_build_object('lines', v_lines)
    WHERE id = r.id;
  END LOOP;
END $$;
