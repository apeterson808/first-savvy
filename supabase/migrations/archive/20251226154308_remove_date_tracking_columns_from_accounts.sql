/*
  # Remove Date Tracking Columns from Accounts Table

  1. Changes
    - Remove `start_date` column from accounts table
    - Remove `go_live_date` column from accounts table
    
  2. Notes
    - Reverting previous migration that added these columns
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE accounts DROP COLUMN start_date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'go_live_date'
  ) THEN
    ALTER TABLE accounts DROP COLUMN go_live_date;
  END IF;
END $$;