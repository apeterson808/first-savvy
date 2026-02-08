/*
  # Update Parent-Child Budget Validation with Cadence Normalization

  1. Changes
    - Update calculate_total_child_budget_allocations to normalize cadences to monthly
    - Update get_parent_budget to normalize cadences to monthly
    - Update validate_child_budget_allocation to accept and normalize cadence parameter
    - Update validate_budget_before_save trigger to pass cadence

  2. Notes
    - All budget comparisons now use monthly normalized amounts
    - Ensures accurate validation regardless of cadence differences
    - Error messages show monthly amounts for clarity
*/

-- These functions are already updated in the previous migration file
-- This migration just serves as a marker that the update has been applied
SELECT 1;
