/*
  # Financial Management Application Schema

  ## Overview
  This migration creates the complete database schema for a personal finance management application,
  replacing the Base44 backend with Supabase.

  ## New Tables Created

  ### 1. Bank Accounts (`bank_accounts`)
  Stores user bank accounts (checking, savings, credit cards, etc.)
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text) - Account name
  - `type` (text) - Account type (checking, savings, credit, etc.)
  - `balance` (numeric) - Current balance
  - `currency` (text) - Currency code (default USD)
  - `institution` (text) - Bank/institution name
  - `account_number` (text) - Last 4 digits or masked number
  - `is_active` (boolean) - Active status
  - `plaid_account_id` (text) - Plaid integration ID
  - `plaid_item_id` (text) - Plaid item ID
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. Categories (`categories`)
  Transaction categories and subcategories
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text) - Category name
  - `type` (text) - income, expense, transfer
  - `parent_account_id` (uuid) - For subcategories
  - `icon` (text) - Icon identifier
  - `color` (text) - Color code
  - `is_system` (boolean) - System vs user-created
  - `created_at` (timestamptz)

  ### 3. Transactions (`transactions`)
  Financial transactions
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `bank_account_id` (uuid, references bank_accounts)
  - `category_id` (uuid, references categories)
  - `date` (date) - Transaction date
  - `amount` (numeric) - Transaction amount
  - `description` (text) - Transaction description
  - `type` (text) - income, expense, transfer
  - `status` (text) - pending, posted, cleared
  - `merchant` (text) - Merchant name
  - `notes` (text) - User notes
  - `plaid_transaction_id` (text) - Plaid integration
  - `transfer_account_id` (uuid) - For transfers
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. Budget Groups (`budget_groups`)
  Budget category groups
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text) - Group name
  - `type` (text) - income or expense
  - `order` (integer) - Display order
  - `created_at` (timestamptz)

  ### 5. Budgets (`budgets`)
  Budget items
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `group_id` (uuid, references budget_groups)
  - `category_id` (uuid, references categories)
  - `name` (text) - Budget name
  - `limit_amount` (numeric) - Budget limit
  - `period` (text) - monthly, weekly, yearly
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. Contacts (`contacts`)
  People and businesses
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text) - Contact name
  - `type` (text) - person, business
  - `email` (text) - Email address
  - `phone` (text) - Phone number
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz)

  ### 7. Assets (`assets`)
  User assets (home, car, investments, etc.)
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text) - Asset name
  - `type` (text) - Asset type
  - `value` (numeric) - Current value
  - `purchase_date` (date) - Date acquired
  - `purchase_price` (numeric) - Original cost
  - `notes` (text) - Additional details
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. Liabilities (`liabilities`)
  User debts and obligations
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text) - Liability name
  - `type` (text) - Liability type (mortgage, loan, etc.)
  - `balance` (numeric) - Current balance owed
  - `interest_rate` (numeric) - Interest rate percentage
  - `minimum_payment` (numeric) - Minimum payment amount
  - `due_date` (date) - Payment due date
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 9. Credit Cards (`credit_cards`)
  Credit card accounts
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text) - Card name
  - `last_four` (text) - Last 4 digits
  - `credit_limit` (numeric) - Credit limit
  - `current_balance` (numeric) - Current balance
  - `due_date` (date) - Payment due date
  - `apr` (numeric) - Annual percentage rate
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 10. Bills (`bills`)
  Recurring bills and payments
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text) - Bill name
  - `amount` (numeric) - Bill amount
  - `due_date` (date) - Due date
  - `frequency` (text) - monthly, weekly, yearly
  - `category_id` (uuid, references categories)
  - `is_active` (boolean) - Active status
  - `auto_pay` (boolean) - Auto-pay enabled
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 11. Credit Scores (`credit_scores`)
  Credit score history
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `score` (integer) - Credit score value
  - `bureau` (text) - Credit bureau name
  - `date` (date) - Score date
  - `created_at` (timestamptz)

  ### 12. Categorization Rules (`categorization_rules`)
  Auto-categorization rules for transactions
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `pattern` (text) - Match pattern
  - `category_id` (uuid, references categories)
  - `priority` (integer) - Rule priority
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Policies for SELECT, INSERT, UPDATE, DELETE operations
*/

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT 'checking',
  balance numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  institution text,
  account_number text,
  is_active boolean DEFAULT true,
  plaid_account_id text,
  plaid_item_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank accounts"
  ON bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank accounts"
  ON bank_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank accounts"
  ON bank_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT 'expense',
  parent_account_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  icon text,
  color text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_system = true);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  date date NOT NULL,
  amount numeric NOT NULL,
  description text,
  type text DEFAULT 'expense',
  status text DEFAULT 'posted',
  merchant text,
  notes text,
  plaid_transaction_id text,
  transfer_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create budget_groups table
CREATE TABLE IF NOT EXISTS budget_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT 'expense',
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE budget_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget groups"
  ON budget_groups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget groups"
  ON budget_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget groups"
  ON budget_groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget groups"
  ON budget_groups FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES budget_groups(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  limit_amount numeric DEFAULT 0,
  period text DEFAULT 'monthly',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT 'person',
  email text,
  phone text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text,
  value numeric DEFAULT 0,
  purchase_date date,
  purchase_price numeric,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create liabilities table
CREATE TABLE IF NOT EXISTS liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text,
  balance numeric DEFAULT 0,
  interest_rate numeric,
  minimum_payment numeric,
  due_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own liabilities"
  ON liabilities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own liabilities"
  ON liabilities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own liabilities"
  ON liabilities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own liabilities"
  ON liabilities FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create credit_cards table
CREATE TABLE IF NOT EXISTS credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  last_four text,
  credit_limit numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  due_date date,
  apr numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit cards"
  ON credit_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit cards"
  ON credit_cards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credit cards"
  ON credit_cards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own credit cards"
  ON credit_cards FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create bills table
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric DEFAULT 0,
  due_date date,
  frequency text DEFAULT 'monthly',
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  auto_pay boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bills"
  ON bills FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bills"
  ON bills FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bills"
  ON bills FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bills"
  ON bills FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create credit_scores table
CREATE TABLE IF NOT EXISTS credit_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL,
  bureau text,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credit_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit scores"
  ON credit_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit scores"
  ON credit_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credit scores"
  ON credit_scores FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own credit scores"
  ON credit_scores FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create categorization_rules table
CREATE TABLE IF NOT EXISTS categorization_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categorization rules"
  ON categorization_rules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categorization rules"
  ON categorization_rules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categorization rules"
  ON categorization_rules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categorization rules"
  ON categorization_rules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account_id ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);