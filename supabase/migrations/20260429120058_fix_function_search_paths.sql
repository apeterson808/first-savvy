/*
  # Fix Mutable Search Path on Functions

  ## Summary
  Sets an explicit, immutable search_path on 6 functions that were flagged for having
  a role-mutable search_path. Without SET search_path, a malicious user could potentially
  manipulate which objects (tables, functions) are resolved by name inside these functions.

  ## Functions Fixed
  1. update_child_profile_updated_at - trigger function for child_profiles updated_at
  2. update_chores_updated_at - trigger function for tasks/chores updated_at
  3. validate_transfer_pairing - trigger validating bidirectional transfer pairs
  4. find_opposite_amount_matches - finds matching opposite-amount transactions
  5. approve_task_completion - approves a task completion and awards stars
  6. extract_merchant_pattern - extracts a normalised merchant name from a description

  All functions are recreated identically except for the addition of
  SET search_path = public, pg_catalog.
*/

-- 1. update_child_profile_updated_at
CREATE OR REPLACE FUNCTION public.update_child_profile_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. update_chores_updated_at
CREATE OR REPLACE FUNCTION public.update_chores_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. validate_transfer_pairing
CREATE OR REPLACE FUNCTION public.validate_transfer_pairing()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.paired_transfer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE id = NEW.paired_transfer_id
        AND (paired_transfer_id = NEW.id OR paired_transfer_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Invalid transfer pairing: paired transaction must exist and allow bidirectional link';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. find_opposite_amount_matches
CREATE OR REPLACE FUNCTION public.find_opposite_amount_matches(p_transaction_id uuid)
  RETURNS TABLE(
    id uuid, date date, description text, amount numeric, type text,
    bank_account_id uuid, category_account_id uuid, contact_id uuid,
    status text, date_diff integer
  )
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
DECLARE
  v_transaction record;
BEGIN
  SELECT t.amount, t.bank_account_id, t.profile_id, t.date, t.paired_transfer_id
  INTO v_transaction
  FROM transactions t
  WHERE t.id = p_transaction_id;

  IF NOT FOUND OR v_transaction.paired_transfer_id IS NOT NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.date,
    t.description,
    t.amount,
    t.type,
    t.bank_account_id,
    t.category_account_id,
    t.contact_id,
    t.status,
    ABS(t.date - v_transaction.date) AS date_diff
  FROM transactions t
  WHERE
    t.id != p_transaction_id
    AND t.amount = -1 * v_transaction.amount
    AND t.bank_account_id != v_transaction.bank_account_id
    AND t.profile_id = v_transaction.profile_id
    AND t.status = 'pending'
    AND t.type = 'transfer'
    AND ABS(t.date - v_transaction.date) <= 7
    AND t.paired_transfer_id IS NULL
  ORDER BY date_diff ASC, t.date DESC
  LIMIT 10;
END;
$$;

-- 5. approve_task_completion
CREATE OR REPLACE FUNCTION public.approve_task_completion(
  p_completion_id uuid,
  p_review_notes text DEFAULT NULL
)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
DECLARE
  v_completion  task_completions%ROWTYPE;
  v_task        tasks%ROWTYPE;
  v_child_stars int;
  v_new_balance int;
  v_new_status  text;
BEGIN
  SELECT * INTO v_completion
  FROM task_completions
  WHERE id = p_completion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'completion not found: %', p_completion_id;
  END IF;

  SELECT * INTO v_task
  FROM tasks
  WHERE id = v_completion.task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found: %', v_completion.task_id;
  END IF;

  UPDATE task_completions
  SET
    status       = 'approved',
    reviewed_at  = now(),
    review_notes = p_review_notes
  WHERE id = p_completion_id;

  SELECT stars_balance INTO v_child_stars
  FROM child_profiles
  WHERE id = v_completion.child_profile_id;

  v_new_balance := COALESCE(v_child_stars, 0) + COALESCE(v_completion.stars_earned, 0);

  UPDATE child_profiles
  SET
    stars_balance = v_new_balance,
    stars_pending = GREATEST(0, COALESCE(stars_pending, 0) - COALESCE(v_completion.stars_earned, 0))
  WHERE id = v_completion.child_profile_id;

  IF v_task.reset_mode = 'instant'
     OR v_task.repeatable = true
     OR v_task.frequency  = 'always_available'
  THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'approved';
  END IF;

  UPDATE tasks
  SET
    status       = v_new_status,
    approved_at  = now(),
    completed_at = NULL
  WHERE id = v_task.id;

  RETURN json_build_object(
    'ok',            true,
    'stars_balance', v_new_balance,
    'task_status',   v_new_status
  );
END;
$$;

-- 6. extract_merchant_pattern
CREATE OR REPLACE FUNCTION public.extract_merchant_pattern(description text)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path = public, pg_catalog
AS $$
BEGIN
  description := REGEXP_REPLACE(description, '^(PAYMENT TO|TRANSFER TO|FROM|TO|DEBIT|CREDIT)\s+', '', 'gi');
  description := REGEXP_REPLACE(description, '\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', '', 'g');
  description := REGEXP_REPLACE(description, '#\d+', '', 'g');
  description := REGEXP_REPLACE(description, 'REF\s*:?\s*\d+', '', 'gi');
  description := REGEXP_REPLACE(description, '\s+[A-Z]{2}\s*$', '', 'g');
  description := REGEXP_REPLACE(description, '\s+', ' ', 'g');
  description := TRIM(description);
  IF LENGTH(description) > 50 THEN
    description := LEFT(description, 50);
  END IF;
  RETURN UPPER(description);
END;
$$;
