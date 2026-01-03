/*
  # Remove Duplicate Indexes

  1. Changes
    - Drop idx_invitations_token (duplicate of invitations_token_key unique constraint)
  
  2. Purpose
    - Reduce database maintenance overhead
    - Both indexes serve the same purpose, keeping only the unique constraint
*/

DROP INDEX IF EXISTS idx_invitations_token;