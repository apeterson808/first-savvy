/*
  # Remove AI and Suggestion Tables

  This migration removes all AI and suggestion-related tables and functions from the database.

  ## Removed Tables
    - ai_category_suggestions
    - ai_contact_suggestions
    - transaction_categorization_memory
    - simple_pattern_suggestions
    - contact_pattern_suggestions

  ## Removed Functions
    - All stored procedures related to categorization memory
    - All stored procedures related to AI suggestions
    - All stored procedures related to pattern suggestions
*/

-- Drop tables
DROP TABLE IF EXISTS ai_category_suggestions CASCADE;
DROP TABLE IF EXISTS ai_contact_suggestions CASCADE;
DROP TABLE IF EXISTS transaction_categorization_memory CASCADE;
DROP TABLE IF EXISTS simple_pattern_suggestions CASCADE;
DROP TABLE IF EXISTS contact_pattern_suggestions CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS store_categorization_memory CASCADE;
DROP FUNCTION IF EXISTS lookup_categorization_memory CASCADE;
DROP FUNCTION IF EXISTS get_categorization_memory_stats CASCADE;
DROP FUNCTION IF EXISTS save_ai_category_suggestions CASCADE;
DROP FUNCTION IF EXISTS save_ai_contact_suggestions CASCADE;
DROP FUNCTION IF EXISTS get_pattern_suggestions CASCADE;
DROP FUNCTION IF EXISTS save_pattern_suggestion CASCADE;