/*
  # Remove Automatic Matching Infrastructure

  Complete cleanup of the disabled automatic matching system.

  1. Tables Dropped
    - `transaction_processing_state` - detection queue state tracking
    - `job_execution_metrics` - detection job performance metrics
    - `worker_state` - background worker state
    - `transaction_match_history` - match decision history (if exists)

  2. Enum Types Dropped
    - `detector_status` - processing status enum
    - `job_type` - job type enum
    - `job_status` - job status enum

  3. Database Comments Updated
    - Remove matching-related comments from transactions table

  This migration completes the removal of the automatic matching system that
  was disabled in migration 20260227155005. The matching columns were already
  removed from the transactions table in previous migrations.
*/

-- Drop tables (cascade to remove foreign key dependencies)
DROP TABLE IF EXISTS transaction_processing_state CASCADE;
DROP TABLE IF EXISTS job_execution_metrics CASCADE;
DROP TABLE IF EXISTS worker_state CASCADE;
DROP TABLE IF EXISTS transaction_match_history CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS detector_status CASCADE;
DROP TYPE IF EXISTS job_type CASCADE;
DROP TYPE IF EXISTS job_status CASCADE;

-- Update transactions table comment to reflect matching is fully removed
COMMENT ON TABLE transactions IS 'Transaction records. Matching system has been completely removed.';