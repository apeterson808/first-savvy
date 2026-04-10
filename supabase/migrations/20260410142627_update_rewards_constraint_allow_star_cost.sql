/*
  # Update rewards constraint to allow star_cost

  ## Summary
  The rewards table has an existing CHECK constraint that requires either points_cost > 0 OR cash_cost > 0.
  A star_cost column was added later for the star-based reward system used by child profiles.
  Rewards created through the UI only set star_cost, leaving points_cost and cash_cost at 0,
  which violates the old constraint and crashes the Rewards tab.

  ## Changes
  - Drops the old constraint: CHECK ((points_cost > 0) OR (cash_cost > 0))
  - Adds updated constraint: CHECK ((points_cost > 0) OR (cash_cost > 0) OR (star_cost > 0))
    allowing star-based rewards to be valid
*/

ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_check;

ALTER TABLE rewards ADD CONSTRAINT rewards_cost_check
  CHECK ((points_cost > 0) OR (cash_cost > (0)::numeric) OR (star_cost > 0));
