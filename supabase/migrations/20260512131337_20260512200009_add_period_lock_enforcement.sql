/*
  # Add period lock enforcement on journal_entries UPDATE

  ## Overview
  Adds a trigger that checks accounting_periods before allowing edits to journal entries.
  If the entry's date falls within a locked period for that profile, the edit is blocked.

  ## Behavior
  - Fires BEFORE UPDATE on journal_entries
  - Checks if entry_date falls in a locked accounting_period for the profile
  - If locked: raises exception
  - If status is being changed from 'locked' back to 'posted' (unlocking): allows it

  ## Period Lock Management Functions
  - lock_accounting_period(period_id)
  - unlock_accounting_period(period_id)
  - create_accounting_period(profile_id, period_name, start_date, end_date)
*/

-- Trigger to block edits to JEs in locked periods
CREATE OR REPLACE FUNCTION enforce_period_lock_on_je_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_locked boolean;
BEGIN
  -- Allow unlock operation: locked → posted
  IF OLD.status = 'locked' AND NEW.status = 'posted' THEN
    RETURN NEW;
  END IF;

  -- Block all edits to locked JEs
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Cannot edit journal entry: the accounting period is locked. Unlock the period first.';
  END IF;

  -- Check if the new entry_date falls in a locked period
  SELECT EXISTS(
    SELECT 1 FROM accounting_periods
    WHERE profile_id = NEW.profile_id
      AND is_locked = true
      AND NEW.entry_date BETWEEN start_date AND end_date
  ) INTO v_is_locked;

  IF v_is_locked THEN
    RAISE EXCEPTION 'Cannot edit journal entry: the accounting period containing % is locked. Unlock the period first.',
      NEW.entry_date;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lock_on_je_update_trigger ON journal_entries;
CREATE TRIGGER enforce_period_lock_on_je_update_trigger
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION enforce_period_lock_on_je_update();

-- Function to lock an accounting period
CREATE OR REPLACE FUNCTION lock_accounting_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period record;
BEGIN
  SELECT * INTO v_period FROM accounting_periods WHERE id = p_period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accounting period not found';
  END IF;

  IF NOT has_profile_access(v_period.profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Lock all posted JEs in this period
  UPDATE journal_entries
  SET status = 'locked'
  WHERE profile_id = v_period.profile_id
    AND entry_date BETWEEN v_period.start_date AND v_period.end_date
    AND status = 'posted';

  UPDATE accounting_periods
  SET is_locked = true, lock_date = CURRENT_DATE, updated_at = now()
  WHERE id = p_period_id;

  RETURN jsonb_build_object('success', true, 'period_id', p_period_id, 'locked', true);
END;
$$;

GRANT EXECUTE ON FUNCTION lock_accounting_period TO authenticated;

-- Function to unlock an accounting period
CREATE OR REPLACE FUNCTION unlock_accounting_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period record;
BEGIN
  SELECT * INTO v_period FROM accounting_periods WHERE id = p_period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accounting period not found';
  END IF;

  IF NOT has_profile_access(v_period.profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Restore locked JEs to posted
  UPDATE journal_entries
  SET status = 'posted'
  WHERE profile_id = v_period.profile_id
    AND entry_date BETWEEN v_period.start_date AND v_period.end_date
    AND status = 'locked';

  UPDATE accounting_periods
  SET is_locked = false, lock_date = NULL, updated_at = now()
  WHERE id = p_period_id;

  RETURN jsonb_build_object('success', true, 'period_id', p_period_id, 'locked', false);
END;
$$;

GRANT EXECUTE ON FUNCTION unlock_accounting_period TO authenticated;

-- Function to create an accounting period
CREATE OR REPLACE FUNCTION create_accounting_period(
  p_profile_id uuid,
  p_period_name text,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id uuid;
BEGIN
  IF NOT has_profile_access(p_profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO accounting_periods (profile_id, period_name, start_date, end_date, is_locked)
  VALUES (p_profile_id, p_period_name, p_start_date, p_end_date, false)
  RETURNING id INTO v_period_id;

  RETURN jsonb_build_object('success', true, 'period_id', v_period_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_accounting_period TO authenticated;
