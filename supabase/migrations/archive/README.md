# Archived Migrations

This folder contains historical migration files that have been archived as part of the database schema cleanup on January 4, 2026.

## What Happened

The database schema evolved through 183 individual migrations from December 2024 through January 2026. While functional, this created several issues:

1. **Confusing dual-column pattern**: Tables had both `user_id` and `profile_id` columns
2. **Unclear naming**: `user_profiles` stored user account settings, not financial profiles
3. **Redundant data**: `profile_tabs` duplicated data from the `profiles` table
4. **Inconsistent ownership**: Some RLS policies used `user_id`, others used `profile_id`

## The Cleanup

On January 4, 2026, the schema was consolidated and clarified with these changes:

### 1. Table Renamed
- `user_profiles` → `user_settings` (clarifies it stores account preferences, not financial data)

### 2. Single Source of Truth
- Removed `user_id` from all financial tables
- All financial data now owned exclusively by `profile_id`
- Clear separation: users have settings, profiles own financial data

### 3. Simplified Profile Tabs
- Removed redundant `profile_user_id` column
- Removed redundant `profile_name` column
- Added `v_profile_tabs_display` view for convenient querying

### 4. Fixed Foreign Keys
- `transfer_registry.profile_id` now references `profiles(id)`
- `statement_uploads.profile_id` now references `profiles(id)`

### 5. Consistent RLS Policies
- All financial tables use `has_profile_access(profile_id)` consistently
- No more mixed user_id/profile_id patterns

## Current Schema (January 2026)

### Identity & Access
- `user_settings` - User account preferences (theme, notifications, avatar)
- `profiles` - Financial data ownership contexts (personal, family, business)
- `profile_memberships` - Which users can access which profiles
- `profile_tabs` - Browser-like tabs for switching between profiles

### Financial Data (all owned by profiles)
- `user_chart_of_accounts` - Unified chart of accounts
- `transactions` - Financial transactions
- `contacts` - Vendors and customers
- `budgets` - Budget allocations
- `categorization_rules` - Auto-categorization rules
- `contact_matching_rules` - Auto-contact matching rules
- `transaction_splits` - Split transactions
- `transfer_registry` - Transfer matching registry

### Supporting Tables
- `chart_of_accounts_templates` - System-wide account templates
- `financial_institutions` - Bank/credit union directory
- `statement_cache` - Cached statements for simulation mode
- `statement_uploads` - Statement file upload tracking
- `category_templates` - Legacy category templates

## New Migration Files

The cleanup is implemented in these migrations:
1. `20260104000002_rename_user_profiles_to_user_settings.sql`
2. `20260104000004_fix_foreign_keys_drop_user_id_columns.sql`
3. `20260104000005_simplify_profile_tabs_schema.sql`

## Multi-Profile Architecture

The system supports multi-profile access:
- A user can own multiple profiles (personal, family, business)
- Users can be granted access to other users' profiles via `profile_memberships`
- All financial data is scoped to a profile, not directly to a user
- The `has_profile_access(profile_id)` function checks if the current user can access a profile

## For Future Reference

If you need to understand the historical evolution of the schema, these archived migrations provide a complete record. However, the current schema (as of January 2026) is the source of truth and should be referenced for all new development.
