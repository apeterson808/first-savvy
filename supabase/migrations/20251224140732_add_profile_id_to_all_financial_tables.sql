/*
  # Add profile_id to All Financial Tables

  ## Overview
  Adds profile_id column to all financial tables to support multi-profile system.
  Keeps user_id columns for now to support dual-write migration period.

  ## Tables Modified
  Core Financial:
  - accounts (checking, savings, credit card accounts)
  - transactions
  - budgets
  - budget_groups
  - contacts
  - credit_cards
  - bills
  - credit_scores
  - plaid_items

  Assets, Liabilities, Equity:
  - assets
  - liabilities
  - equity
  - asset_liability_links

  Chart of Accounts:
  - user_chart_of_accounts

  ## Safety
  - All foreign keys use ON DELETE RESTRICT to prevent accidental data loss
  - user_id columns remain for dual-write period (will be dropped in future phase)
  - Nullable initially to allow data migration in next step
*/

-- Core Financial Tables

ALTER TABLE accounts 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_accounts_profile_id ON accounts(profile_id);

ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_transactions_profile_id ON transactions(profile_id);

ALTER TABLE budgets 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_budgets_profile_id ON budgets(profile_id);

ALTER TABLE budget_groups 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_budget_groups_profile_id ON budget_groups(profile_id);

ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_contacts_profile_id ON contacts(profile_id);

ALTER TABLE credit_cards 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_credit_cards_profile_id ON credit_cards(profile_id);

ALTER TABLE bills 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_bills_profile_id ON bills(profile_id);

ALTER TABLE credit_scores 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_credit_scores_profile_id ON credit_scores(profile_id);

ALTER TABLE plaid_items 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_plaid_items_profile_id ON plaid_items(profile_id);

-- Assets, Liabilities, Equity

ALTER TABLE assets 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_assets_profile_id ON assets(profile_id);

ALTER TABLE liabilities 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_liabilities_profile_id ON liabilities(profile_id);

ALTER TABLE equity 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_equity_profile_id ON equity(profile_id);

ALTER TABLE asset_liability_links 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_asset_liability_links_profile_id ON asset_liability_links(profile_id);

-- Chart of Accounts

ALTER TABLE user_chart_of_accounts 
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_user_chart_of_accounts_profile_id ON user_chart_of_accounts(profile_id);
