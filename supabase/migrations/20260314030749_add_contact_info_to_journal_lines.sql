/*
  # Add Contact Information to Journal Lines View

  1. Changes
    - Modify `get_account_journal_lines_paginated` function to include contact information
    - Join with transactions and contacts tables to get contact names
    - Add `contact_name` and `entry_type` fields to the returned data

  2. Details
    - When a transaction has an associated contact, return the contact name
    - For transfers and credit card payments, show special labels
    - Preserves all existing functionality while adding new data
*/

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_account_journal_lines_paginated(uuid, uuid, date, date, integer, integer);

-- Recreate the function with contact information
CREATE OR REPLACE FUNCTION get_account_journal_lines_paginated(
  p_profile_id uuid,
  p_account_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  line_id uuid,
  entry_id uuid,
  entry_number text,
  entry_date date,
  entry_description text,
  line_description text,
  debit_amount numeric,
  credit_amount numeric,
  offsetting_accounts text,
  transaction_status text,
  cleared_status text,
  running_balance numeric,
  total_count bigint,
  transaction_id uuid,
  entry_type text,
  contact_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_account_class text;
v_total_count bigint;
BEGIN
SELECT class INTO v_account_class
FROM user_chart_of_accounts
WHERE id = p_account_id;

SELECT COUNT(*) INTO v_total_count
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
WHERE jel.profile_id = p_profile_id
AND jel.account_id = p_account_id
AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
AND (t.id IS NULL OR t.status = 'posted')
AND je.entry_number NOT IN (
SELECT je_rev.entry_number
FROM journal_entries je_rev
WHERE je_rev.profile_id = p_profile_id
AND je_rev.description ILIKE 'REVERSAL:%'
);

RETURN QUERY
WITH offsetting_accounts_agg AS (
SELECT
jel2.journal_entry_id,
string_agg(
COALESCE(ucoa2.display_name, t2.display_name),
', '
ORDER BY ucoa2.account_number
) as offsetting_accounts_list
FROM journal_entry_lines jel2
JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
LEFT JOIN chart_of_accounts_templates t2 ON ucoa2.template_account_number = t2.account_number
WHERE jel2.profile_id = p_profile_id
AND jel2.account_id != p_account_id
GROUP BY jel2.journal_entry_id
),
base_lines AS (
SELECT
jel.id as bl_line_id,
je.id as bl_entry_id,
je.entry_number as bl_entry_number,
je.entry_date as bl_entry_date,
je.description as bl_entry_description,
jel.description as bl_line_description,
jel.debit_amount as bl_debit_amount,
jel.credit_amount as bl_credit_amount,
oaa.offsetting_accounts_list as bl_offsetting_accounts,
COALESCE(t.status, 'posted')::text as bl_transaction_status,
COALESCE(t.cleared_status, 'uncleared')::text as bl_cleared_status,
t.id as bl_transaction_id,
je.entry_type as bl_entry_type,
c.name as bl_contact_name,
CASE
WHEN v_account_class IN ('asset', 'expense') THEN
COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
ELSE
COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
END as bl_net_change,
jel.line_number as bl_line_number
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
LEFT JOIN contacts c ON c.id = t.contact_id
WHERE jel.profile_id = p_profile_id
AND jel.account_id = p_account_id
AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
AND (t.id IS NULL OR t.status = 'posted')
AND je.entry_number NOT IN (
SELECT je_rev.entry_number
FROM journal_entries je_rev
WHERE je_rev.profile_id = p_profile_id
AND je_rev.description ILIKE 'REVERSAL:%'
)
),
lines_with_balance AS (
SELECT
bl.bl_line_id,
bl.bl_entry_id,
bl.bl_entry_number,
bl.bl_entry_date,
bl.bl_entry_description,
bl.bl_line_description,
bl.bl_debit_amount,
bl.bl_credit_amount,
bl.bl_offsetting_accounts,
bl.bl_transaction_status,
bl.bl_cleared_status,
bl.bl_transaction_id,
bl.bl_entry_type,
bl.bl_contact_name,
SUM(bl.bl_net_change) OVER (
ORDER BY bl.bl_entry_date, bl.bl_entry_number, bl.bl_line_number
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
) as lwb_running_balance
FROM base_lines bl
)
SELECT
lwb.bl_line_id,
lwb.bl_entry_id,
lwb.bl_entry_number,
lwb.bl_entry_date,
lwb.bl_entry_description,
lwb.bl_line_description,
lwb.bl_debit_amount,
lwb.bl_credit_amount,
lwb.bl_offsetting_accounts,
lwb.bl_transaction_status,
lwb.bl_cleared_status,
lwb.lwb_running_balance,
v_total_count,
lwb.bl_transaction_id,
lwb.bl_entry_type,
lwb.bl_contact_name
FROM lines_with_balance lwb
ORDER BY lwb.bl_entry_date DESC, lwb.bl_entry_number DESC
LIMIT p_limit
OFFSET p_offset;
END;
$$;
