/*
  # Drop old overload of get_account_journal_lines_paginated

  ## Problem
  Two overloads exist with different parameter ordering:
    1. (p_profile_id, p_account_id, p_limit, p_offset, p_start_date, p_end_date)  -- new, correct
    2. (p_profile_id, p_account_id, p_start_date, p_end_date, p_limit, p_offset)  -- old, stale

  PostgREST cannot resolve the ambiguity and returns HTTP 300 ("Could not choose
  the best candidate function"), breaking the register tab entirely.

  ## Fix
  Drop the old overload. The new version (limit/offset before dates) is the one
  the frontend calls and is already deployed.
*/

DROP FUNCTION IF EXISTS get_account_journal_lines_paginated(
  uuid, uuid, date, date, integer, integer
);
