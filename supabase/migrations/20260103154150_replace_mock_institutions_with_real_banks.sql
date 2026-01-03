/*
  # Replace Mock Financial Institutions with Real Banks

  1. Changes
    - Delete all mock/sample financial institution data (20 banks)
    - Insert only 3 real institutions: Citi, Idaho Central Credit Union, American Express
    - Add accurate institution details (routing numbers, types, colors)
    - Remove clearbit logo URL references completely

  2. New Data
    - Citibank - Credit cards (bank type)
    - Idaho Central Credit Union (ICCU) - Checking accounts (credit_union type)
    - American Express - Credit cards (bank type)

  3. Notes
    - Uses real institution identifiers for accurate simulation
    - Colors chosen for brand recognition
    - Institution types reflect actual account offerings
    - Logo URLs removed (no external dependencies)
*/

-- Delete all existing financial institutions
DELETE FROM financial_institutions;

-- Insert the 3 real financial institutions
INSERT INTO financial_institutions (name, full_name, logo_url, primary_color, institution_type, routing_number, website, sort_order, is_active)
VALUES 
  (
    'Citibank',
    'Citibank, N.A.',
    NULL,
    '#056DAE',
    'bank',
    '021000089',
    'https://citi.com',
    1,
    true
  ),
  (
    'Idaho Central Credit Union',
    'Idaho Central Credit Union',
    NULL,
    '#003DA5',
    'credit_union',
    '325181028',
    'https://iccu.com',
    2,
    true
  ),
  (
    'American Express',
    'American Express Company',
    NULL,
    '#006FCF',
    'bank',
    NULL,
    'https://americanexpress.com',
    3,
    true
  )
ON CONFLICT DO NOTHING;
