/*
  # Add Contact Grouping Support

  1. New Columns
    - `contacts.tags` - Array of text tags for grouping contacts (e.g., ["Vendors", "Personal", "Utilities"])
    - `contacts.group_name` - Optional primary group/category name for the contact
    - `contacts.color` - Optional color for visual organization

  2. Indexes
    - GIN index on tags array for fast searching

  3. Notes
    - Tags allow flexible multi-group membership (contact can be in multiple groups)
    - Group name provides a primary category for simpler organization
    - Color allows visual differentiation in the UI
*/

-- Add tags array column for flexible multi-group membership
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY[]::text[];

-- Add primary group name column
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS group_name text;

-- Add color column for visual organization
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS color text DEFAULT '#6B7280';

-- Create GIN index for fast tag searches
CREATE INDEX IF NOT EXISTS contacts_tags_gin_idx ON contacts USING GIN (tags);

-- Create index on group_name for filtering
CREATE INDEX IF NOT EXISTS contacts_group_name_idx ON contacts (group_name) WHERE group_name IS NOT NULL;