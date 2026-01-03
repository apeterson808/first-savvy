/*
  # Fix Remaining Duplicate Icon

  1. Changes
    - Change Side Income icon from Briefcase to HandCoins (distinguishes from Salary)
    - Briefcase remains for Salary (primary employment)
    - HandCoins represents additional/side earnings
*/

UPDATE chart_of_accounts_templates 
SET icon = 'HandCoins' 
WHERE account_number = 4030;