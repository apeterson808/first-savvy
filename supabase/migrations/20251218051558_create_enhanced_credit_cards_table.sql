/*
  # Enhanced Credit Cards Table

  1. Changes
    - Drop existing credit_cards table if it exists
    - Create new credit_cards table with comprehensive fields for:
      - Basic information (name, last_four, credit_limit, current_balance)
      - Payment tracking (due_date, statement_date, statement_balance, minimum_payment)
      - Plaid integration (plaid_account_id, plaid_item_id, institution, last_synced_at)
      - Display customization (institution_logo_url, account_number_masked, nickname, color)
      - Rewards tracking (rewards_program_name, rewards_type, rewards_balance, rewards_currency, cashback_percentage)
      - Payment history (last_payment_date, last_payment_amount)
      - Reminders (payment_reminder_days, reminder_enabled, reminder_email, reminder_sms)
      - Additional fields (apr, notes, currency, is_active)
    
  2. Security
    - Enable RLS on credit_cards table
    - Add policies for authenticated users to manage their own credit cards
    
  3. Performance
    - Add indexes on user_id, plaid_account_id, and is_active
*/

-- Drop existing credit_cards table if it exists
DROP TABLE IF EXISTS credit_cards CASCADE;

-- Create enhanced credit_cards table
CREATE TABLE credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic information
  name text NOT NULL,
  last_four text,
  nickname text,
  account_number_masked text,
  
  -- Financial details
  credit_limit numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  apr numeric,
  
  -- Payment tracking
  due_date date,
  statement_date date,
  statement_balance numeric DEFAULT 0,
  minimum_payment numeric DEFAULT 0,
  last_payment_date date,
  last_payment_amount numeric DEFAULT 0,
  
  -- Plaid integration
  plaid_account_id text,
  plaid_item_id text,
  institution text,
  institution_logo_url text,
  last_synced_at timestamptz,
  
  -- Rewards tracking
  rewards_program_name text,
  rewards_type text CHECK (rewards_type IN ('cashback', 'points', 'miles', 'none', NULL)),
  rewards_balance numeric DEFAULT 0,
  rewards_currency text,
  cashback_percentage numeric DEFAULT 0,
  
  -- Payment reminders
  payment_reminder_days integer DEFAULT 3,
  reminder_enabled boolean DEFAULT true,
  reminder_email text,
  reminder_sms text,
  
  -- Display customization
  color text DEFAULT '#3b82f6',
  
  -- Metadata
  notes text,
  is_active boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_plaid_account_id ON credit_cards(plaid_account_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_is_active ON credit_cards(is_active);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_credit_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_credit_cards_updated_at
  BEFORE UPDATE ON credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_cards_updated_at();
