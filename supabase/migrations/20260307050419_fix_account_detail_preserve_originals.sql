/*
  # Fix Account Detail - Preserve Original Values

  1. Overview
    - Restores original account_detail values while keeping the simplified account_type
    - Only changes account_type (the category grouping), preserves account_detail (the specific subcategory)
    
  2. Strategy
    - Use account_number ranges to determine original account_detail values
    - Preserve granular detail while simplifying the type hierarchy
    
  3. Account Number Mapping
    - 6000-6040: housing detail
    - 6100-6120: utilities detail  
    - 6200-6220: food_dining detail
    - 6300-6340: transportation detail
    - 6400: insurance detail
    - 6500-6520: healthcare detail
    - 6600-6620: kids_family detail
    - 6700-6720: education detail
    - 6800: subscriptions detail
    - 6900: shopping detail
    - 7000: travel detail
    - 7100-7120: lifestyle detail
    - 7150: personal_care detail
    - 7200: professional_services detail
    - 7300: pets detail
    - 7400-7420: financial detail
    - 7500-7520: giving detail
    - 9000: taxes detail
*/

-- Restore housing details
UPDATE chart_of_accounts_templates
SET account_detail = 'housing'
WHERE account_number BETWEEN 6000 AND 6040;

UPDATE user_chart_of_accounts
SET account_detail = 'housing'
WHERE account_number BETWEEN 6000 AND 6040;

-- Restore utilities details
UPDATE chart_of_accounts_templates
SET account_detail = 'utilities'
WHERE account_number BETWEEN 6100 AND 6120;

UPDATE user_chart_of_accounts
SET account_detail = 'utilities'
WHERE account_number BETWEEN 6100 AND 6120;

-- Restore food_dining details
UPDATE chart_of_accounts_templates
SET account_detail = 'food_dining'
WHERE account_number BETWEEN 6200 AND 6220;

UPDATE user_chart_of_accounts
SET account_detail = 'food_dining'
WHERE account_number BETWEEN 6200 AND 6220;

-- Restore transportation details
UPDATE chart_of_accounts_templates
SET account_detail = 'transportation'
WHERE account_number BETWEEN 6300 AND 6340;

UPDATE user_chart_of_accounts
SET account_detail = 'transportation'
WHERE account_number BETWEEN 6300 AND 6340;

-- Restore insurance details
UPDATE chart_of_accounts_templates
SET account_detail = 'insurance'
WHERE account_number = 6400;

UPDATE user_chart_of_accounts
SET account_detail = 'insurance'
WHERE account_number = 6400;

-- Restore healthcare details
UPDATE chart_of_accounts_templates
SET account_detail = 'healthcare'
WHERE account_number BETWEEN 6500 AND 6520;

UPDATE user_chart_of_accounts
SET account_detail = 'healthcare'
WHERE account_number BETWEEN 6500 AND 6520;

-- Restore kids_family details
UPDATE chart_of_accounts_templates
SET account_detail = 'kids_family'
WHERE account_number BETWEEN 6600 AND 6620;

UPDATE user_chart_of_accounts
SET account_detail = 'kids_family'
WHERE account_number BETWEEN 6600 AND 6620;

-- Restore education details
UPDATE chart_of_accounts_templates
SET account_detail = 'education'
WHERE account_number BETWEEN 6700 AND 6720;

UPDATE user_chart_of_accounts
SET account_detail = 'education'
WHERE account_number BETWEEN 6700 AND 6720;

-- Restore subscriptions details
UPDATE chart_of_accounts_templates
SET account_detail = 'subscriptions'
WHERE account_number = 6800;

UPDATE user_chart_of_accounts
SET account_detail = 'subscriptions'
WHERE account_number = 6800;

-- Restore shopping details
UPDATE chart_of_accounts_templates
SET account_detail = 'shopping'
WHERE account_number = 6900;

UPDATE user_chart_of_accounts
SET account_detail = 'shopping'
WHERE account_number = 6900;

-- Restore travel details
UPDATE chart_of_accounts_templates
SET account_detail = 'travel'
WHERE account_number = 7000;

UPDATE user_chart_of_accounts
SET account_detail = 'travel'
WHERE account_number = 7000;

-- Restore lifestyle details
UPDATE chart_of_accounts_templates
SET account_detail = 'lifestyle'
WHERE account_number BETWEEN 7100 AND 7120;

UPDATE user_chart_of_accounts
SET account_detail = 'lifestyle'
WHERE account_number BETWEEN 7100 AND 7120;

-- Restore personal_care details
UPDATE chart_of_accounts_templates
SET account_detail = 'personal_care'
WHERE account_number = 7150;

UPDATE user_chart_of_accounts
SET account_detail = 'personal_care'
WHERE account_number = 7150;

-- Restore professional_services details
UPDATE chart_of_accounts_templates
SET account_detail = 'professional_services'
WHERE account_number = 7200;

UPDATE user_chart_of_accounts
SET account_detail = 'professional_services'
WHERE account_number = 7200;

-- Restore pets details
UPDATE chart_of_accounts_templates
SET account_detail = 'pets'
WHERE account_number = 7300;

UPDATE user_chart_of_accounts
SET account_detail = 'pets'
WHERE account_number = 7300;

-- Restore financial details
UPDATE chart_of_accounts_templates
SET account_detail = 'financial'
WHERE account_number BETWEEN 7400 AND 7420;

UPDATE user_chart_of_accounts
SET account_detail = 'financial'
WHERE account_number BETWEEN 7400 AND 7420;

-- Restore giving details
UPDATE chart_of_accounts_templates
SET account_detail = 'giving'
WHERE account_number BETWEEN 7500 AND 7520;

UPDATE user_chart_of_accounts
SET account_detail = 'giving'
WHERE account_number BETWEEN 7500 AND 7520;

-- Restore taxes details
UPDATE chart_of_accounts_templates
SET account_detail = 'taxes'
WHERE account_number = 9000;

UPDATE user_chart_of_accounts
SET account_detail = 'taxes'
WHERE account_number = 9000;
