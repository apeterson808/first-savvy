/*
  # Add AI Suggestion Columns

  1. Changes
    - Add `ai_suggested_category_id` column to `transactions` table
      - References categories table
      - Allows null values
      - Stores AI-recommended category for user review
    
    - Add `ai_suggested_contact_id` column to `transactions` table  
      - References contacts table
      - Allows null values
      - Stores AI-recommended contact for user review

  2. Purpose
    These columns store AI-generated suggestions separately from user selections,
    allowing the UI to highlight recommended values while preserving user choices.
*/

-- Add AI suggestion columns to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'ai_suggested_category_id'
  ) THEN
    ALTER TABLE transactions 
    ADD COLUMN ai_suggested_category_id uuid REFERENCES categories(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'ai_suggested_contact_id'
  ) THEN
    ALTER TABLE transactions 
    ADD COLUMN ai_suggested_contact_id uuid REFERENCES contacts(id);
  END IF;
END $$;