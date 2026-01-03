/*
  # Allow Anonymous Access to Budget Tables

  1. Changes
    - Add policies to allow anon users to view budget_groups
    - Add policies to allow anon users to insert budget_groups
    - Add policies to allow anon users to update budget_groups
    - Add policies to allow anon users to delete budget_groups
    - Add policies to allow anon users to view budgets
    - Add policies to allow anon users to insert budgets
    - Add policies to allow anon users to update budgets
    - Add policies to allow anon users to delete budgets
  
  2. Security
    - These policies enable demo mode access without authentication
    - Follows the same pattern as other tables in the demo app
*/

-- Budget Groups: Allow anonymous users full access
CREATE POLICY "Allow anon to view budget_groups"
  ON budget_groups
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert budget_groups"
  ON budget_groups
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update budget_groups"
  ON budget_groups
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete budget_groups"
  ON budget_groups
  FOR DELETE
  TO anon
  USING (true);

-- Budgets: Allow anonymous users full access
CREATE POLICY "Allow anon to view budgets"
  ON budgets
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert budgets"
  ON budgets
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update budgets"
  ON budgets
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete budgets"
  ON budgets
  FOR DELETE
  TO anon
  USING (true);
