/*
  # Fix auto-post rules and add category requirement constraint

  1. Changes
    - Disable auto_confirm_and_post for rules without a category
    - Add CHECK constraint to enforce that auto-post rules must set a category
  
  2. Reasoning
    - Journal entries require a category_account_id to be created
    - When rules auto-post transactions without setting a category, no journal entry is created
    - This migration fixes existing problematic rules and prevents future ones
  
  3. Important Notes
    - Existing rules with auto_confirm_and_post=true but no category will have auto-posting disabled
    - Users will need to set a category and re-enable auto-posting for these rules
*/

-- First, disable auto-posting for rules that don't set a category
UPDATE transaction_rules
SET auto_confirm_and_post = false
WHERE auto_confirm_and_post = true 
  AND action_set_category_id IS NULL;

-- Now add the constraint to prevent this issue in the future
ALTER TABLE transaction_rules 
ADD CONSTRAINT auto_post_requires_category 
CHECK (
  auto_confirm_and_post = false 
  OR action_set_category_id IS NOT NULL
);
