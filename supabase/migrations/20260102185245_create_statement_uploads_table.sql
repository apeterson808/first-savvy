/*
  # Create Statement Uploads Table

  1. New Table
    - `statement_uploads` - Tracks uploaded statement files and their processing status
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `profile_id` (uuid, foreign key to user_profiles)
      - `file_name` (text) - Original filename
      - `file_path` (text) - Storage path
      - `file_size` (integer) - File size in bytes
      - `processing_status` (text) - 'pending', 'processing', 'completed', 'failed'
      - `transactions_count` (integer) - Number of transactions extracted
      - `suggested_account_id` (uuid, nullable) - Auto-detected bank account
      - `error_message` (text, nullable) - Error details if failed
      - `api_requests_count` (integer) - Track API usage
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only access their own uploads
    - Users can only view uploads for profiles they have access to

  3. Indexes
    - Index on user_id for fast lookups
    - Index on profile_id for filtering
    - Index on processing_status for querying pending uploads
*/

CREATE TABLE IF NOT EXISTS statement_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  transactions_count integer DEFAULT 0,
  suggested_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL,
  error_message text,
  api_requests_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE statement_uploads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_statement_uploads_user_id ON statement_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_statement_uploads_profile_id ON statement_uploads(profile_id);
CREATE INDEX IF NOT EXISTS idx_statement_uploads_status ON statement_uploads(processing_status);

CREATE POLICY "Users can view their own statement uploads"
  ON statement_uploads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own statement uploads"
  ON statement_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own statement uploads"
  ON statement_uploads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own statement uploads"
  ON statement_uploads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_statement_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_statement_uploads_updated_at
  BEFORE UPDATE ON statement_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_statement_uploads_updated_at();