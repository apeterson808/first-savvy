/*
  # Create household_join_requests table

  Stores pending requests from new users who want to join an existing household.
  The household owner sees a notification, reviews the request, picks a role
  (spouse_full, spouse_view, or child), then approves or declines.

  1. New Tables
    - `household_join_requests`
      - `id` (uuid, pk)
      - `requester_user_id` (uuid) — the user asking to join
      - `requester_email` (text) — denormalized for display before profile loads
      - `requester_display_name` (text) — name they entered during onboarding
      - `target_profile_id` (uuid) — the owner's profile they want to join
      - `status` (text) — pending | approved | declined
      - `role` (text) — set by owner on approval: spouse_full | spouse_view
      - `created_at`, `updated_at`

  2. Security
    - RLS enabled; requester can insert & view own requests
    - Profile owner can read requests targeting their profile and update them
*/

CREATE TABLE IF NOT EXISTS household_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email text NOT NULL,
  requester_display_name text NOT NULL DEFAULT '',
  target_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  role text CHECK (role IN ('spouse_full', 'spouse_view')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hjr_target_profile ON household_join_requests(target_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_hjr_requester ON household_join_requests(requester_user_id);

ALTER TABLE household_join_requests ENABLE ROW LEVEL SECURITY;

-- Requester can insert their own request
CREATE POLICY "Requester can create join request"
  ON household_join_requests FOR INSERT
  TO authenticated
  WITH CHECK (requester_user_id = auth.uid());

-- Requester can view their own requests
CREATE POLICY "Requester can view own requests"
  ON household_join_requests FOR SELECT
  TO authenticated
  USING (requester_user_id = auth.uid());

-- Profile owner can view requests targeting their profile
CREATE POLICY "Profile owner can view incoming requests"
  ON household_join_requests FOR SELECT
  TO authenticated
  USING (
    target_profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Profile owner can update (approve/decline) requests targeting their profile
CREATE POLICY "Profile owner can update requests"
  ON household_join_requests FOR UPDATE
  TO authenticated
  USING (
    target_profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    target_profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
