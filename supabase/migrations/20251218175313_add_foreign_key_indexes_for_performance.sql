/*
  # Add Foreign Key Indexes for Performance

  ## Overview
  This migration adds indexes on foreign key columns to improve query performance.
  Foreign keys without indexes can cause slow queries, especially for JOIN operations
  and referential integrity checks.

  ## Changes Made

  ### 1. Assets Table Indexes
  - `idx_assets_parent_account_id` - Index on parent_account_id foreign key
  - `idx_assets_user_id` - Index on user_id foreign key

  ### 2. Bank Accounts Table Indexes
  - `idx_bank_accounts_parent_account_id` - Index on parent_account_id foreign key
  - `idx_bank_accounts_user_id` - Index on user_id foreign key

  ### 3. Budgets Table Indexes
  - `idx_budgets_group_id` - Index on group_id foreign key
  - `idx_budgets_parent_budget_id` - Index on parent_budget_id foreign key
  - `idx_budgets_user_id` - Index on user_id foreign key

  ### 4. Categories Table Indexes
  - `idx_categories_user_id` - Index on user_id foreign key

  ### 5. Contacts Table Indexes
  - `idx_contacts_default_category_id` - Index on default_category_id foreign key
  - `idx_contacts_invitation_id` - Index on invitation_id foreign key

  ### 6. Credit Cards Table Indexes
  - `idx_credit_cards_user_id` - Index on user_id foreign key

  ### 7. Liabilities Table Indexes
  - `idx_liabilities_parent_account_id` - Index on parent_account_id foreign key
  - `idx_liabilities_user_id` - Index on user_id foreign key

  ### 8. Payment Reminders Table Indexes
  - `idx_payment_reminders_credit_card_id` - Index on credit_card_id foreign key
  - `idx_payment_reminders_user_id` - Index on user_id foreign key

  ## Performance Benefits
  - Faster JOIN operations
  - Improved referential integrity check performance
  - Better query optimization for WHERE clauses on foreign keys
  - Reduced database load during CASCADE operations
*/

-- Assets table indexes
CREATE INDEX IF NOT EXISTS idx_assets_parent_account_id ON assets(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);

-- Bank accounts table indexes
CREATE INDEX IF NOT EXISTS idx_bank_accounts_parent_account_id ON bank_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);

-- Budgets table indexes
CREATE INDEX IF NOT EXISTS idx_budgets_group_id ON budgets(group_id);
CREATE INDEX IF NOT EXISTS idx_budgets_parent_budget_id ON budgets(parent_budget_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);

-- Categories table indexes
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Contacts table indexes
CREATE INDEX IF NOT EXISTS idx_contacts_default_category_id ON contacts(default_category_id);
CREATE INDEX IF NOT EXISTS idx_contacts_invitation_id ON contacts(invitation_id);

-- Credit cards table indexes
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);

-- Liabilities table indexes
CREATE INDEX IF NOT EXISTS idx_liabilities_parent_account_id ON liabilities(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON liabilities(user_id);

-- Payment reminders table indexes
CREATE INDEX IF NOT EXISTS idx_payment_reminders_credit_card_id ON payment_reminders(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_user_id ON payment_reminders(user_id);
