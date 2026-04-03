/*
  # Delete All Child Profiles

  1. Actions
    - Delete all records from child_login_audit_log
    - Delete all records from task_completions
    - Delete all records from tasks
    - Delete all records from rewards
    - Delete all records from profile_shares
    - Delete all records from profile_invitations
    - Delete all records from child_profiles

  2. Notes
    - This will permanently remove all child account data
    - Cascading deletes will handle related records automatically
    - This operation cannot be undone
*/

-- Delete all child login audit logs
DELETE FROM child_login_audit_log;

-- Delete all task completions
DELETE FROM task_completions;

-- Delete all tasks
DELETE FROM tasks;

-- Delete all rewards
DELETE FROM rewards;

-- Delete all profile shares
DELETE FROM profile_shares;

-- Delete all profile invitations
DELETE FROM profile_invitations;

-- Delete all child profiles
DELETE FROM child_profiles;
