/*
  # Delete Jenna's second account (jennaelysee@gmail.com)

  Cleans up the account created during the broken onboarding test so she can
  sign up again with the fixed household-connection flow.

  User ID:    4c6b8371-86a5-4af2-8a99-209b6efb6e59
  Profile ID: 410b2279-f770-4ede-8790-6fdc944eecc5
*/

ALTER TABLE user_chart_of_accounts DISABLE TRIGGER block_system_account_deletes;
DELETE FROM user_chart_of_accounts WHERE profile_id = '410b2279-f770-4ede-8790-6fdc944eecc5';
ALTER TABLE user_chart_of_accounts ENABLE TRIGGER block_system_account_deletes;

DELETE FROM profile_memberships WHERE user_id = '4c6b8371-86a5-4af2-8a99-209b6efb6e59';
DELETE FROM profiles WHERE id = '410b2279-f770-4ede-8790-6fdc944eecc5';
DELETE FROM user_settings WHERE id = '4c6b8371-86a5-4af2-8a99-209b6efb6e59';
