# Database Schema Fix Summary

## Problem
The application was throwing `PGRST204` errors when creating accounts because:
- Database `accounts` table had a column named `balance`
- Frontend code was sending `current_balance` in INSERT/UPDATE requests
- Column name mismatch caused all account creation operations to fail

## Root Cause
Migration `20251220043425_recreate_unified_chart_of_accounts_v3.sql` created the accounts table with a `balance` column, but:
- Other tables (liabilities, equity) used `current_balance`
- Frontend code consistently expected `current_balance`
- This inconsistency caused API errors

## Solution Applied

### 1. Database Migration
**File**: New migration `rename_accounts_balance_to_current_balance`
- Renamed `accounts.balance` → `accounts.current_balance`
- Standardized naming across all balance-tracking tables
- Preserved all existing data

### 2. Plaid Import Edge Function
**File**: `supabase/functions/plaid-complete-import/index.ts`
- Updated to use unified `accounts` table instead of separate `bank_accounts` and `credit_cards` tables
- Added account number generation logic
- Fixed field mapping to use correct column names (`current_balance`, `institution_name`, `account_number_last4`)
- Updated merge logic to reference `accounts` table

### 3. Frontend Data Mapping
**File**: `src/components/hooks/useAllAccounts.jsx`
- Removed unnecessary `current_balance: a.balance` mappings
- Database now returns `current_balance` directly
- Simplified data transformation logic

## Verification
✅ Database migration applied successfully
✅ `accounts` table now has `current_balance` column (not `balance`)
✅ Frontend build passes with no errors
✅ Plaid import function updated to use unified accounts table
✅ All balance references standardized across the application

## Impact
- Account creation through UI now works correctly
- Plaid import flow uses proper unified accounts table
- No more PGRST204 errors
- Consistent column naming across all balance-tracking tables

## Notes
- The API client (`supabaseClient.js`) already maps both `BankAccount` and `CreditCard` to the unified `accounts` table
- Existing code using `base44.entities.BankAccount.create()` automatically works with the corrected schema
- Old `bank_accounts` and `credit_cards` tables still exist for historical data but new operations use `accounts` table
