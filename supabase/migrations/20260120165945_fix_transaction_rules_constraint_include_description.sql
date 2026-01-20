/*
  # Fix Transaction Rules Action Constraint
  
  1. Issue
    - Current constraint doesn't recognize `action_set_description` as valid action
    - Users can't create rules that only set descriptions
    
  2. Changes
    - Drop old constraint that checks for: category, contact, note, or tags
    - Add new constraint that also includes `action_set_description`
    
  3. Security
    - No security changes, just fixing validation logic
*/

-- Drop the old constraint
ALTER TABLE public.transaction_rules 
DROP CONSTRAINT IF EXISTS transaction_rules_check2;

-- Add new constraint that includes action_set_description
ALTER TABLE public.transaction_rules 
ADD CONSTRAINT transaction_rules_actions_check CHECK (
  action_set_category_id IS NOT NULL OR 
  action_set_contact_id IS NOT NULL OR 
  action_add_note IS NOT NULL OR 
  action_add_tags IS NOT NULL OR
  action_set_description IS NOT NULL
);

-- Add helpful comment
COMMENT ON CONSTRAINT transaction_rules_actions_check ON public.transaction_rules IS 
  'Ensures at least one action is specified: category, contact, note, tags, or description';
