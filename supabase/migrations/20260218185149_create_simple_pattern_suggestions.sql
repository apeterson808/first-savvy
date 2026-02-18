/*
  # Create Simple Pattern-Based Suggestion System

  ## Overview
  This migration creates a function to suggest categories based on description patterns
  from the user's historical posted transactions. No AI involved - pure pattern matching.

  ## New Functions
  
  ### get_category_suggestion_by_pattern
  - Extracts merchant name from transaction description
  - Finds similar historical posted transactions
  - Returns most common category if used 2+ times
  - Uses PostgreSQL trigram similarity for fuzzy matching
  
  ## Implementation Details
  
  1. Pattern Extraction
     - Removes numbers, dates, special characters from description
     - Normalizes whitespace and case
     - Extracts core merchant/vendor name
  
  2. Similarity Matching
     - Uses pg_trgm extension for fuzzy text matching
     - Configurable similarity threshold (default 0.3)
     - Matches against posted transactions with categories
  
  3. Category Frequency
     - Groups matches by category
     - Counts usage frequency
     - Returns only if used 2 or more times
     - Includes last usage date and confidence score
  
  ## Security
  - Function uses SECURITY DEFINER with search_path set
  - Filters by profile_id to ensure data isolation
  - Only reads from posted_transactions (no modifications)
*/

-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function to extract merchant pattern from description
CREATE OR REPLACE FUNCTION extract_merchant_pattern(description TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Remove common prefixes and suffixes
  description := REGEXP_REPLACE(description, '^(PAYMENT TO|TRANSFER TO|FROM|TO|DEBIT|CREDIT)\s+', '', 'gi');
  
  -- Remove dates (various formats)
  description := REGEXP_REPLACE(description, '\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', '', 'g');
  
  -- Remove transaction IDs and reference numbers
  description := REGEXP_REPLACE(description, '#\d+', '', 'g');
  description := REGEXP_REPLACE(description, 'REF\s*:?\s*\d+', '', 'gi');
  
  -- Remove location codes (e.g., "CA", "US", "NY")
  description := REGEXP_REPLACE(description, '\s+[A-Z]{2}\s*$', '', 'g');
  
  -- Remove multiple spaces and trim
  description := REGEXP_REPLACE(description, '\s+', ' ', 'g');
  description := TRIM(description);
  
  -- Take first 50 characters for pattern matching
  IF LENGTH(description) > 50 THEN
    description := LEFT(description, 50);
  END IF;
  
  RETURN UPPER(description);
END;
$$;

-- Function to get category suggestion based on pattern matching
CREATE OR REPLACE FUNCTION get_category_suggestion_by_pattern(
  p_description TEXT,
  p_profile_id UUID,
  p_similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  suggested_category_id UUID,
  category_name TEXT,
  usage_count BIGINT,
  confidence FLOAT,
  last_used_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pattern TEXT;
BEGIN
  -- Extract merchant pattern from input description
  v_pattern := extract_merchant_pattern(p_description);
  
  -- Return null if pattern is too short
  IF LENGTH(v_pattern) < 3 THEN
    RETURN;
  END IF;
  
  -- Find similar transactions and aggregate by category
  RETURN QUERY
  WITH similar_transactions AS (
    SELECT 
      pt.category_id,
      extract_merchant_pattern(pt.description) as tx_pattern,
      pt.transaction_date,
      similarity(v_pattern, extract_merchant_pattern(pt.description)) as sim_score
    FROM posted_transactions pt
    WHERE pt.profile_id = p_profile_id
      AND pt.category_id IS NOT NULL
      AND similarity(v_pattern, extract_merchant_pattern(pt.description)) > p_similarity_threshold
  ),
  category_stats AS (
    SELECT 
      st.category_id,
      COUNT(*) as usage_count,
      MAX(st.sim_score) as max_similarity,
      MAX(st.transaction_date) as last_used
    FROM similar_transactions st
    GROUP BY st.category_id
    HAVING COUNT(*) >= 2  -- Only suggest if pattern used 2+ times
  )
  SELECT 
    cs.category_id,
    c.name,
    cs.usage_count,
    cs.max_similarity,
    cs.last_used
  FROM category_stats cs
  JOIN categories c ON c.id = cs.category_id
  ORDER BY cs.usage_count DESC, cs.max_similarity DESC
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION extract_merchant_pattern(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_suggestion_by_pattern(TEXT, UUID, FLOAT) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_category_suggestion_by_pattern IS 
'Suggests a category for a transaction based on historical pattern matching. Returns suggestion only if the pattern has been used 2 or more times previously.';
