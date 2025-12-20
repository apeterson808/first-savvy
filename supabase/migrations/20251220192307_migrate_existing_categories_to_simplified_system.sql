/*
  # Migrate Existing User Categories to Simplified System

  1. Process
    - For each user, insert new simplified categories based on templates
    - Map transactions from old categories to new categories
    - Delete old categories that are no longer needed

  2. Category Mappings (Old -> New)
    Income:
    - Freelance Income -> Other Income
    - Investment Income -> Other Income
    - Salary -> Salary (keep)
    - Transfer Income -> Transfer (income)
    
    Expense:
    - Dining -> Dining Out
    - Dining Out -> Dining Out (keep)
    - Entertainment -> Miscellaneous
    - Gas -> Transportation
    - Gas & Fuel -> Transportation
    - Groceries -> Groceries (keep)
    - Healthcare -> Health & Wellness
    - Insurance -> Insurance (keep)
    - Other Expense -> Miscellaneous
    - Rent -> Housing
    - Rent/Mortgage -> Housing
    - Subscriptions -> Subscriptions (keep)
    - Transfer Expense -> Transfer (expense)
    - Transportation -> Transportation (keep)
    - Utilities -> Utilities (keep)

  3. Notes
    - Uses a temporary mapping table to track old->new category IDs
    - Updates all transaction references
    - Preserves transaction history with new categorization
*/

-- Create a temporary table to store category mappings
CREATE TEMP TABLE category_mapping (
  old_id uuid,
  new_id uuid,
  old_name text,
  new_name text
);

-- For each existing user, provision new categories and create mappings
DO $$
DECLARE
  user_record RECORD;
  new_category_id uuid;
  old_category_id uuid;
BEGIN
  -- Loop through each user who has categories
  FOR user_record IN 
    SELECT DISTINCT user_id FROM categories WHERE user_id IS NOT NULL
  LOOP
    RAISE NOTICE 'Migrating categories for user %', user_record.user_id;
    
    -- Insert new categories from templates for this user
    INSERT INTO categories (name, type, detail_type, icon, color, user_id, is_system)
    SELECT 
      ct.name,
      ct.type,
      ct.detail_type,
      ct.icon,
      ct.color,
      user_record.user_id,
      false
    FROM category_templates ct
    WHERE NOT EXISTS (
      SELECT 1 FROM categories c 
      WHERE c.user_id = user_record.user_id 
      AND c.name = ct.name 
      AND c.type = ct.type
      AND COALESCE(c.detail_type, '') = COALESCE(ct.detail_type, '')
    )
    ORDER BY ct.display_order;
    
    -- Create mappings for this user's old categories to new ones
    
    -- Income mappings
    -- Freelance Income -> Other Income
    INSERT INTO category_mapping (old_id, new_id, old_name, new_name)
    SELECT 
      old_cat.id,
      new_cat.id,
      old_cat.name,
      new_cat.name
    FROM categories old_cat
    CROSS JOIN categories new_cat
    WHERE old_cat.user_id = user_record.user_id
    AND old_cat.name IN ('Freelance Income', 'Investment Income')
    AND old_cat.type = 'income'
    AND new_cat.user_id = user_record.user_id
    AND new_cat.name = 'Other Income'
    AND new_cat.type = 'income';
    
    -- Salary -> Salary (already exists, map to itself if different)
    INSERT INTO category_mapping (old_id, new_id, old_name, new_name)
    SELECT 
      old_cat.id,
      new_cat.id,
      old_cat.name,
      new_cat.name
    FROM categories old_cat
    CROSS JOIN categories new_cat
    WHERE old_cat.user_id = user_record.user_id
    AND old_cat.name = 'Salary'
    AND old_cat.type = 'income'
    AND new_cat.user_id = user_record.user_id
    AND new_cat.name = 'Salary'
    AND new_cat.type = 'income'
    AND old_cat.id != new_cat.id;
    
    -- Transfer Income -> Transfer (income)
    INSERT INTO category_mapping (old_id, new_id, old_name, new_name)
    SELECT 
      old_cat.id,
      new_cat.id,
      old_cat.name,
      new_cat.name
    FROM categories old_cat
    CROSS JOIN categories new_cat
    WHERE old_cat.user_id = user_record.user_id
    AND old_cat.name = 'Transfer Income'
    AND old_cat.type = 'income'
    AND new_cat.user_id = user_record.user_id
    AND new_cat.name = 'Transfer'
    AND new_cat.type = 'income';
    
    -- Expense mappings
    -- Dining -> Dining Out
    INSERT INTO category_mapping (old_id, new_id, old_name, new_name)
    SELECT 
      old_cat.id,
      new_cat.id,
      old_cat.name,
      new_cat.name
    FROM categories old_cat
    CROSS JOIN categories new_cat
    WHERE old_cat.user_id = user_record.user_id
    AND old_cat.name = 'Dining'
    AND old_cat.type = 'expense'
    AND new_cat.user_id = user_record.user_id
    AND new_cat.name = 'Dining Out'
    AND new_cat.type = 'expense';
    
    -- Entertainment, Other Expense -> Miscellaneous
    INSERT INTO category_mapping (old_id, new_id, old_name, new_name)
    SELECT 
      old_cat.id,
      new_cat.id,
      old_cat.name,
      new_cat.name
    FROM categories old_cat
    CROSS JOIN categories new_cat
    WHERE old_cat.user_id = user_record.user_id
    AND old_cat.name IN ('Entertainment', 'Other Expense')
    AND old_cat.type = 'expense'
    AND new_cat.user_id = user_record.user_id
    AND new_cat.name = 'Miscellaneous'
    AND new_cat.type = 'expense';
    
    -- Gas, Gas & Fuel -> Transportation
    INSERT INTO category_mapping (old_id, new_id, old_name, new_name)
    SELECT 
      old_cat.id,
      new_cat.id,
      old_cat.name,
      new_cat.name
    FROM categories old_cat
    CROSS JOIN categories new_cat
    WHERE old_cat.user_id = user_record.user_id
    AND old_cat.name IN ('Gas', 'Gas & Fuel')
    AND old_cat.type = 'expense'
    AND new_cat.user_id = user_record.user_id
    AND new_cat.name = 'Transportation'
    AND new_cat.type = 'expense';
    
    -- Healthcare -> Health & Wellness
    INSERT INTO category_mapping (old_id, new_id, old_name, new_name)
    SELECT 
      old_cat.id,
      new_cat.id,
      old_cat.name,
      new_cat.name
    FROM categories old_cat
    CROSS JOIN categories new_cat
    WHERE old_cat.user_id = user_record.user_id
    AND old_cat.name = 'Healthcare'
    AND old_cat.type = 'expense'
    AND new_cat.user_id = user_record.user_id
    AND new_cat.name = 'Health & Wellness'
    AND new_cat.type = 'expense';
    
    -- Rent, Rent/Mortgage -> Housing
    INSERT INTO category_mapping (old_id, new_id, old_name, new_name)
    SELECT 
      old_cat.id,
      new_cat.id,
      old_cat.name,
      new_cat.name
    FROM categories old_cat
    CROSS JOIN categories new_cat
    WHERE old_cat.user_id = user_record.user_id
    AND old_cat.name IN ('Rent', 'Rent/Mortgage')
    AND old_cat.type = 'expense'
    AND new_cat.user_id = user_record.user_id
    AND new_cat.name = 'Housing'
    AND new_cat.type = 'expense';
    
    -- Transfer Expense -> Transfer (expense)
    INSERT INTO category_mapping (old_id, new_id, old_name, new_name)
    SELECT 
      old_cat.id,
      new_cat.id,
      old_cat.name,
      new_cat.name
    FROM categories old_cat
    CROSS JOIN categories new_cat
    WHERE old_cat.user_id = user_record.user_id
    AND old_cat.name = 'Transfer Expense'
    AND old_cat.type = 'expense'
    AND new_cat.user_id = user_record.user_id
    AND new_cat.name = 'Transfer'
    AND new_cat.type = 'expense';
    
  END LOOP;
  
  -- Update transactions to use new category IDs
  UPDATE transactions t
  SET category_id = cm.new_id
  FROM category_mapping cm
  WHERE t.category_id = cm.old_id;
  
  -- Update AI suggested categories
  UPDATE transactions t
  SET ai_suggested_category_id = cm.new_id
  FROM category_mapping cm
  WHERE t.ai_suggested_category_id = cm.old_id;
  
  -- Update budgets to use new category IDs
  UPDATE budgets b
  SET category_id = cm.new_id
  FROM category_mapping cm
  WHERE b.category_id = cm.old_id;
  
  RAISE NOTICE 'Updated % transactions', (SELECT COUNT(*) FROM category_mapping);
  
  -- Delete old categories that have been replaced
  DELETE FROM categories
  WHERE id IN (SELECT old_id FROM category_mapping);
  
  -- Delete categories that don't match the new system and have no transactions
  DELETE FROM categories c
  WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM category_templates ct 
    WHERE ct.name = c.name 
    AND ct.type = c.type
    AND COALESCE(ct.detail_type, '') = COALESCE(c.detail_type, '')
  )
  AND NOT EXISTS (
    SELECT 1 FROM transactions t 
    WHERE t.category_id = c.id OR t.ai_suggested_category_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.category_id = c.id
  );
  
END $$;

-- Drop the temporary mapping table
DROP TABLE category_mapping;