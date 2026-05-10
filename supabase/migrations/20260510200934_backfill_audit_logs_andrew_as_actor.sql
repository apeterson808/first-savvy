/*
  # Backfill Audit Logs — Andrew as Actor for All Existing Journal Entries

  ## Context
  Audit logging for post_transaction was never implemented until now. All existing
  journal entries were created by Andrew (petersonandrew@hotmail.com, user id
  63ce77df-c1b4-41c5-938c-10ffb5b14c8c). This migration inserts a post_transaction
  audit_log row for every journal entry that doesn't already have one, attributed
  to Andrew.

  ## What this inserts
  One audit_logs row per journal_entry, with:
  - action = 'post_transaction'
  - actor_display_name = 'Andrew'
  - entity_type = 'transaction'  (entity_id = the linked transaction id if any,
    otherwise the journal entry id itself)
  - metadata includes entry_number and journal_entry_id

  Rows that already have a post_transaction entry for the same entity are skipped
  via the NOT EXISTS guard.
*/

DO $$
DECLARE
  v_andrew_id uuid := '63ce77df-c1b4-41c5-938c-10ffb5b14c8c';
BEGIN
  INSERT INTO audit_logs (
    profile_id,
    user_id,
    actor_display_name,
    action,
    entity_type,
    entity_id,
    description,
    metadata
  )
  SELECT
    je.profile_id,
    v_andrew_id,
    'Andrew',
    'post_transaction',
    'transaction',
    COALESCE(t.id, je.id),
    je.entry_number || ': ' || COALESCE(je.description, ''),
    jsonb_build_object(
      'entry_number', je.entry_number,
      'journal_entry_id', je.id,
      'transaction_id', t.id,
      'backfilled', true
    )
  FROM journal_entries je
  LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
    OR t.journal_entry_id = je.id
  WHERE NOT EXISTS (
    SELECT 1 FROM audit_logs al
    WHERE al.action = 'post_transaction'
      AND (al.metadata->>'journal_entry_id')::uuid = je.id
  )
  -- Only backfill adjustment/transfer types (not opening balances created by the system)
  AND je.entry_type IN ('adjustment', 'transfer', 'credit_card_payment');
END $$;
