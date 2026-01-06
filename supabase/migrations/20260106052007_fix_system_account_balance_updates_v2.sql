/*
  # Allow System Account Balance Updates V2

  1. Purpose
    - Allow balance updates to system accounts (3000, 3200) when triggered by journal entries
    - Still protect key identifying fields from modification
    - Enable proper accounting for opening balances

  2. Changes
    - Modify prevent_system_account_updates to allow current_balance and updated_at changes
    - Block updates to identifying fields (account_number, template_account_number, class, etc.)
    - Maintain protection for service_role bypass

  3. Security
    - System accounts can have balances updated through journal entries
    - Identifying fields remain protected from modification
    - Service role retains full access for reset functionality
*/

CREATE OR REPLACE FUNCTION prevent_system_account_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service role full access to system accounts (for reset functionality)
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Block updates to system accounts
  IF OLD.template_account_number IN (3000, 3200) THEN
    -- Check if only balance/updated_at are changing (triggered by journal entries)
    IF NEW.account_number = OLD.account_number AND
       NEW.template_account_number = OLD.template_account_number AND
       NEW.class = OLD.class AND
       NEW.account_type = OLD.account_type AND
       NEW.account_detail = OLD.account_detail AND
       NEW.display_name = OLD.display_name AND
       COALESCE(NEW.institution_name, '') = COALESCE(OLD.institution_name, '') AND
       COALESCE(NEW.account_number_last4, '') = COALESCE(OLD.account_number_last4, '') THEN
      -- Allow balance and timestamp updates
      RETURN NEW;
    END IF;
    
    -- Block all other modifications
    RAISE EXCEPTION 'System accounts (3000, 3200) cannot be modified';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
