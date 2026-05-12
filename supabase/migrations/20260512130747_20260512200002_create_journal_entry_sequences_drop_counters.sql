/*
  # Create journal_entry_sequences table, replace journal_entry_counters

  ## Changes
  - Creates journal_entry_sequences table: one row per profile, one global integer
  - Creates get_next_je_number() function that returns formatted 'JE-XXXX' strings
  - Keeps journal_entry_counters table in place for now (dropped in backfill migration)
    since existing code may reference it until the backfill completes

  ## Numbering Format
  - All entries use 'JE-XXXX' format padded to 4 digits (grows beyond 4 as needed)
  - Single global sequence per profile — no per-type splitting
*/

CREATE TABLE IF NOT EXISTS journal_entry_sequences (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE journal_entry_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sequences for their profiles"
  ON journal_entry_sequences FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- Function: atomically get the next JE number for a profile
-- Returns formatted string like 'JE-0001', 'JE-0042', 'JE-1234'
CREATE OR REPLACE FUNCTION get_next_je_number(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO journal_entry_sequences (profile_id, last_number)
  VALUES (p_profile_id, 1)
  ON CONFLICT (profile_id) DO UPDATE
    SET last_number = journal_entry_sequences.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN 'JE-' || LPAD(v_next::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION get_next_je_number TO authenticated;
