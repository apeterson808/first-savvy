/*
  # Backfill Transfer Journal Entries

  ## Problem
  Existing posted transfers don't have journal entries because the trigger
  didn't exist before.

  ## Solution
  Find all posted transfers that:
  1. Have a transfer_pair_id
  2. Don't have a journal_entry_id yet
  3. Have a paired transaction that's also posted
  
  Create journal entries for these transfers.

  ## Safety
  - Only affects transfers (transfer_pair_id IS NOT NULL)
  - Only affects posted transactions (status = 'posted')
  - Only creates entries where none exist yet (journal_entry_id IS NULL)
*/

DO $$
DECLARE
  v_transaction record;
  v_paired_transaction record;
  v_journal_entry_id uuid;
  v_created_count integer := 0;
  v_skipped_count integer := 0;
BEGIN
  -- Find all posted transfers without journal entries
  FOR v_transaction IN
    SELECT *
    FROM transactions
    WHERE transfer_pair_id IS NOT NULL
    AND status = 'posted'
    AND journal_entry_id IS NULL
    ORDER BY date, id
  LOOP
    -- Find the paired transaction
    SELECT * INTO v_paired_transaction
    FROM transactions
    WHERE transfer_pair_id = v_transaction.transfer_pair_id
    AND id != v_transaction.id
    LIMIT 1;

    -- Only create if paired transaction exists and is posted
    IF v_paired_transaction.id IS NOT NULL AND v_paired_transaction.status = 'posted' THEN
      -- Check if journal entry was already created for the pair
      IF v_paired_transaction.journal_entry_id IS NOT NULL THEN
        -- Reuse the existing journal entry
        UPDATE transactions
        SET journal_entry_id = v_paired_transaction.journal_entry_id
        WHERE id = v_transaction.id;
        
        v_skipped_count := v_skipped_count + 1;
      ELSE
        -- Create new journal entry for this transfer pair
        BEGIN
          v_journal_entry_id := create_transfer_journal_entry(
            v_transaction.id,
            v_transaction.profile_id,
            v_transaction.user_id
          );

          IF v_journal_entry_id IS NOT NULL THEN
            v_created_count := v_created_count + 1;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Failed to create journal entry for transfer %: %', v_transaction.id, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete: Created % journal entries, reused % existing entries', v_created_count, v_skipped_count;
END $$;