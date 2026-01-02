/*
  # Create Statement Files Storage Bucket

  1. Storage
    - Create `statement-files` bucket for uploaded bank statements
    - Allow authenticated users to upload their own files
    - Allow authenticated users to read their own files
    - Restrict access so users can only access their own files

  2. Security
    - Enable RLS-style policies on storage bucket
    - Users can only upload files to their own user_id folder
    - Users can only read files from their own user_id folder
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'statement-files',
  'statement-files',
  false,
  10485760,
  ARRAY['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/pdf', 'application/x-ofx', 'application/vnd.intu.qfx']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own statement files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'statement-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own statement files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'statement-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own statement files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'statement-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );