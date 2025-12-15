/*
  # Fix Transaction RLS for Demo Access

  This migration adds additional RLS policies to allow transactions to be viewed in demo mode.
  
  1. Changes
    - Add policy to allow anon users to view all transactions
    - Add policy to allow anon users to insert transactions
    - Add policy to allow anon users to update transactions
    - Add policy to allow anon users to delete transactions
*/

-- Allow anonymous users to view all transactions
CREATE POLICY "Allow anon to view transactions"
  ON transactions
  FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to insert transactions
CREATE POLICY "Allow anon to insert transactions"
  ON transactions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to update transactions
CREATE POLICY "Allow anon to update transactions"
  ON transactions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anonymous users to delete transactions
CREATE POLICY "Allow anon to delete transactions"
  ON transactions
  FOR DELETE
  TO anon
  USING (true);

-- Also apply same policies for other tables that might have similar issues
CREATE POLICY "Allow anon to view bank_accounts" ON bank_accounts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert bank_accounts" ON bank_accounts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to update bank_accounts" ON bank_accounts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon to delete bank_accounts" ON bank_accounts FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon to view credit_cards" ON credit_cards FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert credit_cards" ON credit_cards FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to update credit_cards" ON credit_cards FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon to delete credit_cards" ON credit_cards FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon to view categories" ON categories FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert categories" ON categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to update categories" ON categories FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon to delete categories" ON categories FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon to view contacts" ON contacts FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert contacts" ON contacts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to update contacts" ON contacts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon to delete contacts" ON contacts FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon to view assets" ON assets FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert assets" ON assets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to update assets" ON assets FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon to delete assets" ON assets FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon to view liabilities" ON liabilities FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert liabilities" ON liabilities FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to update liabilities" ON liabilities FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon to delete liabilities" ON liabilities FOR DELETE TO anon USING (true);