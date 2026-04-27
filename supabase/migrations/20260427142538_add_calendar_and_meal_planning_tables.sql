/*
  # Calendar and Meal Planning System

  ## Summary
  Creates four new tables to support the Calendar page with meal planning,
  general family events, and per-profile display preferences.

  ## New Tables

  ### 1. meal_recipes
  The family's personal recipe/meal library. Stores reusable recipes that can
  be scheduled onto any day. Ingredients stored as a JSON array for flexibility.

  ### 2. meal_plan_entries
  Scheduled meals on specific calendar days. Links to a recipe OR stores a
  custom one-off meal name. Supports breakfast/lunch/dinner/snack slots.

  ### 3. calendar_events
  General family calendar events (appointments, activities, reminders) that
  are not tasks or transactions. Optional assignment to a specific child.

  ### 4. calendar_preferences
  Per-profile display settings for the calendar: financial visibility toggle,
  child color assignments, and default view preference.

  ## Security
  - RLS enabled on all tables
  - All policies scope data to the owning profile_id
  - calendar_preferences uses upsert pattern (insert + update policies)

  ## Notes
  1. meal_recipes.ingredients is a jsonb array of {name, quantity, unit} objects
  2. meal_plan_entries.recipe_id is nullable — custom one-off meals use custom_meal_name instead
  3. calendar_preferences has one row per profile (profile_id is the primary key)
  4. child_colors in calendar_preferences is a jsonb map: { "child_uuid": "#hex_color" }
*/

-- ============================================================
-- meal_recipes
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES user_settings(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'dinner',
  prep_time_minutes integer DEFAULT 0,
  tags text[] DEFAULT '{}',
  ingredients jsonb DEFAULT '[]',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_recipes_profile_id ON meal_recipes(profile_id);
CREATE INDEX IF NOT EXISTS idx_meal_recipes_category ON meal_recipes(category);
CREATE INDEX IF NOT EXISTS idx_meal_recipes_is_active ON meal_recipes(is_active);

ALTER TABLE meal_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal recipes"
  ON meal_recipes FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own meal recipes"
  ON meal_recipes FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own meal recipes"
  ON meal_recipes FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own meal recipes"
  ON meal_recipes FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- ============================================================
-- meal_plan_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_plan_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES user_settings(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES meal_recipes(id) ON DELETE SET NULL,
  custom_meal_name text DEFAULT '',
  scheduled_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'dinner',
  serves integer DEFAULT 4,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_type_check CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'))
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_profile_id ON meal_plan_entries(profile_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_scheduled_date ON meal_plan_entries(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_profile_date ON meal_plan_entries(profile_id, scheduled_date);

ALTER TABLE meal_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal plan entries"
  ON meal_plan_entries FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own meal plan entries"
  ON meal_plan_entries FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own meal plan entries"
  ON meal_plan_entries FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own meal plan entries"
  ON meal_plan_entries FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- ============================================================
-- calendar_events
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES user_settings(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  event_date date NOT NULL,
  start_time time,
  end_time time,
  all_day boolean NOT NULL DEFAULT true,
  assigned_to_child_id uuid REFERENCES child_profiles(id) ON DELETE SET NULL,
  color text DEFAULT '#3b82f6',
  icon text DEFAULT 'Calendar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_profile_id ON calendar_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_profile_date ON calendar_events(profile_id, event_date);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own calendar events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- ============================================================
-- calendar_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_preferences (
  profile_id uuid PRIMARY KEY REFERENCES user_settings(id) ON DELETE CASCADE,
  show_financials boolean NOT NULL DEFAULT true,
  child_colors jsonb NOT NULL DEFAULT '{}',
  default_view text NOT NULL DEFAULT 'month',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT default_view_check CHECK (default_view IN ('month', 'week', 'agenda'))
);

ALTER TABLE calendar_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar preferences"
  ON calendar_preferences FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own calendar preferences"
  ON calendar_preferences FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own calendar preferences"
  ON calendar_preferences FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
