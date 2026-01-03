/*
  # Seed Account Classification Templates

  ## Overview
  This migration seeds the account_classification_templates table with all predefined
  account classifications organized by class (asset, liability, income, expense, equity),
  type, and category.

  ## Data Structure
  - 23 Asset classifications across 6 types
  - 10 Liability classifications across 2 types  
  - 11 Income classifications across 2 types
  - 42 Expense classifications across 15 types
  - 3 Equity classifications across 1 type
  
  Total: 89 predefined classifications

  ## Notes
  - display_order controls UI sort order within each type
  - All classifications are active by default
  - Categories can be customized by users in their own copies
  - Class and Type remain locked and cannot be modified by users
*/

-- ============================================================================
-- ASSET CLASSIFICATIONS (23 total)
-- ============================================================================

-- Asset > Cash (5)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('asset', 'cash', 'physical cash', 1),
  ('asset', 'cash', 'cash on hand', 2),
  ('asset', 'cash', 'digital wallet cash', 3),
  ('asset', 'cash', 'petty cash', 4),
  ('asset', 'cash', 'emergency cash', 5)
ON CONFLICT (class, type, category) DO NOTHING;

-- Asset > Bank Accounts (4)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('asset', 'bank accounts', 'checking', 10),
  ('asset', 'bank accounts', 'savings', 11),
  ('asset', 'bank accounts', 'high yield savings', 12),
  ('asset', 'bank accounts', 'money market', 13)
ON CONFLICT (class, type, category) DO NOTHING;

-- Asset > Investments (7)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('asset', 'investments', 'brokerage', 20),
  ('asset', 'investments', '401k', 21),
  ('asset', 'investments', 'traditional ira', 22),
  ('asset', 'investments', 'roth ira', 23),
  ('asset', 'investments', 'hsa investment', 24),
  ('asset', 'investments', '529 plan', 25),
  ('asset', 'investments', 'crypto wallet', 26),
  ('asset', 'investments', 'private investment', 27),
  ('asset', 'investments', 'other investment', 28)
ON CONFLICT (class, type, category) DO NOTHING;

-- Asset > Real Estate (4)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('asset', 'real estate', 'primary residence', 30),
  ('asset', 'real estate', 'secondary residence', 31),
  ('asset', 'real estate', 'land', 32),
  ('asset', 'real estate', 'other property', 33)
ON CONFLICT (class, type, category) DO NOTHING;

-- Asset > Vehicle (3)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('asset', 'vehicle', 'personal vehicle', 40),
  ('asset', 'vehicle', 'recreational vehicle', 41),
  ('asset', 'vehicle', 'other vehicle', 42)
ON CONFLICT (class, type, category) DO NOTHING;

-- Asset > Personal Property (4)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('asset', 'personal property', 'valuables', 50),
  ('asset', 'personal property', 'collectibles', 51),
  ('asset', 'personal property', 'art', 52),
  ('asset', 'personal property', 'other personal property', 53)
ON CONFLICT (class, type, category) DO NOTHING;

-- ============================================================================
-- LIABILITY CLASSIFICATIONS (10 total)
-- ============================================================================

-- Liability > Credit Card (2)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('liability', 'credit card', 'personal credit card', 100),
  ('liability', 'credit card', 'business credit card', 101)
ON CONFLICT (class, type, category) DO NOTHING;

-- Liability > Loans & Debt (8)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('liability', 'loans & debt', 'mortgage primary', 110),
  ('liability', 'loans & debt', 'mortgage secondary', 111),
  ('liability', 'loans & debt', 'auto loan', 112),
  ('liability', 'loans & debt', 'recreational vehicle loan', 113),
  ('liability', 'loans & debt', 'student loan', 114),
  ('liability', 'loans & debt', 'personal loan', 115),
  ('liability', 'loans & debt', 'line of credit', 116),
  ('liability', 'loans & debt', 'medical debt', 117),
  ('liability', 'loans & debt', 'other debt', 118)
ON CONFLICT (class, type, category) DO NOTHING;

-- ============================================================================
-- INCOME CLASSIFICATIONS (11 total)
-- ============================================================================

-- Income > Earned Income (7)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('income', 'earned income', 'salary', 200),
  ('income', 'earned income', 'bonus', 201),
  ('income', 'earned income', 'commission', 202),
  ('income', 'earned income', 'side income', 203)
ON CONFLICT (class, type, category) DO NOTHING;

-- Income > Passive & Other Income (7)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('income', 'passive & other income', 'interest', 210),
  ('income', 'passive & other income', 'dividends', 211),
  ('income', 'passive & other income', 'investment income', 212),
  ('income', 'passive & other income', 'rental income personal', 213),
  ('income', 'passive & other income', 'gifts received', 214),
  ('income', 'passive & other income', 'other income', 215)
ON CONFLICT (class, type, category) DO NOTHING;

-- ============================================================================
-- EXPENSE CLASSIFICATIONS (42 total)
-- ============================================================================

-- Expense > Housing (3)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'housing', 'housing', 300),
  ('expense', 'housing', 'rent / mortgage', 301),
  ('expense', 'housing', 'home maintenance', 302),
  ('expense', 'housing', 'hoa fees', 303)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Utilities (3)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'utilities', 'utilities', 310),
  ('expense', 'utilities', 'internet', 311),
  ('expense', 'utilities', 'phone', 312)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Food & Dining (2)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'food & dining', 'groceries', 320),
  ('expense', 'food & dining', 'dining out', 321)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Transportation (4)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'transportation', 'transportation', 330),
  ('expense', 'transportation', 'gas & fuel', 331),
  ('expense', 'transportation', 'vehicle maintenance', 332),
  ('expense', 'transportation', 'insurance', 333)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Healthcare (2)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'healthcare', 'healthcare', 340),
  ('expense', 'healthcare', 'medical expenses', 341)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Kids & Family (2)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'kids & family', 'kids & family', 350),
  ('expense', 'kids & family', 'childcare', 351)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Education (2)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'education', 'education', 360),
  ('expense', 'education', 'tuition', 361)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Subscriptions (1)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'subscriptions', 'subscriptions', 370)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Shopping (1)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'shopping', 'shopping', 380)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Travel (1)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'travel', 'travel', 390)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Lifestyle (2)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'lifestyle', 'lifestyle', 400),
  ('expense', 'lifestyle', 'entertainment', 401)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Pets (1)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'pets', 'pets', 410)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Financial (2)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'financial', 'financial fees', 420),
  ('expense', 'financial', 'bank fees', 421)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Giving (2)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'giving', 'giving', 430),
  ('expense', 'giving', 'donations', 431)
ON CONFLICT (class, type, category) DO NOTHING;

-- Expense > Taxes (1)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('expense', 'taxes', 'taxes', 440)
ON CONFLICT (class, type, category) DO NOTHING;

-- ============================================================================
-- EQUITY CLASSIFICATIONS (3 total)
-- ============================================================================

-- Equity > Equity Adjustments (3)
INSERT INTO account_classification_templates (class, type, category, display_order) VALUES
  ('equity', 'equity adjustments', 'opening balance equity', 500),
  ('equity', 'equity adjustments', 'owner contributions', 501),
  ('equity', 'equity adjustments', 'owner distributions', 502)
ON CONFLICT (class, type, category) DO NOTHING;
