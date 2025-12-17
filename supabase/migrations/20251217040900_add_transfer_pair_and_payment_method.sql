/*
  # Add Transfer Pair ID and Payment Method to Transactions

  ## Overview
  Adds two essential columns to the transactions table to support transaction matching
  and payment method tracking.

  ## New Columns Added to `transactions` table
  
  ### Transfer Matching
  - `transfer_pair_id` (uuid) - Links two transactions that represent opposite sides of 
    the same transfer (e.g., withdrawal from checking and deposit to savings). When two 
    transactions share the same transfer_pair_id, they represent a matched transfer.
  
  ### Payment Tracking
  - `payment_method` (text) - Records how the transaction was made. Common values include:
    - 'debit_card' - Debit card purchase
    - 'credit_card' - Credit card purchase
    - 'bank_transfer' - ACH/wire transfer
    - 'check' - Paper check
    - 'cash' - Cash transaction
    - 'direct_deposit' - Direct deposit (for income)
    - 'atm' - ATM withdrawal
    - 'other' - Other payment methods

  ## Benefits
  - Enables automatic and manual matching of transfer transactions
  - Provides better transaction categorization and filtering by payment method
  - Supports transfer reconciliation features in the UI
  - Helps identify duplicate transactions across accounts

  ## Important Notes
  - Both columns are nullable (not all transactions are transfers)
  - transfer_pair_id is indexed for fast matching queries
  - Existing transactions will have NULL values until populated
*/

-- Add transfer_pair_id column for matching transfers
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transfer_pair_id uuid;

-- Add payment_method column for tracking how transaction was made
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_method text;

-- Create index on transfer_pair_id for faster matching queries
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_pair_id 
ON transactions(transfer_pair_id) 
WHERE transfer_pair_id IS NOT NULL;

-- Create index on payment_method for filtering
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method 
ON transactions(payment_method) 
WHERE payment_method IS NOT NULL;
