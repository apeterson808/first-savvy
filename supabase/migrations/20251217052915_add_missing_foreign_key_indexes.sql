/*
  # Add Missing Foreign Key Indexes

  1. New Indexes
    - `idx_assets_parent_account_id` on assets(parent_account_id)
    - `idx_bank_accounts_parent_account_id` on bank_accounts(parent_account_id)
    - `idx_contacts_default_category_id` on contacts(default_category_id)
    - `idx_contacts_invitation_id` on contacts(invitation_id)
    - `idx_credit_cards_parent_account_id` on credit_cards(parent_account_id)
    - `idx_liabilities_parent_account_id` on liabilities(parent_account_id)
  
  2. Purpose
    - Improve query performance for foreign key lookups
    - Prevent suboptimal query performance warnings
*/

CREATE INDEX IF NOT EXISTS idx_assets_parent_account_id ON assets(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_parent_account_id ON bank_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_default_category_id ON contacts(default_category_id);
CREATE INDEX IF NOT EXISTS idx_contacts_invitation_id ON contacts(invitation_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_parent_account_id ON credit_cards(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_parent_account_id ON liabilities(parent_account_id);