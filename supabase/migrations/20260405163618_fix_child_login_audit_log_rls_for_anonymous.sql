/*
  # Fix Child Login Audit Log RLS for Anonymous Users

  ## Overview
  This migration fixes the RLS policies on child_login_audit_log to allow
  anonymous (unauthenticated) users to insert audit log entries during the
  login process.

  ## Changes
  1. Drop the existing INSERT policy that requires authenticated users
  2. Create a new INSERT policy that allows both authenticated and anonymous users
     to insert audit log records

  ## Security
  - Still secure because audit logs are append-only
  - Only INSERT is allowed, no UPDATE or DELETE
  - Anonymous users still cannot SELECT audit logs
*/

-- Drop the old policy
DROP POLICY IF EXISTS "System can insert login audit records" ON child_login_audit_log;

-- Create new policy that allows anonymous users to insert audit logs
CREATE POLICY "Allow login audit log entries"
  ON child_login_audit_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
