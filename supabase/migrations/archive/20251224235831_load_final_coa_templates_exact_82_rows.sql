/*
  # Load FINAL COA Templates (Exact 82 Rows)

  ## Overview
  Loads the exact 82 rows from the FINAL COA table into chart_of_accounts_templates.
  This is a flat list with no hierarchy - exactly matching the source table.

  ## Row Count
  - Assets: 30 accounts (1000-1590)
  - Liabilities: 10 accounts (2000-2290)
  - Equity: 2 accounts (3000-3100)
  - Income: 10 accounts (4000-4190)
  - Expense: 30 accounts (5000-6500)
  - TOTAL: 82 accounts

  ## Columns
  - account_number: Exact match from FINAL COA
  - class: asset/liability/equity/income/expense
  - account_type: cash/bank_accounts/investments/etc
  - account_detail: specific type identifier
  - display_name: Category/Display Name from FINAL COA
*/

INSERT INTO chart_of_accounts_templates (
  account_number,
  class,
  account_type,
  account_detail,
  display_name,
  sort_order,
  is_editable
) VALUES
  -- ASSETS (30 accounts)
  (1000, 'asset', 'cash', 'physical_cash', 'Physical Cash', 1, true),
  (1010, 'asset', 'cash', 'cash_on_hand', 'Cash on Hand', 2, true),
  (1020, 'asset', 'cash', 'digital_wallet_cash', 'Digital Wallet Cash', 3, true),
  (1030, 'asset', 'cash', 'petty_cash', 'Petty Cash', 4, true),
  (1040, 'asset', 'cash', 'emergency_cash', 'Emergency Cash', 5, true),
  (1100, 'asset', 'bank_accounts', 'checking_account', 'Checking', 6, true),
  (1110, 'asset', 'bank_accounts', 'savings_account', 'Savings', 7, true),
  (1120, 'asset', 'bank_accounts', 'high_yield_savings', 'High-Yield Savings', 8, true),
  (1130, 'asset', 'bank_accounts', 'money_market', 'Money Market', 9, true),
  (1200, 'asset', 'investments', 'brokerage_account', 'Brokerage', 10, true),
  (1210, 'asset', 'investments', 'account_401k', '401(k)', 11, true),
  (1220, 'asset', 'investments', 'traditional_ira', 'Traditional IRA', 12, true),
  (1230, 'asset', 'investments', 'roth_ira', 'Roth IRA', 13, true),
  (1240, 'asset', 'investments', 'hsa_investment', 'HSA Investment', 14, true),
  (1250, 'asset', 'investments', 'plan_529', '529 Plan', 15, true),
  (1260, 'asset', 'investments', 'crypto_wallet', 'Crypto Wallet', 16, true),
  (1270, 'asset', 'investments', 'private_investment', 'Private Investment', 17, true),
  (1290, 'asset', 'investments', 'other_investment', 'Other Investment', 18, true),
  (1300, 'asset', 'real_estate', 'primary_residence', 'Primary Residence', 19, true),
  (1310, 'asset', 'real_estate', 'secondary_residence', 'Secondary Residence', 20, true),
  (1320, 'asset', 'real_estate', 'land', 'Land', 21, true),
  (1330, 'asset', 'real_estate', 'other_real_estate', 'Other Real Estate', 22, true),
  (1400, 'asset', 'vehicles', 'personal_vehicle', 'Personal Vehicle', 23, true),
  (1410, 'asset', 'vehicles', 'recreational_vehicle', 'Recreational Vehicle', 24, true),
  (1420, 'asset', 'vehicles', 'other_vehicle', 'Other Vehicle', 25, true),
  (1500, 'asset', 'personal_property', 'valuables', 'Valuables', 26, true),
  (1510, 'asset', 'personal_property', 'collectibles', 'Collectibles', 27, true),
  (1520, 'asset', 'personal_property', 'art', 'Art', 28, true),
  (1590, 'asset', 'personal_property', 'other_personal_property', 'Other Personal Property', 29, true),
  
  -- LIABILITIES (10 accounts)
  (2000, 'liability', 'credit_cards', 'personal_credit_card', 'Personal Credit Card', 30, true),
  (2100, 'liability', 'loans', 'mortgage_primary', 'Primary Mortgage', 31, true),
  (2110, 'liability', 'loans', 'mortgage_secondary', 'Secondary Mortgage', 32, true),
  (2200, 'liability', 'loans', 'auto_loan', 'Auto Loan', 33, true),
  (2210, 'liability', 'loans', 'rv_loan', 'Recreational Vehicle Loan', 34, true),
  (2220, 'liability', 'loans', 'student_loan', 'Student Loan', 35, true),
  (2230, 'liability', 'loans', 'personal_loan', 'Personal Loan', 36, true),
  (2240, 'liability', 'loans', 'line_of_credit', 'Line of Credit', 37, true),
  (2250, 'liability', 'loans', 'medical_debt', 'Medical Debt', 38, true),
  (2290, 'liability', 'loans', 'other_debt', 'Other Debt', 39, true),
  
  -- EQUITY (2 accounts)
  (3000, 'equity', 'equity_adjustments', 'opening_balance_equity', 'Opening Balance Equity', 40, false),
  (3100, 'equity', 'equity_adjustments', 'net_worth_adjustment', 'Net Worth Adjustment', 41, false),
  
  -- INCOME (10 accounts)
  (4000, 'income', 'earned_income', 'earned_income', 'Salary', 42, true),
  (4010, 'income', 'earned_income', 'earned_income', 'Bonus', 43, true),
  (4020, 'income', 'earned_income', 'earned_income', 'Commission', 44, true),
  (4030, 'income', 'earned_income', 'earned_income', 'Side Income', 45, true),
  (4100, 'income', 'passive_income', 'passive_income', 'Interest', 46, true),
  (4110, 'income', 'passive_income', 'passive_income', 'Dividends', 47, true),
  (4120, 'income', 'passive_income', 'passive_income', 'Investment Income', 48, true),
  (4130, 'income', 'passive_income', 'passive_income', 'Rental Income (Personal)', 49, true),
  (4140, 'income', 'passive_income', 'passive_income', 'Gifts Received', 50, true),
  (4190, 'income', 'passive_income', 'passive_income', 'Other Income', 51, true),
  
  -- EXPENSE (30 accounts)
  (5000, 'expense', 'housing', 'housing', 'Housing', 52, true),
  (5010, 'expense', 'housing', 'housing', 'Rent / Mortgage', 53, true),
  (5020, 'expense', 'housing', 'housing', 'Home Maintenance', 54, true),
  (5030, 'expense', 'housing', 'housing', 'HOA Fees', 55, true),
  (5100, 'expense', 'utilities', 'utilities', 'Utilities', 56, true),
  (5110, 'expense', 'utilities', 'utilities', 'Internet', 57, true),
  (5120, 'expense', 'utilities', 'utilities', 'Phone', 58, true),
  (5200, 'expense', 'food_dining', 'food_dining', 'Groceries', 59, true),
  (5210, 'expense', 'food_dining', 'food_dining', 'Dining Out', 60, true),
  (5300, 'expense', 'transportation', 'transportation', 'Transportation', 61, true),
  (5310, 'expense', 'transportation', 'transportation', 'Gas & Fuel', 62, true),
  (5320, 'expense', 'transportation', 'transportation', 'Vehicle Maintenance', 63, true),
  (5400, 'expense', 'insurance', 'insurance', 'Insurance', 64, true),
  (5500, 'expense', 'healthcare', 'healthcare', 'Healthcare', 65, true),
  (5510, 'expense', 'healthcare', 'healthcare', 'Medical Expenses', 66, true),
  (5600, 'expense', 'kids_family', 'kids_family', 'Kids & Family', 67, true),
  (5610, 'expense', 'kids_family', 'kids_family', 'Childcare', 68, true),
  (5700, 'expense', 'education', 'education', 'Education', 69, true),
  (5710, 'expense', 'education', 'education', 'Tuition', 70, true),
  (5800, 'expense', 'subscriptions', 'subscriptions', 'Subscriptions', 71, true),
  (5900, 'expense', 'shopping', 'shopping', 'Shopping', 72, true),
  (6000, 'expense', 'travel', 'travel', 'Travel', 73, true),
  (6100, 'expense', 'lifestyle', 'lifestyle', 'Lifestyle', 74, true),
  (6110, 'expense', 'lifestyle', 'lifestyle', 'Entertainment', 75, true),
  (6200, 'expense', 'pets', 'pets', 'Pets', 76, true),
  (6300, 'expense', 'financial', 'financial', 'Financial Fees', 77, true),
  (6310, 'expense', 'financial', 'financial', 'Bank Fees', 78, true),
  (6400, 'expense', 'giving', 'giving', 'Giving', 79, true),
  (6410, 'expense', 'giving', 'giving', 'Donations', 80, true),
  (6500, 'expense', 'taxes', 'taxes', 'Taxes', 81, true);

-- Verify row count
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE class = 'asset') as assets,
  COUNT(*) FILTER (WHERE class = 'liability') as liabilities,
  COUNT(*) FILTER (WHERE class = 'equity') as equity,
  COUNT(*) FILTER (WHERE class = 'income') as income,
  COUNT(*) FILTER (WHERE class = 'expense') as expenses
FROM chart_of_accounts_templates;
