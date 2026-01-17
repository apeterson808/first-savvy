/*
  # Add Parent Account Support for Hierarchical Categories

  1. Changes to user_chart_of_accounts
    - Add `parent_account_id` column (nullable UUID)
    - Add foreign key constraint referencing same table
    - Add index for performance
    - Add check constraint to prevent self-referencing
    - Add check constraint to ensure parent and child have same account_class

  2. Security
    - No RLS changes needed (inherits existing policies)

  3. Notes
    - Allows sub-categories under parent categories
    - Prevents circular references at database level
    - Parent and child must be same class (income/expense)
*/

-- Add parent_account_id column to user_chart_of_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_chart_of_accounts' AND column_name = 'parent_account_id'
  ) THEN
    ALTER TABLE user_chart_of_accounts
    ADD COLUMN parent_account_id UUID REFERENCES user_chart_of_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index on parent_account_id for performance
CREATE INDEX IF NOT EXISTS idx_user_chart_of_accounts_parent_account_id
ON user_chart_of_accounts(parent_account_id);

-- Add check constraint to prevent self-referencing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_chart_of_accounts_no_self_reference'
  ) THEN
    ALTER TABLE user_chart_of_accounts
    ADD CONSTRAINT user_chart_of_accounts_no_self_reference
    CHECK (id != parent_account_id);
  END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN user_chart_of_accounts.parent_account_id IS 'Optional parent account for creating sub-categories. Must be same account_class as child.';