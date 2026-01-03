/*
  # Migrate Credit Cards from Bank Accounts (v2)

  1. Migration Process
    - Find all bank_accounts where account_type = 'credit' or 'credit_card'
    - Insert records into credit_cards table preserving IDs
    - Update all transactions to use credit_card_id instead of bank_account_id
    - Mark original bank_accounts as inactive for backup reference
    
  2. Data Mapping
    - account_name → name
    - current_balance → current_balance
    - account_number → account_number_masked & last_four
    - institution → institution
    - plaid_account_id → plaid_account_id
    - plaid_item_id → plaid_item_id
    - logo_url → institution_logo_url
    - credit_limit → credit_limit
    - apr → apr
    - due_date → payment_reminder_days (if set)
    - minimum_payment → minimum_payment
    - statement_balance → statement_balance
    - statement_date → statement_date
    
  3. Safety
    - Use transaction block for atomicity
    - Preserve all original data in bank_accounts as backup
*/

DO $$
DECLARE
  credit_card_record RECORD;
  migrated_count INTEGER := 0;
BEGIN
  -- Temporarily disable the CHECK constraint on transactions
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_check;
  
  -- Migrate credit card accounts from bank_accounts to credit_cards
  FOR credit_card_record IN
    SELECT 
      id,
      user_id,
      account_name as name,
      account_number,
      current_balance,
      currency,
      institution,
      plaid_account_id,
      plaid_item_id,
      logo_url,
      credit_limit,
      apr,
      due_date,
      minimum_payment,
      statement_balance,
      statement_date,
      is_active,
      created_at,
      updated_at
    FROM bank_accounts
    WHERE account_type IN ('credit', 'credit_card')
    AND NOT EXISTS (
      SELECT 1 FROM credit_cards WHERE credit_cards.id = bank_accounts.id
    )
  LOOP
    -- Insert into credit_cards table with same ID
    INSERT INTO credit_cards (
      id,
      user_id,
      name,
      account_number_masked,
      current_balance,
      currency,
      institution,
      plaid_account_id,
      plaid_item_id,
      institution_logo_url,
      credit_limit,
      apr,
      payment_reminder_days,
      minimum_payment,
      statement_balance,
      statement_date,
      is_active,
      created_at,
      updated_at,
      last_four,
      color
    ) VALUES (
      credit_card_record.id,
      credit_card_record.user_id,
      credit_card_record.name,
      credit_card_record.account_number,
      credit_card_record.current_balance,
      COALESCE(credit_card_record.currency, 'USD'),
      credit_card_record.institution,
      credit_card_record.plaid_account_id,
      credit_card_record.plaid_item_id,
      credit_card_record.logo_url,
      COALESCE(credit_card_record.credit_limit, 0),
      credit_card_record.apr,
      COALESCE(credit_card_record.due_date, 3), -- due_date in bank_accounts is integer, use as reminder days
      COALESCE(credit_card_record.minimum_payment, 0),
      COALESCE(credit_card_record.statement_balance, 0),
      credit_card_record.statement_date,
      credit_card_record.is_active,
      credit_card_record.created_at,
      credit_card_record.updated_at,
      CASE 
        WHEN credit_card_record.account_number IS NOT NULL 
        THEN RIGHT(credit_card_record.account_number, 4)
        ELSE NULL
      END,
      '#3b82f6' -- Default blue color
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Update transactions to reference credit_card_id instead of bank_account_id
    UPDATE transactions
    SET 
      credit_card_id = credit_card_record.id,
      bank_account_id = NULL
    WHERE bank_account_id = credit_card_record.id;
    
    -- Mark the original bank_account as inactive
    UPDATE bank_accounts
    SET is_active = false
    WHERE id = credit_card_record.id;
    
    migrated_count := migrated_count + 1;
  END LOOP;
  
  -- Re-enable the CHECK constraint
  ALTER TABLE transactions ADD CONSTRAINT transactions_account_check
    CHECK (
      (bank_account_id IS NOT NULL AND credit_card_id IS NULL) OR
      (bank_account_id IS NULL AND credit_card_id IS NOT NULL)
    );
  
  RAISE NOTICE 'Migrated % credit card accounts from bank_accounts to credit_cards', migrated_count;
END $$;
