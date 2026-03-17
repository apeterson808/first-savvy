/*
  # Add Cash Balance Inclusion Field

  1. Changes
    - Add `include_in_cash_balance` column to `user_chart_of_accounts`
    - Set smart defaults based on account_detail
    
  2. Smart Defaults Logic
    - **INCLUDE in Cash Balance:**
      - Checking accounts
      - Savings accounts (regular, high yield, money market)
      - Cash (physical, on hand, emergency, petty cash, digital wallet)
      - Credit cards (because they affect available cash/payment obligations)
    
    - **EXCLUDE from Cash Balance:**
      - Mortgages and real estate loans
      - Auto loans and vehicle loans
      - Student loans and other long-term debt
      - Investment accounts (401k, IRA, brokerage, HSA)
      - Property values (primary/secondary residence, land, real estate)
      - Vehicle values
      - Other assets (art, collectibles, valuables)
  
  3. Notes
    - Default value is FALSE for safety
    - Users can customize via account settings if needed
    - Cash Balance = liquid money available now
    - Net Worth = total financial position (uses existing include_in_net_worth field)
*/

-- Add the column with default FALSE
ALTER TABLE user_chart_of_accounts 
ADD COLUMN IF NOT EXISTS include_in_cash_balance boolean DEFAULT false;

-- Set smart defaults for ASSETS that should be included in Cash Balance
UPDATE user_chart_of_accounts
SET include_in_cash_balance = true
WHERE account_detail IN (
  -- Bank accounts
  'checking_account',
  'savings_account',
  'high_yield_savings',
  'money_market',
  
  -- Cash
  'cash_on_hand',
  'physical_cash',
  'emergency_cash',
  'petty_cash',
  'digital_wallet_cash'
);

-- Set smart defaults for LIABILITIES that should be included in Cash Balance (credit cards)
UPDATE user_chart_of_accounts
SET include_in_cash_balance = true
WHERE class = 'liability' 
AND account_detail = 'personal_credit_card';

-- Add comment
COMMENT ON COLUMN user_chart_of_accounts.include_in_cash_balance IS 
'Whether to include this account in Cash Balance calculations. Cash Balance shows liquid money available now (checking, savings, cash, credit cards). Different from Net Worth which includes all assets/liabilities.';
