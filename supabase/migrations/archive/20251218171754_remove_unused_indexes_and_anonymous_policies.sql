/*
  # Security Improvements: Remove Unused Indexes and Anonymous Access

  ## Changes Made
  
  ### 1. Drop Unused Indexes (43 total)
  Removes unused indexes to improve database performance and reduce storage overhead:
  - Amazon order tracking indexes (2)
  - Service connections indexes (3)
  - User relationships indexes (3)
  - Shared resources indexes (3)
  - Bank accounts indexes (2)
  - Budgets indexes (3)
  - Categories indexes (1)
  - Assets indexes (2)
  - Liabilities indexes (2)
  - Household groups indexes (1)
  - Household members indexes (2)
  - Invitations indexes (3)
  - Contacts indexes (6)
  - Credit cards indexes (3)
  - Payment reminders indexes (5)
  - User profiles indexes (2)
  - Transaction payment method index (1)

  ### 2. Remove Anonymous Access Policies
  Drops all policies that allow unauthenticated (anon) access to sensitive data:
  - bank_accounts: Remove anon view/insert/update/delete policies
  - budgets: Remove anon view/insert/update/delete policies
  - budget_groups: Remove anon view/insert/update/delete policies
  - categories: Remove anon view/insert/update/delete policies
  - transactions: Remove anon view/insert/update/delete policies
  - assets: Remove anon view/insert/update/delete policies
  - liabilities: Remove anon view/insert/update/delete policies
  - contacts: Remove anon view/insert/update/delete policies

  ### 3. Security Impact
  - All data access now requires authentication
  - Authenticated policies remain in place to allow users to access their own data
  - Proper user_id checks ensure data isolation
  - Credit cards and payment reminders already had no anon policies

  ### 4. Password Breach Protection
  Note: Password breach protection must be enabled in Supabase Auth settings (Dashboard > Authentication > Providers > Email).
  This cannot be configured at the database level.
*/

-- Drop unused indexes on transactions
DROP INDEX IF EXISTS idx_transactions_amazon_order_id;
DROP INDEX IF EXISTS idx_transactions_is_amazon_order;
DROP INDEX IF EXISTS idx_transactions_payment_method;

-- Drop unused indexes on service_connections
DROP INDEX IF EXISTS idx_service_connections_user_id;
DROP INDEX IF EXISTS idx_service_connections_service_name;
DROP INDEX IF EXISTS idx_service_connections_status;

-- Drop unused indexes on user_relationships
DROP INDEX IF EXISTS idx_user_relationships_user_id;
DROP INDEX IF EXISTS idx_user_relationships_related_user_id;
DROP INDEX IF EXISTS idx_user_relationships_status;

-- Drop unused indexes on shared_resources
DROP INDEX IF EXISTS idx_shared_resources_owner;
DROP INDEX IF EXISTS idx_shared_resources_shared_with;
DROP INDEX IF EXISTS idx_shared_resources_resource;

-- Drop unused indexes on bank_accounts
DROP INDEX IF EXISTS idx_bank_accounts_user_id;
DROP INDEX IF EXISTS idx_bank_accounts_parent_account_id;

-- Drop unused indexes on budgets
DROP INDEX IF EXISTS idx_budgets_user_id;
DROP INDEX IF EXISTS idx_budgets_group_id;
DROP INDEX IF EXISTS idx_budgets_parent_budget_id;

-- Drop unused indexes on categories
DROP INDEX IF EXISTS idx_categories_user_id;

-- Drop unused indexes on assets
DROP INDEX IF EXISTS idx_assets_user_id;
DROP INDEX IF EXISTS idx_assets_parent_account_id;

-- Drop unused indexes on liabilities
DROP INDEX IF EXISTS idx_liabilities_user_id;
DROP INDEX IF EXISTS idx_liabilities_parent_account_id;

-- Drop unused indexes on household_groups
DROP INDEX IF EXISTS idx_household_groups_created_by;

-- Drop unused indexes on household_members
DROP INDEX IF EXISTS idx_household_members_household_id;
DROP INDEX IF EXISTS idx_household_members_user_id;

-- Drop unused indexes on invitations
DROP INDEX IF EXISTS idx_invitations_inviter;
DROP INDEX IF EXISTS idx_invitations_invitee_email;
DROP INDEX IF EXISTS idx_invitations_status;

-- Drop unused indexes on contacts
DROP INDEX IF EXISTS idx_contacts_email;
DROP INDEX IF EXISTS idx_contacts_phone;
DROP INDEX IF EXISTS idx_contacts_connection_status;
DROP INDEX IF EXISTS idx_contacts_linked_user_id;
DROP INDEX IF EXISTS idx_contacts_default_category_id;
DROP INDEX IF EXISTS idx_contacts_invitation_id;

-- Drop unused indexes on credit_cards
DROP INDEX IF EXISTS idx_credit_cards_user_id;
DROP INDEX IF EXISTS idx_credit_cards_plaid_account_id;
DROP INDEX IF EXISTS idx_credit_cards_is_active;

-- Drop unused indexes on payment_reminders
DROP INDEX IF EXISTS idx_payment_reminders_user_id;
DROP INDEX IF EXISTS idx_payment_reminders_credit_card_id;
DROP INDEX IF EXISTS idx_payment_reminders_reminder_date;
DROP INDEX IF EXISTS idx_payment_reminders_status;
DROP INDEX IF EXISTS idx_payment_reminders_due_status;

-- Drop unused indexes on user_profiles
DROP INDEX IF EXISTS idx_user_profiles_email;
DROP INDEX IF EXISTS idx_user_profiles_updated_at;

-- Remove anonymous access policies from bank_accounts
DROP POLICY IF EXISTS "Allow anon to view bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow anon to insert bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow anon to update bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow anon to delete bank_accounts" ON bank_accounts;

-- Remove anonymous access policies from budgets
DROP POLICY IF EXISTS "Allow anon to view budgets" ON budgets;
DROP POLICY IF EXISTS "Allow anon to insert budgets" ON budgets;
DROP POLICY IF EXISTS "Allow anon to update budgets" ON budgets;
DROP POLICY IF EXISTS "Allow anon to delete budgets" ON budgets;

-- Remove anonymous access policies from budget_groups
DROP POLICY IF EXISTS "Allow anon to view budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Allow anon to insert budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Allow anon to update budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Allow anon to delete budget_groups" ON budget_groups;

-- Remove anonymous access policies from categories
DROP POLICY IF EXISTS "Allow anon to view categories" ON categories;
DROP POLICY IF EXISTS "Allow anon to insert categories" ON categories;
DROP POLICY IF EXISTS "Allow anon to update categories" ON categories;
DROP POLICY IF EXISTS "Allow anon to delete categories" ON categories;

-- Remove anonymous access policies from transactions
DROP POLICY IF EXISTS "Allow anon to view transactions" ON transactions;
DROP POLICY IF EXISTS "Allow anon to insert transactions" ON transactions;
DROP POLICY IF EXISTS "Allow anon to update transactions" ON transactions;
DROP POLICY IF EXISTS "Allow anon to delete transactions" ON transactions;

-- Remove anonymous access policies from assets  
DROP POLICY IF EXISTS "Allow anon to view assets" ON assets;
DROP POLICY IF EXISTS "Allow anon to insert assets" ON assets;
DROP POLICY IF EXISTS "Allow anon to update assets" ON assets;
DROP POLICY IF EXISTS "Allow anon to delete assets" ON assets;

-- Remove anonymous access policies from liabilities
DROP POLICY IF EXISTS "Allow anon to view liabilities" ON liabilities;
DROP POLICY IF EXISTS "Allow anon to insert liabilities" ON liabilities;
DROP POLICY IF EXISTS "Allow anon to update liabilities" ON liabilities;
DROP POLICY IF EXISTS "Allow anon to delete liabilities" ON liabilities;

-- Remove anonymous access policies from contacts
DROP POLICY IF EXISTS "Allow anon to view contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anon to insert contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anon to update contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anon to delete contacts" ON contacts;