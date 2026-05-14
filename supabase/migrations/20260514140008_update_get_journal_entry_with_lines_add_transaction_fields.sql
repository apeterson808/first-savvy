/*
  # Update get_journal_entry_with_lines to include transaction metadata

  Adds the following fields to the returned JSON so the UI can:
  - Look up transaction audit logs via transaction_id
  - Show the correct status badge (status)
  - Display memo and edited_at
  - Show created_by_user_id for actor attribution
*/

CREATE OR REPLACE FUNCTION get_journal_entry_with_lines(p_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id',                  je.id,
    'profile_id',          je.profile_id,
    'user_id',             je.user_id,
    'created_by_user_id',  je.created_by_user_id,
    'entry_date',          je.entry_date,
    'entry_number',        je.entry_number,
    'description',         je.description,
    'memo',                je.memo,
    'entry_type',          je.entry_type,
    'source',              je.source,
    'status',              je.status,
    'created_at',          je.created_at,
    'updated_at',          je.updated_at,
    'edited_at',           je.edited_at,
    'transaction_id',      t.id,
    'lines', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',            jel.id,
          'line_number',   jel.line_number,
          'account_id',    jel.account_id,
          'account_number',ucoa.account_number,
          'account_name',  COALESCE(ucoa.display_name, tmpl.display_name),
          'account_icon',  ucoa.icon,
          'account_color', ucoa.color,
          'debit_amount',  jel.debit_amount,
          'credit_amount', jel.credit_amount,
          'description',   jel.description
        ) ORDER BY jel.line_number
      )
      FROM journal_entry_lines jel
      JOIN user_chart_of_accounts ucoa ON jel.account_id = ucoa.id
      LEFT JOIN chart_of_accounts_templates tmpl ON ucoa.template_account_number = tmpl.account_number
      WHERE jel.journal_entry_id = je.id
    ),
    'total_debits', (
      SELECT COALESCE(SUM(debit_amount), 0)
      FROM journal_entry_lines WHERE journal_entry_id = je.id
    ),
    'total_credits', (
      SELECT COALESCE(SUM(credit_amount), 0)
      FROM journal_entry_lines WHERE journal_entry_id = je.id
    )
  ) INTO v_result
  FROM journal_entries je
  LEFT JOIN transactions t ON (t.journal_entry_id = je.id OR t.current_journal_entry_id = je.id)
  WHERE je.id = p_entry_id
  LIMIT 1;

  RETURN v_result;
END;
$$;
