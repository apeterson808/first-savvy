# Accounting System Architecture

## Overview

This application now follows the same professional accounting architecture used by QuickBooks, Xero, and other accounting systems. The key principle is the **two-layer system** that separates user-facing transactions from the underlying accounting engine.

## The Two-Layer System

### Layer 1: Transaction Layer (User-Facing)
- **What users see**: Bank deposits, checks, transfers, expenses
- **Where**: Transaction register for bank/asset/liability accounts
- **Purpose**: Source documents that users interact with directly
- **Display**: Checkbook-style register with running balances

### Layer 2: General Ledger Layer (Accounting Engine)
- **What happens behind the scenes**: Journal entries with debits and credits
- **Where**: Journal entry lines for income/expense/equity accounts
- **Purpose**: Maintains the double-entry accounting system
- **Display**: Debit/credit columns showing accounting impact

## How It Works

### For Bank/Asset/Liability Accounts

When viewing these accounts, the system displays:
- **Source documents**: The actual transactions (checkbook register)
- **Running balance**: Calculated from transaction amounts
- **Drill-down capability**: Link to view the journal entry that was auto-generated

**Example**: Chase Checking Account
- Shows deposits, checks, transfers as individual transaction lines
- Each transaction shows the category it was coded to
- Running balance updates with each transaction
- Click icon to see the journal entry behind each transaction

### For Income/Expense/Equity Accounts

When viewing these accounts, the system displays:
- **Journal entry lines**: The accounting activity (GL entries)
- **Debits and credits**: Proper accounting terminology
- **Offsetting accounts**: What other accounts were affected
- **Entry reference**: Journal entry number for audit trail

**Example**: Groceries Expense Account
- Shows only the debit side from journal entries
- Each line shows which bank account was credited
- No duplicate entries (transactions are NOT shown)
- Running balance calculated from debits minus credits

## The Rule: Never Show Both

**Critical principle**: Each activity is shown in only ONE place:

1. **Transaction-based accounts** (Asset, Liability):
   - Show transactions ONLY
   - Don't show journal entries
   - Reason: These accounts have source documents

2. **GL-based accounts** (Income, Expense, Equity):
   - Show journal entry lines ONLY
   - Don't show transactions
   - Reason: These accounts only have accounting activity

This prevents the "double entry" problem where everything appeared twice.

## Implementation Details

### Account Type Detection

```javascript
const isTransactionBasedAccount = useMemo(() => {
  const accountClass = account.account_class || account.class || 'asset';
  return accountClass === 'asset' || accountClass === 'liability';
}, [account]);
```

### Conditional Data Fetching

- Transaction-based accounts: Fetch transactions only
- GL-based accounts: Fetch journal entry lines only
- This is enforced in the query `enabled` conditions

### Display Logic

The account register dynamically changes:
- **Header**: "Transaction Register" vs "General Ledger Activity"
- **Description**: Explains what's being shown
- **Column labels**: "Category" vs "Offsetting Account"
- **Drill-down links**: Only shown for transactions (to view journal entry)

## Benefits

1. **No duplication**: Each transaction appears once in the system
2. **Professional interface**: Matches industry-standard accounting software
3. **Clear separation**: Users see checkbook registers for banks, GL for categories
4. **Audit trail**: Can drill down from transactions to see accounting impact
5. **Correct balances**: No more doubled amounts or confusion

## User Experience

### Viewing a Bank Account
User sees: "Transaction Register - Showing source transactions (checkbook-style register)"
- Date | Reference | Description | Category | Debit | Credit | Balance | [View Entry]

### Viewing an Expense Category
User sees: "General Ledger Activity - Showing journal entry lines (accounting activity)"
- Date | Reference | Description | Offsetting Account | Debit | Credit | Balance

## Technical Flow

```
User enters transaction → Transaction table
                       ↓
              Trigger creates → Journal Entry
                       ↓
              Two journal lines:
              1. Debit to expense category
              2. Credit to bank account

Bank Account Register → Shows transaction (source document)
Expense Account Register → Shows journal line (GL activity)
```

## Conclusion

This architecture maintains the integrity of double-entry accounting while providing a user-friendly interface. Users interact with familiar transaction registers for bank accounts, while the system maintains proper accounting behind the scenes through journal entries.
