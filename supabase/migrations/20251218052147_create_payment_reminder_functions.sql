/*
  # Payment Reminder Functions

  1. New Functions
    - `check_upcoming_payment_reminders()` - Checks for credit cards with upcoming due dates and creates reminder records
    - `calculate_reminder_date(due_date, reminder_days)` - Helper function to calculate when reminder should be sent
    
  2. Purpose
    - Automatically create payment reminder records for credit cards
    - Run daily to check for upcoming due dates
    - Create reminders based on each card's payment_reminder_days setting
    
  3. Usage
    - Can be called manually or scheduled via pg_cron
*/

-- Helper function to calculate reminder date
CREATE OR REPLACE FUNCTION calculate_reminder_date(card_due_date date, days_before integer)
RETURNS date AS $$
BEGIN
  -- If no due date, return null
  IF card_due_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate reminder date as due_date minus reminder_days
  RETURN card_due_date - days_before;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main function to check and create upcoming payment reminders
CREATE OR REPLACE FUNCTION check_upcoming_payment_reminders()
RETURNS TABLE(
  reminders_created integer,
  cards_processed integer
) AS $$
DECLARE
  card_record RECORD;
  reminder_count integer := 0;
  processed_count integer := 0;
  reminder_date date;
BEGIN
  -- Loop through all active credit cards with reminders enabled
  FOR card_record IN
    SELECT 
      id,
      user_id,
      name,
      due_date,
      payment_reminder_days,
      minimum_payment,
      current_balance,
      reminder_email,
      reminder_sms
    FROM credit_cards
    WHERE is_active = true
      AND reminder_enabled = true
      AND due_date IS NOT NULL
      AND payment_reminder_days IS NOT NULL
  LOOP
    processed_count := processed_count + 1;
    
    -- Calculate when the reminder should be sent
    reminder_date := calculate_reminder_date(card_record.due_date, card_record.payment_reminder_days);
    
    -- Only create reminder if reminder_date is today or in the past, and due_date is in the future
    IF reminder_date <= CURRENT_DATE AND card_record.due_date >= CURRENT_DATE THEN
      -- Check if reminder already exists for this card and due date
      IF NOT EXISTS (
        SELECT 1 FROM payment_reminders
        WHERE credit_card_id = card_record.id
          AND due_date = card_record.due_date
          AND status IN ('pending', 'sent', 'snoozed')
          AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      ) THEN
        -- Create new reminder record
        INSERT INTO payment_reminders (
          user_id,
          credit_card_id,
          reminder_date,
          due_date,
          amount,
          status,
          notification_type
        ) VALUES (
          card_record.user_id,
          card_record.id,
          reminder_date,
          card_record.due_date,
          COALESCE(card_record.minimum_payment, 0),
          'pending',
          CASE
            WHEN card_record.reminder_email IS NOT NULL AND card_record.reminder_sms IS NOT NULL THEN 'both'
            WHEN card_record.reminder_sms IS NOT NULL THEN 'sms'
            ELSE 'email'
          END
        );
        
        reminder_count := reminder_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  -- Return summary
  RETURN QUERY SELECT reminder_count, processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_upcoming_payment_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_reminder_date(date, integer) TO authenticated;
