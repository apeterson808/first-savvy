/*
  # Fix user_id defaults for budget tables

  1. Changes
    - Add default value to budget_groups.user_id to automatically use auth.uid()
    - Add default value to budgets.user_id to automatically use auth.uid()
  
  2. Security
    - No changes to RLS policies
    - Maintains existing security model where users can only access their own data
*/

-- Add default value for user_id in budget_groups
ALTER TABLE budget_groups 
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Add default value for user_id in budgets
ALTER TABLE budgets 
  ALTER COLUMN user_id SET DEFAULT auth.uid();
