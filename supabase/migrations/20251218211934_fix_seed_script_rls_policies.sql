/*
  # Fix RLS Policies for Seed Script
  
  ## Changes
  - Update categories INSERT policy to allow system categories
  - Update other table policies to allow anon inserts for seeding
  
  This allows the seed script to populate data for testing purposes.
*/

-- Drop and recreate categories policies to allow system categories
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id OR 
    (is_system = true AND user_id IS NULL)
  );

-- Also allow anon to insert for seed script
CREATE POLICY "Allow seed script to insert categories"
  ON categories FOR INSERT
  TO anon
  WITH CHECK (is_system = true OR user_id IS NULL);

-- Allow anon to insert bank accounts for seeding
CREATE POLICY "Allow seed script to insert bank_accounts"
  ON bank_accounts FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to insert transactions for seeding
CREATE POLICY "Allow seed script to insert transactions"
  ON transactions FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to insert budgets for seeding
CREATE POLICY "Allow seed script to insert budgets"
  ON budgets FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to insert budget_groups for seeding
CREATE POLICY "Allow seed script to insert budget_groups"
  ON budget_groups FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to insert assets for seeding
CREATE POLICY "Allow seed script to insert assets"
  ON assets FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to insert liabilities for seeding
CREATE POLICY "Allow seed script to insert liabilities"
  ON liabilities FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to insert contacts for seeding
CREATE POLICY "Allow seed script to insert contacts"
  ON contacts FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to insert credit_scores for seeding
CREATE POLICY "Allow seed script to insert credit_scores"
  ON credit_scores FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to insert categorization_rules for seeding
CREATE POLICY "Allow seed script to insert categorization_rules"
  ON categorization_rules FOR INSERT
  TO anon
  WITH CHECK (true);