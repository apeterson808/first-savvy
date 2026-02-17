/*
  # Create AI Contact Suggestions Table

  1. New Tables
    - `ai_contact_suggestions`
      - `id` (uuid, primary key) - Unique identifier for each suggestion
      - `transaction_id` (uuid, foreign key) - References the transaction this suggestion is for
      - `suggested_contact_id` (uuid, foreign key) - References the suggested contact
      - `confidence_score` (numeric) - AI confidence score (0-1) for display/sorting
      - `created_at` (timestamptz) - When the suggestion was created
      - `profile_id` (uuid, foreign key) - References the user profile for RLS
  
  2. Security
    - Enable RLS on `ai_contact_suggestions` table
    - Add policy for authenticated users to read their own suggestions
    - Add policy for authenticated users to insert their own suggestions
    - Add policy for authenticated users to delete their own suggestions
    - Add policy for authenticated users to update their own suggestions
  
  3. Indexes
    - Index on transaction_id for fast lookups
    - Index on profile_id for RLS performance
*/

-- Create ai_contact_suggestions table
CREATE TABLE IF NOT EXISTS ai_contact_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  suggested_contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  confidence_score numeric DEFAULT 0.8,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(transaction_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_contact_suggestions_transaction_id ON ai_contact_suggestions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ai_contact_suggestions_profile_id ON ai_contact_suggestions(profile_id);

-- Enable RLS
ALTER TABLE ai_contact_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own suggestions
CREATE POLICY "Users can read own AI contact suggestions"
  ON ai_contact_suggestions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

-- Policy: Users can insert their own suggestions
CREATE POLICY "Users can insert own AI contact suggestions"
  ON ai_contact_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

-- Policy: Users can delete their own suggestions
CREATE POLICY "Users can delete own AI contact suggestions"
  ON ai_contact_suggestions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- Policy: Users can update their own suggestions
CREATE POLICY "Users can update own AI contact suggestions"
  ON ai_contact_suggestions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);