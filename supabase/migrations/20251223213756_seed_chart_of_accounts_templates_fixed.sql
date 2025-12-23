/*
  # Seed Chart of Accounts Templates (Fixed)

  ## Overview
  Seeds all 81 standard chart of accounts templates organized by:
  - Assets (1000-1999): 29 accounts
  - Liabilities (2000-2999): 10 accounts  
  - Equity (3000-3999): 2 accounts
  - Income (4000-4999): 10 accounts (with range 4100-4999 for user-created)
  - Expenses (5000-5999): 30 accounts (with range 5100-5999 for user-created)
*/

-- ASSETS (1000-1999)
INSERT INTO chart_of_accounts_templates (account_number, account_type, display_name_default, level, is_editable, sort_order) VALUES
(1000, 'asset', 'Assets', 1, false, 1);

-- Cash
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(1010, 'asset', 'cash', 'Cash', 2, 1000, false, 1),
(1011, 'asset', 'cash', 'Physical Cash', 3, 1010, true, 1),
(1012, 'asset', 'cash', 'Cash on Hand', 3, 1010, true, 2),
(1013, 'asset', 'cash', 'Digital Wallet Cash', 3, 1010, true, 3),
(1014, 'asset', 'cash', 'Petty Cash', 3, 1010, true, 4),
(1015, 'asset', 'cash', 'Emergency Cash', 3, 1010, true, 5);

-- Bank Accounts
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(1050, 'asset', 'bank accounts', 'Bank Accounts', 2, 1000, false, 2),
(1051, 'asset', 'bank accounts', 'Checking', 3, 1050, true, 1),
(1052, 'asset', 'bank accounts', 'Savings', 3, 1050, true, 2),
(1053, 'asset', 'bank accounts', 'High Yield Savings', 3, 1050, true, 3),
(1054, 'asset', 'bank accounts', 'Money Market', 3, 1050, true, 4);

-- Investments
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(1100, 'asset', 'investments', 'Investments', 2, 1000, false, 3),
(1101, 'asset', 'investments', 'Brokerage', 3, 1100, true, 1),
(1102, 'asset', 'investments', '401k', 3, 1100, true, 2),
(1103, 'asset', 'investments', 'Traditional IRA', 3, 1100, true, 3),
(1104, 'asset', 'investments', 'Roth IRA', 3, 1100, true, 4),
(1105, 'asset', 'investments', 'HSA Investment', 3, 1100, true, 5),
(1106, 'asset', 'investments', '529 Plan', 3, 1100, true, 6),
(1107, 'asset', 'investments', 'Crypto Wallet', 3, 1100, true, 7),
(1108, 'asset', 'investments', 'Private Investment', 3, 1100, true, 8),
(1109, 'asset', 'investments', 'Other Investment', 3, 1100, true, 9);

-- Real Estate
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(1200, 'asset', 'real estate', 'Real Estate', 2, 1000, false, 4),
(1201, 'asset', 'real estate', 'Primary Residence', 3, 1200, true, 1),
(1202, 'asset', 'real estate', 'Secondary Residence', 3, 1200, true, 2),
(1203, 'asset', 'real estate', 'Land', 3, 1200, true, 3),
(1204, 'asset', 'real estate', 'Other Property', 3, 1200, true, 4);

-- Vehicle
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(1300, 'asset', 'vehicle', 'Vehicle', 2, 1000, false, 5),
(1301, 'asset', 'vehicle', 'Personal Vehicle', 3, 1300, true, 1),
(1302, 'asset', 'vehicle', 'Recreational Vehicle', 3, 1300, true, 2),
(1303, 'asset', 'vehicle', 'Other Vehicle', 3, 1300, true, 3);

-- Personal Property
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(1400, 'asset', 'personal property', 'Personal Property', 2, 1000, false, 6),
(1401, 'asset', 'personal property', 'Valuables', 3, 1400, true, 1),
(1402, 'asset', 'personal property', 'Collectibles', 3, 1400, true, 2),
(1403, 'asset', 'personal property', 'Art', 3, 1400, true, 3),
(1404, 'asset', 'personal property', 'Other Personal Property', 3, 1400, true, 4);

-- LIABILITIES (2000-2999)
INSERT INTO chart_of_accounts_templates (account_number, account_type, display_name_default, level, is_editable, sort_order) VALUES
(2000, 'liability', 'Liabilities', 1, false, 2);

-- Credit Card
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(2010, 'liability', 'credit card', 'Credit Card', 2, 2000, false, 1),
(2011, 'liability', 'credit card', 'Personal Credit Card', 3, 2010, true, 1);

-- Loans & Debt
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(2100, 'liability', 'loans & debt', 'Loans & Debt', 2, 2000, false, 2),
(2101, 'liability', 'loans & debt', 'Mortgage Primary', 3, 2100, true, 1),
(2102, 'liability', 'loans & debt', 'Mortgage Secondary', 3, 2100, true, 2),
(2103, 'liability', 'loans & debt', 'Auto Loan', 3, 2100, true, 3),
(2104, 'liability', 'loans & debt', 'Recreational Vehicle Loan', 3, 2100, true, 4),
(2105, 'liability', 'loans & debt', 'Student Loan', 3, 2100, true, 5),
(2106, 'liability', 'loans & debt', 'Personal Loan', 3, 2100, true, 6),
(2107, 'liability', 'loans & debt', 'Line of Credit', 3, 2100, true, 7),
(2108, 'liability', 'loans & debt', 'Medical Debt', 3, 2100, true, 8),
(2109, 'liability', 'loans & debt', 'Other Debt', 3, 2100, true, 9);

-- EQUITY (3000-3999)
INSERT INTO chart_of_accounts_templates (account_number, account_type, display_name_default, level, is_editable, sort_order) VALUES
(3000, 'equity', 'Equity', 1, false, 3);

INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(3010, 'equity', 'equity adjustments', 'Equity Adjustments', 2, 3000, false, 1),
(3011, 'equity', 'equity adjustments', 'Opening Balance Equity', 3, 3010, false, 1),
(3012, 'equity', 'equity adjustments', 'Net Worth Adjustments', 3, 3010, false, 2);

-- INCOME (4000-4999) - with user-creatable range 4100-4999
INSERT INTO chart_of_accounts_templates (account_number, account_type, display_name_default, level, is_editable, sort_order, number_range_start, number_range_end) VALUES
(4000, 'income', 'Income', 1, false, 4, 4100, 4999);

-- Earned Income
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(4010, 'income', 'earned income', 'Earned Income', 2, 4000, false, 1),
(4011, 'income', 'earned income', 'Salary', 3, 4010, true, 1),
(4012, 'income', 'earned income', 'Bonus', 3, 4010, true, 2),
(4013, 'income', 'earned income', 'Commission', 3, 4010, true, 3),
(4014, 'income', 'earned income', 'Side Income', 3, 4010, true, 4);

-- Passive & Other Income
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(4050, 'income', 'passive & other income', 'Passive & Other Income', 2, 4000, false, 2),
(4051, 'income', 'passive & other income', 'Interest', 3, 4050, true, 1),
(4052, 'income', 'passive & other income', 'Dividends', 3, 4050, true, 2),
(4053, 'income', 'passive & other income', 'Investment Income', 3, 4050, true, 3),
(4054, 'income', 'passive & other income', 'Rental Income Personal', 3, 4050, true, 4),
(4055, 'income', 'passive & other income', 'Gifts Received', 3, 4050, true, 5),
(4056, 'income', 'passive & other income', 'Other Income', 3, 4050, true, 6);

-- EXPENSES (5000-5999) - with user-creatable range 5100-5999
INSERT INTO chart_of_accounts_templates (account_number, account_type, display_name_default, level, is_editable, sort_order, number_range_start, number_range_end) VALUES
(5000, 'expense', 'Expenses', 1, false, 5, 5100, 5999);

-- All expense categories as level 3 (directly under Expenses)
INSERT INTO chart_of_accounts_templates (account_number, account_type, account_detail, category, display_name_default, level, parent_account_number, is_editable, sort_order) VALUES
(5001, 'expense', 'taxes', 'taxes', 'Taxes', 3, 5000, true, 30),
(5010, 'expense', 'housing', 'housing', 'Housing', 3, 5000, true, 1),
(5011, 'expense', 'housing', 'rent / mortgage', 'Rent / Mortgage', 3, 5000, true, 2),
(5012, 'expense', 'housing', 'home maintenance', 'Home Maintenance', 3, 5000, true, 3),
(5013, 'expense', 'housing', 'hoa fees', 'HOA Fees', 3, 5000, true, 4),
(5020, 'expense', 'utilities', 'utilities', 'Utilities', 3, 5000, true, 5),
(5021, 'expense', 'utilities', 'internet', 'Internet', 3, 5000, true, 6),
(5022, 'expense', 'utilities', 'phone', 'Phone', 3, 5000, true, 7),
(5030, 'expense', 'food & dining', 'groceries', 'Groceries', 3, 5000, true, 8),
(5031, 'expense', 'food & dining', 'dining out', 'Dining Out', 3, 5000, true, 9),
(5040, 'expense', 'transportation', 'transportation', 'Transportation', 3, 5000, true, 10),
(5041, 'expense', 'transportation', 'gas & fuel', 'Gas & Fuel', 3, 5000, true, 11),
(5042, 'expense', 'transportation', 'vehicle maintenance', 'Vehicle Maintenance', 3, 5000, true, 12),
(5050, 'expense', 'insurance', 'insurance', 'Insurance', 3, 5000, true, 13),
(5060, 'expense', 'healthcare', 'healthcare', 'Healthcare', 3, 5000, true, 14),
(5061, 'expense', 'healthcare', 'medical expenses', 'Medical Expenses', 3, 5000, true, 15),
(5070, 'expense', 'kids & family', 'kids & family', 'Kids & Family', 3, 5000, true, 16),
(5071, 'expense', 'kids & family', 'childcare', 'Childcare', 3, 5000, true, 17),
(5080, 'expense', 'education', 'education', 'Education', 3, 5000, true, 18),
(5081, 'expense', 'education', 'tuition', 'Tuition', 3, 5000, true, 19),
(5090, 'expense', 'subscriptions', 'subscriptions', 'Subscriptions', 3, 5000, true, 20),
(5091, 'expense', 'shopping', 'shopping', 'Shopping', 3, 5000, true, 21),
(5092, 'expense', 'travel', 'travel', 'Travel', 3, 5000, true, 22),
(5093, 'expense', 'lifestyle', 'lifestyle', 'Lifestyle', 3, 5000, true, 23),
(5094, 'expense', 'lifestyle', 'entertainment', 'Entertainment', 3, 5000, true, 24),
(5095, 'expense', 'pets', 'pets', 'Pets', 3, 5000, true, 25),
(5096, 'expense', 'financial', 'financial fees', 'Financial Fees', 3, 5000, true, 26),
(5097, 'expense', 'financial', 'bank fees', 'Bank Fees', 3, 5000, true, 27),
(5098, 'expense', 'giving', 'giving', 'Giving', 3, 5000, true, 28),
(5099, 'expense', 'giving', 'donations', 'Donations', 3, 5000, true, 29);