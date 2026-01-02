/*
  # Update Statement Files Bucket MIME Types

  1. Changes
    - Add 'application/octet-stream' to allowed MIME types
    - This allows OFX/QFX files that browsers detect as generic binary files
    - Keeps security intact since file type validation happens in application code

  2. Security
    - No changes to RLS policies
    - Application code still validates file extensions before processing
*/

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/pdf',
  'application/x-ofx',
  'application/vnd.intu.qfx',
  'application/octet-stream'
]
WHERE id = 'statement-files';