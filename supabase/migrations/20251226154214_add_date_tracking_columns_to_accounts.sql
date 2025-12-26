/*
  # Add Date Tracking Columns to Accounts Table

  1. Changes
    - Add `start_date` column to track when account tracking began
    - Add `go_live_date` column to track when account goes live in the system
    
  2. Notes
    - Both columns are optional (nullable)
    - Uses date type for day-level precision
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE accounts ADD COLUMN start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'go_live_date'
  ) THEN
    ALTER TABLE accounts ADD COLUMN go_live_date date;
  END IF;
END $$;