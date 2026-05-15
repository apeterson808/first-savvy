/*
  # Create retirement_settings table

  ## Summary
  Stores per-user retirement planning parameters used to generate the
  forward projection on the Net Worth chart.

  ## New Tables
  - `retirement_settings`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users, unique — one row per user)
    - `retirement_age` (integer, default 65)
    - `monthly_savings` (numeric, how much user saves per month)
    - `monthly_retirement_spending` (numeric, expected monthly spend in retirement)
    - `assumed_growth_rate` (numeric, annual growth rate decimal e.g. 0.07 = 7%)
    - `spending_style` (text: 'thrifty' | 'moderate' | 'spendy')
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled
  - Users can only read/write their own row
*/

CREATE TABLE IF NOT EXISTS retirement_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  retirement_age integer NOT NULL DEFAULT 65,
  monthly_savings numeric(12,2) NOT NULL DEFAULT 0,
  monthly_retirement_spending numeric(12,2) NOT NULL DEFAULT 0,
  assumed_growth_rate numeric(5,4) NOT NULL DEFAULT 0.0700,
  spending_style text NOT NULL DEFAULT 'moderate',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT retirement_settings_user_id_unique UNIQUE (user_id),
  CONSTRAINT retirement_settings_retirement_age_check CHECK (retirement_age BETWEEN 40 AND 85),
  CONSTRAINT retirement_settings_growth_rate_check CHECK (assumed_growth_rate BETWEEN 0 AND 0.3),
  CONSTRAINT retirement_settings_spending_style_check CHECK (spending_style IN ('thrifty', 'moderate', 'spendy'))
);

ALTER TABLE retirement_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own retirement settings"
  ON retirement_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own retirement settings"
  ON retirement_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own retirement settings"
  ON retirement_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own retirement settings"
  ON retirement_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS retirement_settings_user_id_idx ON retirement_settings(user_id);
