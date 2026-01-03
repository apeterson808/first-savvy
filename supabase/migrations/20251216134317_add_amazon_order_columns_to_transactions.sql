/*
  # Add Amazon Order Data Columns to Transactions
  
  ## Overview
  This migration adds columns to the transactions table to store Amazon order details.
  These columns enable enriching existing Plaid transactions with Amazon order information
  through a matching and enrichment process.
  
  ## New Columns Added to `transactions` table
  
  ### Amazon Order Information
  - `amazon_order_id` (text) - Unique Amazon order identifier (e.g., "111-7777777-1111111")
  - `amazon_order_date` (date) - Date when the Amazon order was placed
  - `amazon_shipment_date` (date) - Date when the order was shipped
  - `amazon_tracking_number` (text) - Shipment tracking number
  - `amazon_product_name` (text) - Name of the product purchased
  - `amazon_product_quantity` (integer) - Number of units ordered
  - `amazon_product_url` (text) - Link to the product on Amazon
  - `amazon_seller` (text) - Seller name (Amazon or third-party)
  - `is_amazon_order` (boolean) - Quick flag to identify Amazon-enriched transactions
  - `match_confidence` (integer) - Matching confidence score (0-100) for the Amazon order match
  
  ## Notes
  - All columns are optional (nullable) as not all transactions are Amazon orders
  - The `is_amazon_order` column provides fast filtering for Amazon transactions
  - The `match_confidence` field helps users understand the quality of automatic matching
  - Multiple transactions may reference the same `amazon_order_id` if an order contains multiple items
  - When matching Amazon orders to existing transactions, these fields enrich the transaction data
*/

-- Add Amazon order columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amazon_order_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amazon_order_date date;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amazon_shipment_date date;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amazon_tracking_number text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amazon_product_name text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amazon_product_quantity integer DEFAULT 1;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amazon_product_url text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amazon_seller text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_amazon_order boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS match_confidence integer;

-- Create an index on amazon_order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_amazon_order_id ON transactions(amazon_order_id) WHERE amazon_order_id IS NOT NULL;

-- Create an index on is_amazon_order for faster filtering
CREATE INDEX IF NOT EXISTS idx_transactions_is_amazon_order ON transactions(is_amazon_order) WHERE is_amazon_order = true;
