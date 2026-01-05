/*
  # Create Journal Entry Core Functions

  1. Functions Created
    - `get_next_journal_entry_number` - generates next sequential entry number
    - `validate_journal_entry_balance` - ensures debits = credits
    - `create_journal_entry` - creates entry with lines in one transaction
    - `get_journal_entry_with_lines` - fetches complete entry with account details
    - `get_account_journal_lines` - fetches all journal lines for an account
  
  2. Features
    - Automatic entry number generation (JE-0001, JE-0002, etc.)
    - Balance validation before insert
    - Atomic creation (all or nothing)
    - Rich query functions with account names
*/

-- Function to get next journal entry number for a profile
CREATE OR REPLACE FUNCTION get_next_journal_entry_number(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_number text;
  v_last_seq integer;
  v_next_seq integer;
BEGIN
  -- Get the last entry number for this profile
  SELECT entry_number INTO v_last_number
  FROM journal_entries
  WHERE profile_id = p_profile_id
  ORDER BY entry_number DESC
  LIMIT 1;
  
  -- If no entries exist, start with JE-0001
  IF v_last_number IS NULL THEN
    RETURN 'JE-0001';
  END IF;
  
  -- Extract the numeric part (assuming format JE-NNNN)
  v_last_seq := CAST(SUBSTRING(v_last_number FROM 4) AS integer);
  v_next_seq := v_last_seq + 1;
  
  -- Return formatted number
  RETURN 'JE-' || LPAD(v_next_seq::text, 4, '0');
END;
$$;

-- Function to validate journal entry balance
CREATE OR REPLACE FUNCTION validate_journal_entry_balance(
  p_lines jsonb
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_debits numeric := 0;
  v_total_credits numeric := 0;
  v_line jsonb;
BEGIN
  -- Sum up all debits and credits
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    IF (v_line->>'debit_amount')::numeric IS NOT NULL THEN
      v_total_debits := v_total_debits + (v_line->>'debit_amount')::numeric;
    END IF;
    
    IF (v_line->>'credit_amount')::numeric IS NOT NULL THEN
      v_total_credits := v_total_credits + (v_line->>'credit_amount')::numeric;
    END IF;
  END LOOP;
  
  -- Check if balanced (allow for small floating point differences)
  RETURN ABS(v_total_debits - v_total_credits) < 0.01;
END;
$$;

-- Function to create a complete journal entry with lines
CREATE OR REPLACE FUNCTION create_journal_entry(
  p_profile_id uuid,
  p_user_id uuid,
  p_entry_date date,
  p_description text,
  p_entry_type text,
  p_status text,
  p_source text,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_entry_number text;
  v_line jsonb;
  v_line_number integer := 1;
  v_line_id uuid;
  v_result jsonb;
BEGIN
  -- Validate balance
  IF NOT validate_journal_entry_balance(p_lines) THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits must equal credits.';
  END IF;
  
  -- Check minimum 2 lines
  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry must have at least 2 lines.';
  END IF;
  
  -- Generate entry number
  v_entry_number := get_next_journal_entry_number(p_profile_id);
  
  -- Insert journal entry header
  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    status,
    source
  ) VALUES (
    p_profile_id,
    p_user_id,
    p_entry_date,
    v_entry_number,
    p_description,
    p_entry_type,
    p_status,
    p_source
  ) RETURNING id INTO v_entry_id;
  
  -- Insert all lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      profile_id,
      user_id,
      account_id,
      line_number,
      debit_amount,
      credit_amount,
      description
    ) VALUES (
      v_entry_id,
      p_profile_id,
      p_user_id,
      (v_line->>'account_id')::uuid,
      v_line_number,
      CASE WHEN v_line->>'debit_amount' = 'null' OR v_line->>'debit_amount' IS NULL 
           THEN NULL 
           ELSE (v_line->>'debit_amount')::numeric 
      END,
      CASE WHEN v_line->>'credit_amount' = 'null' OR v_line->>'credit_amount' IS NULL 
           THEN NULL 
           ELSE (v_line->>'credit_amount')::numeric 
      END,
      v_line->>'description'
    );
    
    v_line_number := v_line_number + 1;
  END LOOP;
  
  -- Return the complete entry
  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entry_number', v_entry_number,
    'entry_date', p_entry_date,
    'description', p_description,
    'entry_type', p_entry_type,
    'status', p_status
  );
END;
$$;

-- Function to get journal entry with all lines and account details
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
    'id', je.id,
    'profile_id', je.profile_id,
    'user_id', je.user_id,
    'entry_date', je.entry_date,
    'entry_number', je.entry_number,
    'description', je.description,
    'entry_type', je.entry_type,
    'status', je.status,
    'source', je.source,
    'created_at', je.created_at,
    'updated_at', je.updated_at,
    'lines', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', jel.id,
          'line_number', jel.line_number,
          'account_id', jel.account_id,
          'account_number', ucoa.account_number,
          'account_name', ucoa.account_name,
          'debit_amount', jel.debit_amount,
          'credit_amount', jel.credit_amount,
          'description', jel.description
        ) ORDER BY jel.line_number
      )
      FROM journal_entry_lines jel
      JOIN user_chart_of_accounts ucoa ON jel.account_id = ucoa.id
      WHERE jel.journal_entry_id = je.id
    ),
    'total_debits', (
      SELECT COALESCE(SUM(debit_amount), 0)
      FROM journal_entry_lines
      WHERE journal_entry_id = je.id
    ),
    'total_credits', (
      SELECT COALESCE(SUM(credit_amount), 0)
      FROM journal_entry_lines
      WHERE journal_entry_id = je.id
    )
  ) INTO v_result
  FROM journal_entries je
  WHERE je.id = p_entry_id;
  
  RETURN v_result;
END;
$$;

-- Function to get all journal lines for a specific account (for account register)
CREATE OR REPLACE FUNCTION get_account_journal_lines(
  p_profile_id uuid,
  p_account_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
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
  offsetting_accounts text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jel.id as line_id,
    je.id as entry_id,
    je.entry_number,
    je.entry_date,
    je.description as entry_description,
    jel.description as line_description,
    jel.debit_amount,
    jel.credit_amount,
    (
      -- Get the names of other accounts in this journal entry
      SELECT string_agg(ucoa2.account_name, ', ')
      FROM journal_entry_lines jel2
      JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
      WHERE jel2.journal_entry_id = je.id
      AND jel2.account_id != p_account_id
    ) as offsetting_accounts
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND je.status = 'posted'
  AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
  AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  ORDER BY je.entry_date, je.entry_number, jel.line_number;
END;
$$;