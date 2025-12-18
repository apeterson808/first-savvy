/*
  # Add Foreign Key Indexes for Performance

  ## Changes Made
  
  ### 1. Add Missing Foreign Key Indexes
  Creates indexes on all foreign key columns to improve query performance and JOIN operations:
  
  #### Assets Table (2 indexes)
  - `idx_assets_user_id` - Index on user_id foreign key
  - `idx_assets_parent_account_id` - Index on parent_account_id foreign key
  
  #### Bank Accounts Table (2 indexes)
  - `idx_bank_accounts_user_id` - Index on user_id foreign key
  - `idx_bank_accounts_parent_account_id` - Index on parent_account_id foreign key
  
  #### Budgets Table (3 indexes)
  - `idx_budgets_user_id` - Index on user_id foreign key
  - `idx_budgets_group_id` - Index on group_id foreign key
  - `idx_budgets_parent_budget_id` - Index on parent_budget_id foreign key
  
  #### Categories Table (1 index)
  - `idx_categories_user_id` - Index on user_id foreign key
  
  #### Contacts Table (2 indexes)
  - `idx_contacts_default_category_id` - Index on default_category_id foreign key
  - `idx_contacts_invitation_id` - Index on invitation_id foreign key
  
  #### Credit Cards Table (1 index)
  - `idx_credit_cards_user_id` - Index on user_id foreign key
  
  #### Liabilities Table (2 indexes)
  - `idx_liabilities_user_id` - Index on user_id foreign key
  - `idx_liabilities_parent_account_id` - Index on parent_account_id foreign key
  
  #### Payment Reminders Table (2 indexes)
  - `idx_payment_reminders_user_id` - Index on user_id foreign key
  - `idx_payment_reminders_credit_card_id` - Index on credit_card_id foreign key
  
  ### 2. Performance Impact
  - Improves JOIN performance on foreign key relationships
  - Speeds up queries filtering by foreign key columns
  - Enhances cascade delete/update operations
  - Reduces table scan overhead for relationship queries
  
  ### 3. Total Indexes Added
  15 indexes covering all unindexed foreign key columns
*/

-- Add indexes for assets table
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_parent_account_id ON assets(parent_account_id);

-- Add indexes for bank_accounts table
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_parent_account_id ON bank_accounts(parent_account_id);

-- Add indexes for budgets table
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_group_id ON budgets(group_id);
CREATE INDEX IF NOT EXISTS idx_budgets_parent_budget_id ON budgets(parent_budget_id);

-- Add indexes for categories table
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Add indexes for contacts table
CREATE INDEX IF NOT EXISTS idx_contacts_default_category_id ON contacts(default_category_id);
CREATE INDEX IF NOT EXISTS idx_contacts_invitation_id ON contacts(invitation_id);

-- Add indexes for credit_cards table
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);

-- Add indexes for liabilities table
CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_parent_account_id ON liabilities(parent_account_id);

-- Add indexes for payment_reminders table
CREATE INDEX IF NOT EXISTS idx_payment_reminders_user_id ON payment_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_credit_card_id ON payment_reminders(credit_card_id);