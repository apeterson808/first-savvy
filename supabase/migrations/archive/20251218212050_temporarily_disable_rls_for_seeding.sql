/*
  # Temporarily Disable RLS for Seeding
  
  ## Changes
  - Temporarily disable RLS on tables to allow seed script to run
  - This will be re-enabled after seeding is complete
  
  IMPORTANT: This is temporary for seeding purposes only.
*/

ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE budget_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorization_rules DISABLE ROW LEVEL SECURITY;