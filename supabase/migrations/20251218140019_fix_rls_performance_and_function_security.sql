/*
  # Fix RLS Performance and Function Security Issues
  
  ## Overview
  This migration addresses critical performance and security issues identified by Supabase:
  - Optimizes RLS policies by caching auth.uid() calls
  - Fixes function search path security vulnerabilities
  
  ## RLS Performance Optimization
  
  ### Problem
  RLS policies that call auth.uid() directly re-evaluate the function for EVERY row, causing:
  - Significant performance degradation at scale
  - Unnecessary database load
  - Slower query execution
  
  ### Solution
  Replace `auth.uid()` with `(select auth.uid())` to:
  - Cache the user ID once per query
  - Evaluate only once instead of per-row
  - Dramatically improve query performance
  
  ### Tables Fixed
  1. **transactions** - 4 policies (SELECT, INSERT, UPDATE, DELETE)
  2. **credit_cards** - 4 policies (SELECT, INSERT, UPDATE, DELETE)
  3. **payment_reminders** - 4 policies (SELECT, INSERT, UPDATE, DELETE)
  4. **user_profiles** - 3 policies (SELECT, INSERT, UPDATE)
  
  ## Function Security Fixes
  
  ### Problem
  Functions without explicit search_path are vulnerable to:
  - Search path manipulation attacks
  - Unpredictable schema context
  - Potential privilege escalation
  
  ### Solution
  Add SECURITY DEFINER and SET search_path to:
  - Prevent search_path attacks
  - Ensure predictable execution context
  - Follow PostgreSQL security best practices
  
  ### Functions Fixed
  1. update_credit_cards_updated_at
  2. update_credit_card_balance
  3. update_user_profile_updated_at
  4. create_user_profile
  5. update_payment_reminders_updated_at
  6. check_upcoming_payment_reminders
  7. calculate_reminder_date
  
  ## Important Notes
  - All existing policies are dropped and recreated with optimized versions
  - No data is modified or lost
  - Changes are backward compatible
  - Performance improvement is immediate
*/

-- =====================================================
-- PART 1: Optimize RLS Policies for Transactions
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

-- Create optimized policies with cached auth.uid()
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- PART 2: Optimize RLS Policies for Credit Cards
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can insert own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can update own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can delete own credit cards" ON credit_cards;

-- Create optimized policies with cached auth.uid()
CREATE POLICY "Users can view own credit cards"
  ON credit_cards FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own credit cards"
  ON credit_cards FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own credit cards"
  ON credit_cards FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own credit cards"
  ON credit_cards FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- PART 3: Optimize RLS Policies for Payment Reminders
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own payment reminders" ON payment_reminders;
DROP POLICY IF EXISTS "Users can insert own payment reminders" ON payment_reminders;
DROP POLICY IF EXISTS "Users can update own payment reminders" ON payment_reminders;
DROP POLICY IF EXISTS "Users can delete own payment reminders" ON payment_reminders;

-- Create optimized policies with cached auth.uid()
CREATE POLICY "Users can view own payment reminders"
  ON payment_reminders FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own payment reminders"
  ON payment_reminders FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own payment reminders"
  ON payment_reminders FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own payment reminders"
  ON payment_reminders FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- PART 4: Optimize RLS Policies for User Profiles
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create optimized policies with cached auth.uid()
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- =====================================================
-- PART 5: Fix Function Security - Credit Cards
-- =====================================================

CREATE OR REPLACE FUNCTION update_credit_cards_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_credit_card_balance()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  card_id uuid;
BEGIN
  -- Determine which credit card to update
  IF TG_OP = 'DELETE' THEN
    card_id := OLD.credit_card_id;
  ELSE
    card_id := NEW.credit_card_id;
  END IF;

  -- Only proceed if transaction involves a credit card
  IF card_id IS NOT NULL THEN
    -- Recalculate balance from all transactions
    UPDATE credit_cards
    SET current_balance = (
      SELECT COALESCE(SUM(amount), 0)
      FROM transactions
      WHERE credit_card_id = card_id
    )
    WHERE id = card_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- =====================================================
-- PART 6: Fix Function Security - User Profiles
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- =====================================================
-- PART 7: Fix Function Security - Payment Reminders
-- =====================================================

CREATE OR REPLACE FUNCTION update_payment_reminders_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_upcoming_payment_reminders()
RETURNS TABLE(
  reminders_created integer,
  cards_processed integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
$$;

CREATE OR REPLACE FUNCTION calculate_reminder_date(card_due_date date, days_before integer)
RETURNS date 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- If no due date, return null
  IF card_due_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate reminder date as due_date minus reminder_days
  RETURN card_due_date - days_before;
END;
$$;

-- =====================================================
-- PART 8: Grant Permissions
-- =====================================================

-- Grant execute permission on public functions
GRANT EXECUTE ON FUNCTION check_upcoming_payment_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_reminder_date(date, integer) TO authenticated;
