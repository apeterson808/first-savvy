/*
  # Create Avatars Storage Bucket

  1. Storage
    - Create public `avatars` bucket for storing profile images
    - Set size limit to 5MB per file
    - Allow image file types only (jpg, jpeg, png, gif, webp)
  
  2. Security
    - Policies for authenticated users to upload their own avatars
    - Allow public read access to all avatars
*/

-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to avatars" ON storage.objects;

-- Policy: Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Policy: Allow authenticated users to update avatars
CREATE POLICY "Users can update avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

-- Policy: Allow authenticated users to delete avatars
CREATE POLICY "Users can delete avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');

-- Policy: Allow public read access to all avatars
CREATE POLICY "Public read access to avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');