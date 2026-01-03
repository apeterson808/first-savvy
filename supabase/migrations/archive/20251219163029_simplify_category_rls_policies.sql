/*
  # Simplify Category RLS Policies

  1. Changes
    - Remove all policies that reference `is_system` checks
    - Replace with simple user ownership checks
    - Each user now owns their own complete set of categories
    - No more shared system categories

  2. New Policies
    - SELECT: Users can only view their own categories
    - INSERT: Users can only insert categories with their own user_id
    - UPDATE: Users can only update their own categories
    - DELETE: Users can only delete their own categories

  3. Security
    - All policies are restrictive and check `auth.uid() = user_id`
    - No anonymous access (categories are provisioned automatically)
    - No shared categories between users

  4. Performance
    - Simplified policies improve query performance
    - Direct user_id comparison is faster than complex OR conditions
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;

-- Create new simplified policies
CREATE POLICY "Users can view own categories"
  ON categories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON categories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON categories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add index on user_id for improved RLS performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Comment for documentation
COMMENT ON TABLE categories IS 'User-specific categories. Each user gets their own complete set copied from category_templates on signup.';
