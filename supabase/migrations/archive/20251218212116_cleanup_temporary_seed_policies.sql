/*
  # Clean Up Temporary Seed Policies
  
  ## Changes
  - Remove temporary anon policies that were created for seeding
  - These are no longer needed and could pose a security risk
*/

-- Remove temporary seed policies
DROP POLICY IF EXISTS "Allow seed script to insert categories" ON categories;
DROP POLICY IF EXISTS "Allow seed script to insert bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow seed script to insert transactions" ON transactions;
DROP POLICY IF EXISTS "Allow seed script to insert budgets" ON budgets;
DROP POLICY IF EXISTS "Allow seed script to insert budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Allow seed script to insert assets" ON assets;
DROP POLICY IF EXISTS "Allow seed script to insert liabilities" ON liabilities;
DROP POLICY IF EXISTS "Allow seed script to insert contacts" ON contacts;
DROP POLICY IF EXISTS "Allow seed script to insert credit_scores" ON credit_scores;
DROP POLICY IF EXISTS "Allow seed script to insert categorization_rules" ON categorization_rules;