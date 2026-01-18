/*
  # Transaction Categorization Memory System

  1. New Table
    - `transaction_categorization_memory`
      - Stores user's manual categorization decisions for exact transaction matching
      - Uses fingerprint (date + original_description + amount + bank_account_id) for matching
      - Preserved during financial data resets to maintain learning across practice sessions

  2. Security
    - Enable RLS
    - Users can only access their own profile's categorization memories

  3. Performance
    - Composite index on (profile_id, transaction_fingerprint) for fast lookups during import
    - Index on last_used_at for memory management queries
*/

-- Create transaction categorization memory table
CREATE TABLE IF NOT EXISTS public.transaction_categorization_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Transaction fingerprint for exact matching
  transaction_fingerprint text NOT NULL,
  transaction_date date NOT NULL,
  original_description text NOT NULL,
  amount numeric NOT NULL,
  bank_account_id uuid REFERENCES public.user_chart_of_accounts(id) ON DELETE SET NULL,

  -- Categorization decision
  category_account_id uuid NOT NULL REFERENCES public.user_chart_of_accounts(id) ON DELETE CASCADE,

  -- Metadata
  first_categorized_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  use_count integer NOT NULL DEFAULT 1,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Ensure one memory per unique transaction fingerprint per profile
  UNIQUE(profile_id, transaction_fingerprint)
);

-- Add comment
COMMENT ON TABLE public.transaction_categorization_memory IS
  'Stores user categorization decisions for exact transaction matching. Preserved during financial resets to maintain learning.';

-- Enable RLS
ALTER TABLE public.transaction_categorization_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile categorization memories"
  ON public.transaction_categorization_memory
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_memberships
      WHERE profile_memberships.profile_id = transaction_categorization_memory.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own profile categorization memories"
  ON public.transaction_categorization_memory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profile_memberships
      WHERE profile_memberships.profile_id = transaction_categorization_memory.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile categorization memories"
  ON public.transaction_categorization_memory
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_memberships
      WHERE profile_memberships.profile_id = transaction_categorization_memory.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own profile categorization memories"
  ON public.transaction_categorization_memory
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_memberships
      WHERE profile_memberships.profile_id = transaction_categorization_memory.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_categorization_memory_profile_fingerprint
  ON public.transaction_categorization_memory(profile_id, transaction_fingerprint);

CREATE INDEX IF NOT EXISTS idx_categorization_memory_profile_id
  ON public.transaction_categorization_memory(profile_id);

CREATE INDEX IF NOT EXISTS idx_categorization_memory_last_used
  ON public.transaction_categorization_memory(profile_id, last_used_at DESC);

-- Function to generate transaction fingerprint
CREATE OR REPLACE FUNCTION public.generate_transaction_fingerprint(
  p_date date,
  p_original_description text,
  p_amount numeric,
  p_bank_account_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create a deterministic fingerprint from transaction attributes
  -- Format: DATE|DESCRIPTION|AMOUNT|ACCOUNT
  RETURN p_date::text || '|' ||
         LOWER(TRIM(p_original_description)) || '|' ||
         p_amount::text || '|' ||
         COALESCE(p_bank_account_id::text, 'null');
END;
$$;

-- Function to store or update categorization memory
CREATE OR REPLACE FUNCTION public.store_categorization_memory(
  p_profile_id uuid,
  p_transaction_date date,
  p_original_description text,
  p_amount numeric,
  p_bank_account_id uuid,
  p_category_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fingerprint text;
  v_memory_id uuid;
BEGIN
  -- Generate fingerprint
  v_fingerprint := generate_transaction_fingerprint(
    p_transaction_date,
    p_original_description,
    p_amount,
    p_bank_account_id
  );

  -- Insert or update memory
  INSERT INTO transaction_categorization_memory (
    profile_id,
    transaction_fingerprint,
    transaction_date,
    original_description,
    amount,
    bank_account_id,
    category_account_id,
    first_categorized_at,
    last_used_at,
    use_count
  ) VALUES (
    p_profile_id,
    v_fingerprint,
    p_transaction_date,
    p_original_description,
    p_amount,
    p_bank_account_id,
    p_category_account_id,
    now(),
    now(),
    1
  )
  ON CONFLICT (profile_id, transaction_fingerprint)
  DO UPDATE SET
    category_account_id = EXCLUDED.category_account_id,
    last_used_at = now(),
    use_count = transaction_categorization_memory.use_count + 1,
    updated_at = now()
  RETURNING id INTO v_memory_id;

  RETURN v_memory_id;
END;
$$;

-- Function to lookup categorization from memory
CREATE OR REPLACE FUNCTION public.lookup_categorization_memory(
  p_profile_id uuid,
  p_transaction_date date,
  p_original_description text,
  p_amount numeric,
  p_bank_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fingerprint text;
  v_category_account_id uuid;
BEGIN
  -- Generate fingerprint
  v_fingerprint := generate_transaction_fingerprint(
    p_transaction_date,
    p_original_description,
    p_amount,
    p_bank_account_id
  );

  -- Lookup memory
  SELECT category_account_id INTO v_category_account_id
  FROM transaction_categorization_memory
  WHERE profile_id = p_profile_id
    AND transaction_fingerprint = v_fingerprint;

  RETURN v_category_account_id;
END;
$$;

-- Function to get memory statistics
CREATE OR REPLACE FUNCTION public.get_categorization_memory_stats(p_profile_id uuid)
RETURNS TABLE (
  total_memories bigint,
  recent_memories bigint,
  avg_use_count numeric,
  oldest_memory timestamptz,
  newest_memory timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE last_used_at > now() - interval '30 days')::bigint,
    AVG(use_count),
    MIN(first_categorized_at),
    MAX(first_categorized_at)
  FROM transaction_categorization_memory
  WHERE transaction_categorization_memory.profile_id = p_profile_id;
END;
$$;
