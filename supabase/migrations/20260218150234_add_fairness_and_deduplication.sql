/*
  # Add Fairness and Deduplication to Job Queue

  ## Changes

  1. **Profile Fairness**
     - Modified claim_next_job to use round-robin profile selection
     - Prevents one large profile from starving others
     - Tracks last_claimed_profile_id to rotate fairly

  2. **Job Deduplication**
     - Modified enqueue_detection to skip already-queued transaction IDs
     - Prevents duplicate jobs from double-clicks or retries
     - Only creates jobs for transactions not already queued/running

  3. **Composite Index for Deduplication**
     - Added GIN index on transaction_ids for fast array overlap checks
     - Enables efficient "which transactions are already queued?" queries

  ## Implementation Details

  ### Round-Robin Fairness Algorithm
  - Maintain last_claimed_profile_id in a singleton table
  - claim_next_job selects the oldest job from a profile > last_claimed_profile_id
  - If none found, wraps around to smallest profile_id
  - Ensures all profiles get equal processing time

  ### Deduplication Logic
  - Before creating jobs, check which transaction_ids are already in queued/running jobs
  - Only create jobs for the net-new transaction_ids
  - Uses array set difference to compute the delta
*/

-- ============================================================================
-- STEP 1: CREATE WORKER STATE TABLE FOR ROUND-ROBIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS worker_state (
    id INT PRIMARY KEY DEFAULT 1,
    last_claimed_profile_id UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT worker_state_singleton CHECK (id = 1)
);

-- Initialize with single row
INSERT INTO worker_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE worker_state ENABLE ROW LEVEL SECURITY;

-- Only system functions can read/write this
CREATE POLICY "System can manage worker state"
ON worker_state FOR ALL
TO authenticated
USING (false);

-- ============================================================================
-- STEP 2: ADD GIN INDEX FOR DEDUPLICATION QUERIES
-- ============================================================================

-- Enable fast "array overlap" queries for deduplication
CREATE INDEX IF NOT EXISTS idx_detection_jobs_transaction_ids_gin
ON detection_jobs USING GIN (transaction_ids)
WHERE status IN ('queued', 'running');

-- ============================================================================
-- STEP 3: REPLACE claim_next_job WITH FAIRNESS
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_next_job(
    p_worker_id TEXT,
    p_lock_duration_seconds INT DEFAULT 300
)
RETURNS TABLE (
    id UUID,
    profile_id UUID,
    job_type job_type,
    batch_id UUID,
    transaction_ids UUID[],
    status job_status,
    attempts INT,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_claimed_profile_id UUID;
    v_job_id UUID;
BEGIN
    -- Get last claimed profile for round-robin fairness
    SELECT last_claimed_profile_id INTO v_last_claimed_profile_id
    FROM worker_state
    WHERE id = 1
    FOR UPDATE;  -- Lock to prevent race conditions

    -- Try to find next job from a different profile (round-robin)
    SELECT j.id INTO v_job_id
    FROM detection_jobs j
    WHERE (
        j.status = 'queued'
        OR (j.status = 'running' AND j.lock_expires_at < NOW())
    )
    AND j.attempts < j.max_attempts
    AND (
        v_last_claimed_profile_id IS NULL
        OR j.profile_id > v_last_claimed_profile_id
    )
    ORDER BY j.profile_id, j.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If no job found (wrapped around), try from beginning
    IF v_job_id IS NULL THEN
        SELECT j.id INTO v_job_id
        FROM detection_jobs j
        WHERE (
            j.status = 'queued'
            OR (j.status = 'running' AND j.lock_expires_at < NOW())
        )
        AND j.attempts < j.max_attempts
        ORDER BY j.profile_id, j.created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
    END IF;

    -- No jobs available
    IF v_job_id IS NULL THEN
        RETURN;
    END IF;

    -- Claim the job
    RETURN QUERY
    UPDATE detection_jobs j
    SET
        status = 'running',
        locked_at = NOW(),
        locked_by = p_worker_id,
        lock_expires_at = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL,
        started_at = CASE WHEN j.started_at IS NULL THEN NOW() ELSE j.started_at END,
        attempts = j.attempts + 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
    WHERE j.id = v_job_id
    RETURNING j.id, j.profile_id, j.job_type, j.batch_id, j.transaction_ids, j.status, j.attempts, j.reason;

    -- Update last claimed profile for fairness
    IF FOUND THEN
        UPDATE worker_state
        SET
            last_claimed_profile_id = (SELECT profile_id FROM detection_jobs WHERE id = v_job_id),
            updated_at = NOW()
        WHERE id = 1;
    END IF;
END;
$$;

-- ============================================================================
-- STEP 4: REPLACE enqueue_detection WITH DEDUPLICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION enqueue_detection(
    p_profile_id UUID,
    p_transaction_ids UUID[],
    p_reason TEXT DEFAULT 'import'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_batch_id UUID;
    v_deduplicated_ids UUID[];
    v_already_queued_ids UUID[];
    v_net_new_ids UUID[];
    v_queued_count INT;
    v_chunk UUID[];
    v_chunk_size INT;
    i INT;
BEGIN
    -- SAFEGUARD 1: Acquire advisory lock (prevents concurrent batch creation)
    IF NOT pg_try_advisory_xact_lock(hashtext(p_profile_id::text)) THEN
        RAISE EXCEPTION 'Another detection batch is being created for this profile. Please wait.';
    END IF;

    -- SAFEGUARD 2: Deduplicate transaction_ids
    SELECT array_agg(DISTINCT id ORDER BY id)
    INTO v_deduplicated_ids
    FROM unnest(p_transaction_ids) AS id;

    IF v_deduplicated_ids IS NULL OR array_length(v_deduplicated_ids, 1) = 0 THEN
        RAISE EXCEPTION 'No valid transaction IDs provided';
    END IF;

    -- SAFEGUARD 2B: Remove transaction_ids already queued/running (DEDUPLICATION)
    SELECT array_agg(DISTINCT txn_id)
    INTO v_already_queued_ids
    FROM detection_jobs j,
         LATERAL unnest(j.transaction_ids) AS txn_id
    WHERE j.profile_id = p_profile_id
    AND j.status IN ('queued', 'running')
    AND txn_id = ANY(v_deduplicated_ids);

    -- Compute net-new transaction IDs (set difference)
    IF v_already_queued_ids IS NOT NULL AND array_length(v_already_queued_ids, 1) > 0 THEN
        SELECT array_agg(id ORDER BY id)
        INTO v_net_new_ids
        FROM unnest(v_deduplicated_ids) AS id
        WHERE id != ALL(v_already_queued_ids);
    ELSE
        v_net_new_ids := v_deduplicated_ids;
    END IF;

    -- If all transactions are already queued, return early
    IF v_net_new_ids IS NULL OR array_length(v_net_new_ids, 1) = 0 THEN
        RAISE NOTICE 'All transactions already queued for detection';
        RETURN NULL;  -- No batch created
    END IF;

    -- SAFEGUARD 3: Check queue depth (backpressure)
    SELECT COUNT(*) INTO v_queued_count
    FROM detection_jobs
    WHERE profile_id = p_profile_id
    AND status IN ('queued', 'running');

    IF v_queued_count > 1000 THEN
        RAISE EXCEPTION 'Queue limit reached (% jobs). Please wait for current jobs to complete.', v_queued_count;
    END IF;

    -- Generate batch ID
    v_batch_id := gen_random_uuid();

    -- Create/update processing state (idempotent)
    INSERT INTO transaction_processing_state (transaction_id, profile_id)
    SELECT unnest(v_net_new_ids), p_profile_id
    ON CONFLICT (transaction_id) DO NOTHING;

    -- SAFEGUARD 4: Create chunked jobs (bounded processing)

    -- Transfer detection: chunks of 100
    FOR i IN 1..CEIL(array_length(v_net_new_ids, 1) / 100.0) LOOP
        v_chunk := v_net_new_ids[(i-1)*100+1 : LEAST(i*100, array_length(v_net_new_ids, 1))];
        INSERT INTO detection_jobs (profile_id, job_type, batch_id, transaction_ids, status, reason)
        VALUES (p_profile_id, 'transfer', v_batch_id, v_chunk, 'queued', p_reason);
    END LOOP;

    -- CC payment detection: chunks of 100
    FOR i IN 1..CEIL(array_length(v_net_new_ids, 1) / 100.0) LOOP
        v_chunk := v_net_new_ids[(i-1)*100+1 : LEAST(i*100, array_length(v_net_new_ids, 1))];
        INSERT INTO detection_jobs (profile_id, job_type, batch_id, transaction_ids, status, reason)
        VALUES (p_profile_id, 'cc_payment', v_batch_id, v_chunk, 'queued', p_reason);
    END LOOP;

    -- AI category: chunks of 50
    FOR i IN 1..CEIL(array_length(v_net_new_ids, 1) / 50.0) LOOP
        v_chunk := v_net_new_ids[(i-1)*50+1 : LEAST(i*50, array_length(v_net_new_ids, 1))];
        INSERT INTO detection_jobs (profile_id, job_type, batch_id, transaction_ids, status, reason)
        VALUES (p_profile_id, 'ai_category', v_batch_id, v_chunk, 'queued', p_reason);
    END LOOP;

    -- AI contact: chunks of 50
    FOR i IN 1..CEIL(array_length(v_net_new_ids, 1) / 50.0) LOOP
        v_chunk := v_net_new_ids[(i-1)*50+1 : LEAST(i*50, array_length(v_net_new_ids, 1))];
        INSERT INTO detection_jobs (profile_id, job_type, batch_id, transaction_ids, status, reason)
        VALUES (p_profile_id, 'ai_contact', v_batch_id, v_chunk, 'queued', p_reason);
    END LOOP;

    RETURN v_batch_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION claim_next_job TO authenticated;
GRANT EXECUTE ON FUNCTION enqueue_detection TO authenticated;
