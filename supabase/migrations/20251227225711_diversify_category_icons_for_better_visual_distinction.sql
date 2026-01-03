/*
  # Diversify Category Icons for Better Visual Distinction

  1. Changes
    - Update duplicate icons to unique, contextually appropriate alternatives
    - Maintain visual clarity and intuitive icon-to-category mappings
    
  2. Updated Icons
    - Vehicle Maintenance: Wrench → Settings (gear maintenance)
    - Childcare: Heart → Users (group of people)
    - Giving: Heart → HandHeart (giving gesture)
    - Taxes: Building → Calculator (tax calculations)
    - Shopping: MoreHorizontal → ShoppingBag (shopping context)
    - Rental Income: Home → KeyRound (rental/property keys)
    - Insurance: ShoppingBag → Shield (protection)
*/

UPDATE chart_of_accounts_templates
SET icon = 'Settings'
WHERE account_number = 5320;

UPDATE chart_of_accounts_templates
SET icon = 'Users'
WHERE account_number = 5610;

UPDATE chart_of_accounts_templates
SET icon = 'HandHeart'
WHERE account_number = 6400;

UPDATE chart_of_accounts_templates
SET icon = 'Calculator'
WHERE account_number = 6500;

UPDATE chart_of_accounts_templates
SET icon = 'ShoppingBag'
WHERE account_number = 5900;

UPDATE chart_of_accounts_templates
SET icon = 'KeyRound'
WHERE account_number = 4130;

UPDATE chart_of_accounts_templates
SET icon = 'Shield'
WHERE account_number = 5400;