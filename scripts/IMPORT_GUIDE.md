# Statement Import Guide

This guide explains how to import bank statements one month at a time using the new streamlined import process.

## Overview

The import script extracts transactions from PDF statements and automatically imports them into your database. It supports:
- Citi credit card statements
- American Express credit card statements
- Idaho Central Credit Union (ICCU) checking/savings statements

## Prerequisites

Before importing statements, you need to set up your accounts in the database with the last 4 digits of each account number.

### Step 1: Identify Your Accounts

First, see which accounts you have:

```sql
SELECT id, display_name, account_number, account_number_last4
FROM user_chart_of_accounts
WHERE account_type IN ('bank_accounts', 'credit_cards');
```

### Step 2: Set Last 4 Digits for Each Account

For each account you want to import statements for, set the `account_number_last4` field:

```sql
-- Example: Citi Costco card ending in 1234
UPDATE user_chart_of_accounts
SET account_number_last4 = '1234',
    institution_name = 'Citi',
    official_name = 'Costco Anywhere Visa'
WHERE display_name = 'Credit Card'
  AND account_number = 2100;

-- Example: Amex card ending in 65432
UPDATE user_chart_of_accounts
SET account_number_last4 = '5432',
    institution_name = 'American Express',
    official_name = 'Delta SkyMiles Card'
WHERE display_name = 'Credit Card'
  AND account_number = 2120;

-- Example: ICCU checking ending in 9876
UPDATE user_chart_of_accounts
SET account_number_last4 = '9876',
    institution_name = 'Idaho Central Credit Union',
    official_name = 'Central Checking'
WHERE display_name = 'Checking Account'
  AND account_number = 1100;
```

## Import Process

### 1. Place Your PDF Statement

Put your PDF statement in the `data/statements/` folder:

```bash
# Example file names:
# data/statements/citi_dec_2024.pdf
# data/statements/amex_nov_2024.pdf
# data/statements/iccu_oct_2024.pdf
```

### 2. Run the Import Script

```bash
node scripts/import-statement.js data/statements/your_statement.pdf
```

The script will:
1. Extract text from the PDF
2. Detect which bank it's from
3. Parse all transactions
4. Show you a preview
5. Match to the correct account using the last 4 digits
6. Import all transactions to the database

### 3. Review the Output

The script will show you:
- Institution name
- Account number (last 4 digits)
- Number of transactions found
- Beginning/ending balances
- Sample transactions
- Import confirmation

### 4. Repeat for Each Statement

Import one statement at a time:
1. Import December for Account A
2. Import December for Account B
3. Import December for Account C
4. Then move to November, etc.

## Example Workflow

```bash
# December statements
node scripts/import-statement.js data/statements/citi_dec_2024.pdf
node scripts/import-statement.js data/statements/amex_dec_2024.pdf
node scripts/import-statement.js data/statements/iccu_dec_2024.pdf

# November statements
node scripts/import-statement.js data/statements/citi_nov_2024.pdf
node scripts/import-statement.js data/statements/amex_nov_2024.pdf
node scripts/import-statement.js data/statements/iccu_nov_2024.pdf
```

## Troubleshooting

### "No account found matching last 4 digits"

This means you haven't set up the `account_number_last4` field for that account yet. Follow Step 2 in Prerequisites.

### "Could not detect bank institution from PDF"

The script doesn't recognize this bank's statement format. Currently supported:
- Citi (Costco Anywhere Visa)
- American Express (Delta SkyMiles)
- Idaho Central Credit Union

### "Failed to extract transactions"

The PDF format may have changed or be corrupted. Try:
1. Re-downloading the PDF
2. Making sure it's a real statement (not a summary)
3. Checking if it's a supported bank

## Clean Slate

All previous transaction data has been cleared from the database. You're starting fresh with a clean import process.
