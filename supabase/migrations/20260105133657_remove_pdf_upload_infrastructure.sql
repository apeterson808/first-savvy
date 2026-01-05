/*
  # Remove PDF Upload Infrastructure

  This migration removes all PDF processing and statement upload infrastructure:

  1. Drops statement_uploads table and all related foreign key constraints
  2. Removes statement_upload_id column from transactions table
  3. Updates transactions source field to remove 'pdf' option (only manual, csv, ofx, api remain)
  
  ## Changes
  
  - Drop statement_uploads table (CASCADE to remove foreign keys)
  - Remove transactions.statement_upload_id column
  - Update transactions source check constraint to exclude 'pdf'
  
  ## Security
  
  No RLS changes needed as tables are being removed entirely.
  
  ## Notes
  
  - statement-files storage bucket does not exist, so no bucket cleanup needed
  - statement_cache was already removed in a previous migration
  - Existing transactions with source='pdf' will keep that value for historical records
*/

-- Drop the statement_uploads table (CASCADE will drop foreign key constraints)
DROP TABLE IF EXISTS statement_uploads CASCADE;

-- Remove the statement_upload_id column from transactions
ALTER TABLE transactions DROP COLUMN IF EXISTS statement_upload_id;

-- Update the source check constraint to remove 'pdf' option
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_source_check 
  CHECK (source = ANY (ARRAY['manual'::text, 'csv'::text, 'ofx'::text, 'api'::text]));