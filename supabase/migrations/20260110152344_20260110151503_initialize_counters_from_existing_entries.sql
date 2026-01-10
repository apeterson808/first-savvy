/*
  # Initialize Journal Entry Counters from Existing Data

  ## Purpose
  Scan existing journal_entries and initialize counters for each profile/entry_type.
  Sets next_number to the highest existing number + 1 for each type.

  ## Process
  1. Parse existing entry_numbers to extract type and number
  2. Find max number for each profile/type combination
  3. Insert counters with next_number = max + 1

  ## Entry Number Formats to Parse
  - Old format: JE-0001, JE-0002 (maps to 'adjustment')
  - New format: ADJ-0001, TRF-0001, OB-0001, etc.
*/

DO $$
DECLARE
  v_profile_record record;
  v_entry_type text;
  v_max_number integer;
  v_prefix text;
BEGIN
  -- For each profile, initialize counters for each entry type
  FOR v_profile_record IN
    SELECT DISTINCT profile_id FROM journal_entries
  LOOP
    -- Process each valid entry type
    FOR v_entry_type IN
      SELECT unnest(ARRAY['opening_balance', 'adjustment', 'transfer', 'reclassification', 'closing', 'depreciation', 'accrual', 'reversal'])
    LOOP
      -- Determine prefix for this entry type
      v_prefix := CASE v_entry_type
        WHEN 'opening_balance' THEN 'OB'
        WHEN 'adjustment' THEN 'ADJ'
        WHEN 'transfer' THEN 'TRF'
        WHEN 'reclassification' THEN 'RCL'
        WHEN 'closing' THEN 'CLS'
        WHEN 'depreciation' THEN 'DEP'
        WHEN 'accrual' THEN 'ACR'
        WHEN 'reversal' THEN 'REV'
      END;

      -- Find max number for this profile and entry type
      -- Handle both old format (JE-) and new format (ADJ-, TRF-, etc.)
      SELECT COALESCE(
        MAX(
          CAST(
            REGEXP_REPLACE(
              SPLIT_PART(entry_number, '-', 2),
              '[^0-9]',
              '',
              'g'
            ) AS INTEGER
          )
        ),
        0
      )
      INTO v_max_number
      FROM journal_entries
      WHERE profile_id = v_profile_record.profile_id
        AND (
          -- Match new format with correct prefix
          entry_number LIKE v_prefix || '-%'
          OR
          -- Map old JE- format to adjustment type
          (v_entry_type = 'adjustment' AND entry_number LIKE 'JE-%')
          OR
          -- Match by actual entry_type if not following naming convention
          (entry_type = v_entry_type)
        );

      -- Insert counter if max_number > 0 (entries exist for this type)
      IF v_max_number > 0 THEN
        INSERT INTO journal_entry_counters (profile_id, entry_type, next_number)
        VALUES (v_profile_record.profile_id, v_entry_type, v_max_number + 1)
        ON CONFLICT (profile_id, entry_type) DO UPDATE
        SET next_number = GREATEST(journal_entry_counters.next_number, EXCLUDED.next_number);
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Journal entry counters initialized successfully';
END $$;
