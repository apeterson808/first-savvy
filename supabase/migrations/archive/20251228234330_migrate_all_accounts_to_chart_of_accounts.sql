/*
  # Migrate All Account Data to user_chart_of_accounts

  ## Overview
  This migration consolidates data from multiple account tables (accounts, assets,
  liabilities, equity, credit_cards, bank_accounts) into user_chart_of_accounts
  as the single source of truth.

  ## Migration Strategy
  1. For each existing account with chart_account_id: Update the matching user_chart_of_accounts record
  2. For accounts without chart_account_id: Create new user_chart_of_accounts records
  3. Copy all operational data (balances, institution info, etc.)
  4. Preserve all foreign key relationships

  ## Tables Being Migrated
  - accounts (checking, savings, credit cards)
  - assets (property, vehicles, investments)
  - liabilities (loans, mortgages)
  - equity (owner equity, retained earnings)
  - credit_cards (enhanced credit card data)
  - bank_accounts (legacy bank account data)
*/

-- Step 1: Migrate data from accounts table
UPDATE user_chart_of_accounts ucoa
SET
  current_balance = COALESCE(a.current_balance, 0),
  available_balance = a.available_balance,
  statement_balance = a.statement_balance,
  institution_name = a.institution_name,
  account_number_last4 = a.account_number_last4,
  official_name = a.official_name,
  routing_number = a.routing_number,
  credit_limit = a.credit_limit,
  interest_rate = a.interest_rate,
  minimum_payment = a.minimum_payment,
  payment_due_date = a.payment_due_date,
  plaid_account_id = a.plaid_account_id,
  plaid_item_id = a.plaid_item_id,
  last_sync_date = a.updated_at,
  is_closed = COALESCE(a.is_closed, false),
  include_in_net_worth = COALESCE(a.include_in_net_worth, true),
  notes = a.notes,
  is_active = true,
  display_in_sidebar = true
FROM accounts a
WHERE a.chart_account_id = ucoa.id
  AND a.chart_account_id IS NOT NULL;

-- Step 2: Migrate data from assets table
UPDATE user_chart_of_accounts ucoa
SET
  current_balance = COALESCE(a.current_balance, 0),
  purchase_date = a.purchase_date,
  purchase_price = a.purchase_price,
  institution_name = a.institution,
  notes = COALESCE(a.notes, a.description),
  start_date = a.start_date,
  is_active = true,
  include_in_net_worth = COALESCE(a.is_active, true),
  display_in_sidebar = false
FROM assets a
WHERE a.chart_account_id = ucoa.id
  AND a.chart_account_id IS NOT NULL;

-- Step 3: Migrate data from liabilities table
UPDATE user_chart_of_accounts ucoa
SET
  current_balance = COALESCE(l.current_balance, 0),
  interest_rate = l.interest_rate,
  minimum_payment = l.minimum_payment,
  payment_due_date = l.due_date,
  original_amount = l.original_loan_amount,
  monthly_payment = l.monthly_payment,
  institution_name = l.institution,
  notes = COALESCE(l.description),
  start_date = l.start_date,
  is_active = true,
  include_in_net_worth = COALESCE(l.is_active, true),
  display_in_sidebar = false
FROM liabilities l
WHERE l.chart_account_id = ucoa.id
  AND l.chart_account_id IS NOT NULL;

-- Step 4: Migrate data from equity table
UPDATE user_chart_of_accounts ucoa
SET
  current_balance = COALESCE(e.current_balance, 0),
  institution_name = e.institution,
  notes = COALESCE(e.notes, e.description),
  start_date = e.start_date,
  is_active = true,
  include_in_net_worth = COALESCE(e.is_active, true),
  display_in_sidebar = false
FROM equity e
WHERE e.chart_account_id = ucoa.id
  AND e.chart_account_id IS NOT NULL;

-- Step 5: Migrate data from credit_cards table
UPDATE user_chart_of_accounts ucoa
SET
  current_balance = COALESCE(cc.current_balance, 0),
  credit_limit = cc.credit_limit,
  interest_rate = cc.apr,
  minimum_payment = cc.minimum_payment,
  payment_due_date = cc.due_date,
  statement_balance = cc.statement_balance,
  statement_closing_date = cc.statement_date,
  institution_name = cc.institution,
  account_number_last4 = cc.last_four,
  plaid_account_id = cc.plaid_account_id,
  plaid_item_id = cc.plaid_item_id,
  last_sync_date = cc.last_synced_at,
  notes = cc.notes,
  is_active = COALESCE(cc.is_active, true),
  display_in_sidebar = true
FROM credit_cards cc
WHERE cc.chart_account_id = ucoa.id
  AND cc.chart_account_id IS NOT NULL;

-- Step 6: Migrate data from bank_accounts table
UPDATE user_chart_of_accounts ucoa
SET
  current_balance = COALESCE(ba.current_balance, 0),
  institution_name = ba.institution,
  account_number_last4 = SUBSTRING(ba.account_number FROM LENGTH(ba.account_number) - 3),
  plaid_account_id = ba.plaid_account_id,
  plaid_item_id = ba.plaid_item_id,
  start_date = ba.start_date,
  is_active = COALESCE(ba.is_active, true),
  display_in_sidebar = true
FROM bank_accounts ba
WHERE ba.chart_account_id = ucoa.id
  AND ba.chart_account_id IS NOT NULL;
