/*
  # Load New 79-Account Chart of Accounts Templates
  
  ## Overview
  Replaces the existing 82-account COA with the new 79-account structure.
  This update reorganizes account numbering to reserve 5000-5999 for future
  business COGS accounts, moving personal expenses to 6000-9000 range.
  
  ## Account Structure
  - Assets: 1000-1680 (29 accounts)
  - Liabilities: 2000-2280 (10 accounts)
  - Equity: 3000-3200 (2 accounts)
  - Income: 4000-4260 (8 accounts)
  - Expenses: 6000-9000 (30 accounts)
  - **Total: 79 accounts**
  
  ## Two-Tier Provisioning Strategy
  This migration supports a two-tier provisioning system:
  - Income (4000-4260): Auto-created as ACTIVE for immediate budgeting
  - Expenses (6000-9000): Auto-created as ACTIVE for immediate budgeting
  - Assets/Liabilities/Equity (1000-3200): Templates only, created on-demand
  
  ## Changes
  1. Clears all existing user data (user is sole user, confirmed safe to reset)
  2. Clears existing chart_of_accounts_templates
  3. Inserts 79 new accounts with updated numbering
  4. Preserves icons and colors from existing system (BASE44 palette)
  5. Updates sort_order to reflect new structure
  
  ## Safety
  User confirmed they are the only user and approved deletion of all existing data.
*/

-- Clear all user data (cascading from transactions down)
DELETE FROM transactions;
DELETE FROM budgets;
DELETE FROM user_chart_of_accounts;

-- Clear existing templates
DELETE FROM chart_of_accounts_templates;

-- Reset sequences if needed
ALTER SEQUENCE IF EXISTS chart_of_accounts_templates_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS user_chart_of_accounts_id_seq RESTART WITH 1;

-- Insert new 79-account structure
INSERT INTO chart_of_accounts_templates (
  account_number,
  class,
  account_type,
  account_detail,
  display_name,
  icon,
  color,
  sort_order,
  is_editable
) VALUES
  -- ============================================================================
  -- ASSETS (29 accounts: 1000-1680)
  -- ============================================================================
  
  -- Cash (1000-1080)
  (1000, 'asset', 'cash', 'physical_cash', 'Physical Cash', 'Wallet', '#AACC96', 1, true),
  (1020, 'asset', 'cash', 'cash_on_hand', 'Cash on Hand', 'Wallet', '#52A5CE', 2, true),
  (1040, 'asset', 'cash', 'digital_wallet_cash', 'Digital Wallet Cash', 'Smartphone', '#B8CEE8', 3, true),
  (1060, 'asset', 'cash', 'petty_cash', 'Petty Cash', 'Coins', '#AACC96', 4, true),
  (1080, 'asset', 'cash', 'emergency_cash', 'Emergency Cash', 'Shield', '#52A5CE', 5, true),
  
  -- Bank Accounts (1100-1160)
  (1100, 'asset', 'bank_accounts', 'checking_account', 'Checking Account', 'Wallet', '#52A5CE', 6, true),
  (1120, 'asset', 'bank_accounts', 'savings_account', 'Savings Account', 'PiggyBank', '#B8CEE8', 7, true),
  (1140, 'asset', 'bank_accounts', 'high_yield_savings', 'High Yield Savings', 'TrendingUp', '#AACC96', 8, true),
  (1160, 'asset', 'bank_accounts', 'money_market', 'Money Market', 'Building2', '#52A5CE', 9, true),
  
  -- Investments (1200-1380)
  (1200, 'asset', 'investments', 'brokerage_account', 'Brokerage Account', 'TrendingUp', '#AACC96', 10, true),
  (1220, 'asset', 'investments', 'account_401k', '401(k) Account', 'Briefcase', '#25533F', 11, true),
  (1240, 'asset', 'investments', 'traditional_ira', 'Traditional IRA', 'PiggyBank', '#EFCE7B', 12, true),
  (1260, 'asset', 'investments', 'roth_ira', 'Roth IRA', 'PiggyBank', '#D3B6D3', 13, true),
  (1280, 'asset', 'investments', 'hsa_investment', 'HSA Investment', 'Heart', '#F4BEAE', 14, true),
  (1300, 'asset', 'investments', 'plan_529', '529 Plan', 'GraduationCap', '#B8CEE8', 15, true),
  (1320, 'asset', 'investments', 'crypto_wallet', 'Crypto Wallet', 'Coins', '#EFCE7B', 16, true),
  (1340, 'asset', 'investments', 'private_investment', 'Private Investment', 'TrendingUp', '#AACC96', 17, true),
  (1380, 'asset', 'investments', 'other_investment', 'Other Investment', 'DollarSign', '#52A5CE', 18, true),
  
  -- Real Estate (1400-1460)
  (1400, 'asset', 'real_estate', 'primary_residence', 'Primary Residence', 'Home', '#25533F', 19, true),
  (1420, 'asset', 'real_estate', 'secondary_residence', 'Secondary Residence', 'Hotel', '#876029', 20, true),
  (1440, 'asset', 'real_estate', 'land', 'Land', 'Trees', '#AFAB23', 21, true),
  (1460, 'asset', 'real_estate', 'other_real_estate', 'Other Real Estate', 'Building2', '#25533F', 22, true),
  
  -- Vehicles (1500-1540)
  (1500, 'asset', 'vehicles', 'personal_vehicle', 'Personal Vehicle', 'Car', '#876029', 23, true),
  (1520, 'asset', 'vehicles', 'recreational_vehicle', 'Recreational Vehicle', 'Bus', '#AFAB23', 24, true),
  (1540, 'asset', 'vehicles', 'other_vehicle', 'Other Vehicle', 'Bike', '#876029', 25, true),
  
  -- Personal Property (1600-1680)
  (1600, 'asset', 'personal_property', 'valuables', 'Valuables', 'Crown', '#EFCE7B', 26, true),
  (1620, 'asset', 'personal_property', 'collectibles', 'Collectibles', 'Trophy', '#EFCE7B', 27, true),
  (1640, 'asset', 'personal_property', 'art', 'Art', 'Palette', '#FF7BAC', 28, true),
  (1680, 'asset', 'personal_property', 'other_personal_property', 'Other Personal Property', 'Package', '#D3B6D3', 29, true),
  
  -- ============================================================================
  -- LIABILITIES (10 accounts: 2000-2280)
  -- ============================================================================
  
  -- Credit Cards (2000)
  (2000, 'liability', 'credit_cards', 'personal_credit_card', 'Personal Credit Card', 'CreditCard', '#6D1F42', 30, true),
  
  -- Loans (2100-2280)
  (2100, 'liability', 'loans', 'mortgage_primary', 'Primary Mortgage', 'Home', '#6D1F42', 31, true),
  (2120, 'liability', 'loans', 'mortgage_secondary', 'Secondary Mortgage', 'Hotel', '#876029', 32, true),
  (2140, 'liability', 'loans', 'auto_loan', 'Auto Loan', 'Car', '#EF6F3C', 33, true),
  (2160, 'liability', 'loans', 'rv_loan', 'RV Loan', 'Bus', '#876029', 34, true),
  (2180, 'liability', 'loans', 'student_loan', 'Student Loan', 'GraduationCap', '#EF6F3C', 35, true),
  (2200, 'liability', 'loans', 'personal_loan', 'Personal Loan', 'DollarSign', '#876029', 36, true),
  (2220, 'liability', 'loans', 'line_of_credit', 'Line of Credit', 'Wallet', '#EF6F3C', 37, true),
  (2240, 'liability', 'loans', 'medical_debt', 'Medical Debt', 'Heart', '#6D1F42', 38, true),
  (2280, 'liability', 'loans', 'other_debt', 'Other Debt', 'CreditCard', '#6D1F42', 39, true),
  
  -- ============================================================================
  -- EQUITY (2 accounts: 3000-3200)
  -- ============================================================================
  
  (3000, 'equity', 'equity_adjustments', 'opening_balance_equity', 'Opening Balance Equity', 'TrendingUp', '#25533F', 40, false),
  (3200, 'equity', 'equity_adjustments', 'net_worth_adjustment', 'Net Worth Adjustment', 'TrendingUp', '#AFAB23', 41, false),
  
  -- ============================================================================
  -- INCOME (8 accounts: 4000-4260)
  -- These will be auto-provisioned as ACTIVE for budgeting
  -- ============================================================================
  
  -- Earned Income (4000-4060)
  (4000, 'income', 'earned_income', 'earned_income', 'Salary', 'Briefcase', '#AACC96', 42, true),
  (4020, 'income', 'earned_income', 'earned_income', 'Bonus', 'TrendingUp', '#EFCE7B', 43, true),
  (4040, 'income', 'earned_income', 'earned_income', 'Commission', 'TrendingUp', '#AACC96', 44, true),
  (4060, 'income', 'earned_income', 'earned_income', 'Side Income', 'Briefcase', '#AACC96', 45, true),
  
  -- Passive Income (4200-4260)
  (4200, 'income', 'passive_income', 'passive_income', 'Investment Income', 'LineChart', '#AACC96', 46, true),
  (4220, 'income', 'passive_income', 'passive_income', 'Rental Income', 'KeyRound', '#EFCE7B', 47, true),
  (4240, 'income', 'passive_income', 'passive_income', 'Gifts Received', 'Gift', '#B8CEE8', 48, true),
  (4260, 'income', 'passive_income', 'passive_income', 'Other Income', 'Wallet', '#AACC96', 49, true),
  
  -- ============================================================================
  -- EXPENSES (30 accounts: 6000-9000)
  -- These will be auto-provisioned as ACTIVE for budgeting
  -- ============================================================================
  
  -- Housing (6000-6040)
  (6000, 'expense', 'housing', 'housing', 'Mortgage / Rent', 'Home', '#52A5CE', 50, true),
  (6020, 'expense', 'housing', 'housing', 'Home Maintenance', 'Hammer', '#B8CEE8', 51, true),
  (6040, 'expense', 'housing', 'housing', 'HOA Fees', 'Landmark', '#52A5CE', 52, true),
  
  -- Utilities (6100-6120)
  (6100, 'expense', 'utilities', 'utilities', 'Internet', 'Wifi', '#EFCE7B', 53, true),
  (6120, 'expense', 'utilities', 'utilities', 'Phone', 'Smartphone', '#EFCE7B', 54, true),
  
  -- Food & Dining (6200-6220)
  (6200, 'expense', 'food_dining', 'food_dining', 'Groceries', 'ShoppingCart', '#AACC96', 55, true),
  (6220, 'expense', 'food_dining', 'food_dining', 'Dining Out', 'Utensils', '#EF6F3C', 56, true),
  
  -- Transportation (6300-6340)
  (6300, 'expense', 'transportation', 'transportation', 'Transportation', 'Car', '#876029', 57, true),
  (6320, 'expense', 'transportation', 'transportation', 'Gas & Fuel', 'Fuel', '#876029', 58, true),
  (6340, 'expense', 'transportation', 'transportation', 'Vehicle Maintenance', 'Settings', '#876029', 59, true),
  
  -- Insurance (6400)
  (6400, 'expense', 'insurance', 'insurance', 'Insurance', 'Shield', '#52A5CE', 60, true),
  
  -- Healthcare (6500-6520)
  (6500, 'expense', 'healthcare', 'healthcare', 'Healthcare', 'Activity', '#FF7BAC', 61, true),
  (6520, 'expense', 'healthcare', 'healthcare', 'Medical Expenses', 'Pill', '#FF7BAC', 62, true),
  
  -- Kids & Family (6600-6620)
  (6600, 'expense', 'kids_family', 'kids_family', 'Kids & Family', 'Baby', '#F4BEAE', 63, true),
  (6620, 'expense', 'kids_family', 'kids_family', 'Childcare', 'Users', '#F4BEAE', 64, true),
  
  -- Education (6700-6720)
  (6700, 'expense', 'education', 'education', 'Education', 'BookOpen', '#D3B6D3', 65, true),
  (6720, 'expense', 'education', 'education', 'Tuition', 'GraduationCap', '#D3B6D3', 66, true),
  
  -- Subscriptions (6800)
  (6800, 'expense', 'subscriptions', 'subscriptions', 'Subscriptions', 'Radio', '#52A5CE', 67, true),
  
  -- Shopping (6900)
  (6900, 'expense', 'shopping', 'shopping', 'Shopping', 'ShoppingBag', '#FF7BAC', 68, true),
  
  -- Travel (7000)
  (7000, 'expense', 'travel', 'travel', 'Travel', 'Plane', '#B8CEE8', 69, true),
  
  -- Lifestyle (7100-7120)
  (7100, 'expense', 'lifestyle', 'lifestyle', 'Lifestyle', 'Sparkles', '#EFCE7B', 70, true),
  (7120, 'expense', 'lifestyle', 'lifestyle', 'Entertainment', 'Film', '#EF6F3C', 71, true),
  
  -- Personal Care (7150)
  (7150, 'expense', 'personal_care', 'personal_care', 'Personal Care', 'Sparkles', '#FF7BAC', 72, true),
  
  -- Professional Services (7200)
  (7200, 'expense', 'professional_services', 'professional_services', 'Professional Services', 'Briefcase', '#52A5CE', 73, true),
  
  -- Pets (7300)
  (7300, 'expense', 'pets', 'pets', 'Pets', 'Dog', '#AACC96', 74, true),
  
  -- Financial (7400-7420)
  (7400, 'expense', 'financial', 'financial', 'Financial Fees', 'FileText', '#876029', 75, true),
  (7420, 'expense', 'financial', 'financial', 'Bank Fees', 'CreditCard', '#876029', 76, true),
  
  -- Giving (7500-7520)
  (7500, 'expense', 'giving', 'giving', 'Giving', 'HandHeart', '#FF7BAC', 77, true),
  (7520, 'expense', 'giving', 'giving', 'Donations', 'CircleDollarSign', '#FF7BAC', 78, true),
  
  -- Taxes (9000)
  (9000, 'expense', 'taxes', 'taxes', 'Taxes', 'Calculator', '#876029', 79, true);

-- Verify row count
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE class = 'asset') as assets,
  COUNT(*) FILTER (WHERE class = 'liability') as liabilities,
  COUNT(*) FILTER (WHERE class = 'equity') as equity,
  COUNT(*) FILTER (WHERE class = 'income') as income,
  COUNT(*) FILTER (WHERE class = 'expense') as expenses
FROM chart_of_accounts_templates;
