/*
  # Delete Jenna's account and all associated data

  Completely removes the account for jennaelysee@gmail.com:
  - user_chart_of_accounts (including system-protected entries via trigger bypass)
  - profile_memberships
  - profiles
  - user_settings
*/

ALTER TABLE user_chart_of_accounts DISABLE TRIGGER block_system_account_deletes;

DELETE FROM user_chart_of_accounts WHERE profile_id = '25acd5ad-f9bf-4e67-a011-bd2dc542a8e6';

ALTER TABLE user_chart_of_accounts ENABLE TRIGGER block_system_account_deletes;

DELETE FROM profile_memberships WHERE user_id = '8ea9f560-27b2-4ade-87c4-cfc6946c4def';
DELETE FROM profiles WHERE id = '25acd5ad-f9bf-4e67-a011-bd2dc542a8e6';
DELETE FROM user_settings WHERE id = '8ea9f560-27b2-4ade-87c4-cfc6946c4def';
