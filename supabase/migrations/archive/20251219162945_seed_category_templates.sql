/*
  # Seed Category Templates

  1. Data Insertion
    - Insert 26 standard category templates that will be copied to new users
    - 7 income categories
    - 17 expense categories
    - 2 transfer categories (one income, one expense)

  2. Template Properties
    - Each template includes name, type, detail_type, icon, and color
    - Templates are immutable and never directly accessed by users
    - Users get their own copies on signup

  3. Notes
    - These templates form the foundation of the financial categorization system
    - Icons are Lucide React icon names
    - Colors use hex format for consistency
*/

-- Income categories (7)
INSERT INTO category_templates (name, type, detail_type, icon, color, display_order) VALUES
  ('Salary', 'income', 'income', 'Briefcase', '#10b981', 1),
  ('Wages', 'income', 'income', 'DollarSign', '#10b981', 2),
  ('Bonus', 'income', 'income', 'Gift', '#10b981', 3),
  ('Investment Income', 'income', 'income', 'TrendingUp', '#10b981', 4),
  ('Refund', 'income', 'income', 'RotateCcw', '#10b981', 5),
  ('Gift', 'income', 'income', 'Heart', '#10b981', 6),
  ('Other Income', 'income', 'income', 'Plus', '#10b981', 7)
ON CONFLICT DO NOTHING;

-- Expense categories (17)
INSERT INTO category_templates (name, type, detail_type, icon, color, display_order) VALUES
  ('Groceries', 'expense', 'expense', 'ShoppingCart', '#ef4444', 8),
  ('Dining', 'expense', 'expense', 'Utensils', '#f97316', 9),
  ('Gas', 'expense', 'expense', 'Fuel', '#f59e0b', 10),
  ('Transportation', 'expense', 'expense', 'Car', '#eab308', 11),
  ('Utilities', 'expense', 'expense', 'Lightbulb', '#84cc16', 12),
  ('Rent', 'expense', 'expense', 'Home', '#22c55e', 13),
  ('Mortgage Payment', 'expense', 'expense', 'Home', '#22c55e', 14),
  ('Shopping', 'expense', 'expense', 'ShoppingBag', '#06b6d4', 15),
  ('Entertainment', 'expense', 'expense', 'Film', '#0ea5e9', 16),
  ('Healthcare', 'expense', 'expense', 'Heart', '#3b82f6', 17),
  ('Insurance', 'expense', 'expense', 'Shield', '#6366f1', 18),
  ('Education', 'expense', 'expense', 'BookOpen', '#8b5cf6', 19),
  ('Travel', 'expense', 'expense', 'Plane', '#a855f7', 20),
  ('Personal Care', 'expense', 'expense', 'Sparkles', '#d946ef', 21),
  ('Subscriptions', 'expense', 'expense', 'CreditCard', '#ec4899', 22),
  ('Other Expense', 'expense', 'expense', 'Minus', '#f43f5e', 23)
ON CONFLICT DO NOTHING;

-- Transfer categories (2)
INSERT INTO category_templates (name, type, detail_type, icon, color, display_order) VALUES
  ('Transfer', 'income', 'transfer', 'ArrowLeftRight', '#64748b', 24),
  ('Transfer', 'expense', 'transfer', 'ArrowLeftRight', '#64748b', 25)
ON CONFLICT DO NOTHING;
