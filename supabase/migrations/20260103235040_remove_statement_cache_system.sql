/*
  # Remove Statement Cache System

  1. Changes
    - Drop the statement_cache table completely
    - Remove all associated RLS policies
    - Clean up the development/simulation statement caching system
  
  2. Rationale
    - The statement cache was a development tool for simulating bank connections
    - It contained outdated/incorrect data causing confusion
    - The bulk import feature built on top of it was not working properly
    - Core transaction import features (CSV upload, manual entry) remain functional
  
  3. Security
    - No data loss concern as this was simulation/cache data only
*/

-- Drop the statement_cache table (CASCADE will remove dependent objects like RLS policies)
DROP TABLE IF EXISTS statement_cache CASCADE;
