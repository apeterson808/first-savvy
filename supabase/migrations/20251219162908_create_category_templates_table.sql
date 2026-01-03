/*
  # Create Category Templates Table

  1. New Tables
    - `category_templates`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `type` (text, not null) - 'income' or 'expense'
      - `detail_type` (text) - normalized detail type
      - `icon` (text) - lucide icon name
      - `color` (text) - hex color code
      - `parent_id` (uuid) - reference to parent template
      - `display_order` (integer) - for UI ordering
      - `created_at` (timestamptz)

  2. Security
    - NO RLS policies needed - this is a system table
    - Users never directly access this table
    - Only the database trigger reads from it

  3. Indexes
    - Index on type for efficient filtering during copy
    - Index on parent_id for hierarchical queries
*/

CREATE TABLE IF NOT EXISTS category_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  detail_type text,
  icon text DEFAULT 'circle',
  color text DEFAULT '#6b7280',
  parent_id uuid REFERENCES category_templates(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_category_templates_type ON category_templates(type);
CREATE INDEX IF NOT EXISTS idx_category_templates_parent_id ON category_templates(parent_id);

-- No RLS needed - this is a system table that users never directly access
COMMENT ON TABLE category_templates IS 'Template categories copied to new users on signup';
