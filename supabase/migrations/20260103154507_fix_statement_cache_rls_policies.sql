/*
  # Fix Statement Cache RLS Policies

  1. Changes
    - Allow anyone to insert statement cache data (it's simulation data, not real user data)
    - Keep public read access
    
  2. Security Note
    - This is safe because statement_cache only contains simulation/demo data
    - No real user financial data is stored in this table
*/

DROP POLICY IF EXISTS "Only authenticated users can insert statement cache" ON statement_cache;

CREATE POLICY "Anyone can insert statement cache"
  ON statement_cache
  FOR INSERT
  WITH CHECK (true);
