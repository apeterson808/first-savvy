/*
  # Payment Reminders Table

  1. New Table
    - `payment_reminders` - Tracks payment reminder notifications for credit cards
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `credit_card_id` (uuid, references credit_cards)
      - `reminder_date` (date) - When the reminder should be sent
      - `due_date` (date) - The actual payment due date
      - `amount` (numeric) - Amount due (minimum payment or statement balance)
      - `status` (text) - pending, sent, dismissed, snoozed
      - `sent_at` (timestamptz) - When the notification was sent
      - `notification_type` (text) - email, sms, both
      - `snoozed_until` (date) - If snoozed, when to remind again
      - `notes` (text) - Additional notes
      
  2. Security
    - Enable RLS on payment_reminders table
    - Add policies for authenticated users to manage their own reminders
    
  3. Performance
    - Add indexes on reminder_date, status, and credit_card_id
*/

-- Create payment_reminders table
CREATE TABLE IF NOT EXISTS payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  credit_card_id uuid REFERENCES credit_cards(id) ON DELETE CASCADE NOT NULL,
  
  -- Reminder details
  reminder_date date NOT NULL,
  due_date date NOT NULL,
  amount numeric DEFAULT 0,
  
  -- Status tracking
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed', 'snoozed')),
  sent_at timestamptz,
  snoozed_until date,
  
  -- Notification settings
  notification_type text DEFAULT 'email' CHECK (notification_type IN ('email', 'sms', 'both')),
  
  -- Metadata
  notes text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own payment reminders"
  ON payment_reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment reminders"
  ON payment_reminders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment reminders"
  ON payment_reminders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment reminders"
  ON payment_reminders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_reminders_user_id ON payment_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_credit_card_id ON payment_reminders(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_reminder_date ON payment_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_status ON payment_reminders(status);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_due_status ON payment_reminders(reminder_date, status);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_payment_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_reminders_updated_at
  BEFORE UPDATE ON payment_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_reminders_updated_at();
