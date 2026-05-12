/*
  # Fix recalculate_account_balance to exclude draft journal entries

  ## Problem
  The recalculate_account_balance function sums ALL journal_entry_lines regardless
  of the parent journal entry's status. With the new JE-first architecture, every
  pending transaction gets a draft JE immediately on insert — so income and expense
  accounts were showing balances from those draft entries even though no transactions
  had been posted.

  ## Fix
  Add a JOIN to journal_entries and filter to only status IN ('posted', 'locked').
  Draft and voided JEs must never contribute to account balances.

  This is consistent with the audit history filter added in migration
  20260512210001_filter_draft_jes_from_audit_history.
*/

CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric := 0;
  v_account_class text;
BEGIN
  SELECT LOWER(class) INTO v_account_class
  FROM public.user_chart_of_accounts
  WHERE id = p_account_id;

  IF v_account_class IN ('asset', 'expense') THEN
    SELECT COALESCE(
      SUM(COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)),
      0
    )
    INTO v_balance
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = p_account_id
      AND je.status IN ('posted', 'locked');
  ELSE
    SELECT COALESCE(
      SUM(COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)),
      0
    )
    INTO v_balance
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = p_account_id
      AND je.status IN ('posted', 'locked');
  END IF;

  RETURN v_balance;
END;
$$;

-- Recalculate all account balances now that the function is fixed
DO $$
DECLARE
  v_account_id uuid;
BEGIN
  FOR v_account_id IN
    SELECT id FROM public.user_chart_of_accounts
  LOOP
    UPDATE public.user_chart_of_accounts
    SET current_balance = public.recalculate_account_balance(v_account_id)
    WHERE id = v_account_id;
  END LOOP;
END $$;
