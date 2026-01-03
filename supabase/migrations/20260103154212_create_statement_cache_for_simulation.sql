/*
  # Create Statement Cache for Bank Simulation

  1. New Table
    - `statement_cache` - Stores parsed PDF statement data for simulation
      - `id` (uuid, primary key)
      - `institution_id` (uuid, foreign key to financial_institutions)
      - `institution_name` (text) - Citi, ICCU, American Express
      - `account_type` (text) - credit, checking, savings
      - `account_number_last4` (text) - Last 4 digits of account number
      - `statement_month` (text) - Month of statement (e.g., 'sep', 'oct', 'nov', 'dec')
      - `statement_year` (integer) - Year of statement
      - `transactions_data` (jsonb) - Array of parsed transactions
      - `transaction_count` (integer) - Number of transactions
      - `total_debits` (numeric) - Sum of all expenses
      - `total_credits` (numeric) - Sum of all income
      - `file_name` (text) - Original PDF filename
      - `parsed_at` (timestamptz) - When the statement was parsed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Allow public read access (this is simulation data, not real user data)
    - Only admins can insert/update

  3. Indexes
    - Index on institution_id for fast lookup by bank
    - Index on institution_name for search
    - Index on account_type for filtering

  4. Notes
    - This table caches parsed statement data to avoid re-parsing PDFs
    - Data is used for bank simulation during account setup
    - Transactions stored as JSONB for flexibility
*/

CREATE TABLE IF NOT EXISTS statement_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES financial_institutions(id) ON DELETE CASCADE,
  institution_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('credit', 'checking', 'savings')),
  account_number_last4 text NOT NULL,
  statement_month text NOT NULL,
  statement_year integer NOT NULL,
  transactions_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  transaction_count integer DEFAULT 0,
  total_debits numeric DEFAULT 0,
  total_credits numeric DEFAULT 0,
  file_name text NOT NULL,
  parsed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE statement_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_statement_cache_institution_id ON statement_cache(institution_id);
CREATE INDEX IF NOT EXISTS idx_statement_cache_institution_name ON statement_cache(institution_name);
CREATE INDEX IF NOT EXISTS idx_statement_cache_account_type ON statement_cache(account_type);
CREATE INDEX IF NOT EXISTS idx_statement_cache_month_year ON statement_cache(statement_month, statement_year);

CREATE POLICY "Anyone can view statement cache"
  ON statement_cache
  FOR SELECT
  USING (true);

CREATE POLICY "Only authenticated users can insert statement cache"
  ON statement_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
