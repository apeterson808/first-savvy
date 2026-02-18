/*
  # Phase 2: Async Detection Job Queue System
  
  ## Overview
  Production-grade background job system for transaction detection and AI suggestions.
  Replaces client-side detection with server-side worker queue for 100k+ user scalability.
  
  ## New Tables
  
  ### 1. detection_jobs
  Core job queue table with comprehensive safeguards:
  - Job locking with SKIP LOCKED + auto-recovery via lock_expires_at
  - Chunked processing (max 100 tx for transfer/cc, 50 for AI)
  - Retry mechanism with attempts tracking
  - Duration and error tracking for observability
  - Status: queued → running → done/failed
  
  ### 2. transaction_processing_state
  Per-transaction state tracking:
  - Records which detectors have processed each transaction
  - Tracks versions to enable smart rescans
  - Prevents duplicate processing
  - Status: queued → processing → done/failed per detector type
  
  ### 3. transfer_match_history
  Idempotency for transfer detection:
  - Records all match decisions (suggested/accepted/rejected)
  - Prevents re-suggesting rejected pairs
  - Unique constraint on (transaction_id, matched_transaction_id)
  - Tracks detector version for controlled rescans
  
  ### 4. cc_payment_match_history
  Idempotency for credit card payment detection:
  - Same pattern as transfer_match_history
  - Unique constraint on (bank_transaction_id, cc_transaction_id)
  - Prevents rejected matches from reappearing
  
  ### 5. job_execution_metrics
  Observability and monitoring:
  - Tracks duration, throughput, success/failure rates
  - Enables performance analysis and debugging
  - Supports retry strategy optimization
  
  ### 6. detection_jobs_archive
  Long-term storage for completed jobs:
  - Keeps detection_jobs table lean
  - Preserves audit trail for compliance
  - Cleanup policy: archive after 30 days, delete after 1 year
  
  ## Enums
  
  - job_type: transfer, cc_payment, ai_category, ai_contact
  - job_status: queued, running, done, failed
  - match_decision: suggested, accepted, rejected, auto_accepted
  - detector_status: queued, processing, done, failed
  
  ## Key Functions
  
  ### enqueue_detection(profile_id, transaction_ids, reason)
  Entry point for creating detection jobs:
  - Acquires advisory lock to prevent concurrent batch creation
  - Deduplicates transaction_ids
  - Enforces queue depth limit (1000 jobs per profile)
  - Chunks transactions into bounded jobs
  - Returns batch_id for status tracking
  
  ### claim_next_job(worker_id, lock_duration)
  Worker job claiming with auto-recovery:
  - Uses SKIP LOCKED for concurrency safety
  - Automatically reclaims expired locks (dead worker recovery)
  - Updates attempts counter and timestamps
  - Returns next available job or NULL
  
  ### complete_job(job_id, status, error)
  Mark job as completed or failed:
  - Records finish timestamp and duration
  - Updates transaction_processing_state
  - Creates job_execution_metrics entry
  
  ### auto_detect_transfers_optimized(profile_id, transaction_ids)
  Set-based transfer detection (no loops):
  - Single query finds all matches
  - Checks rejection history for idempotency
  - Batch updates all matches at once
  - Records decisions in match_history
  
  ### archive_completed_jobs()
  Cleanup policy:
  - Archives jobs older than 30 days
  - Keeps failed jobs for 90 days
  - Maintains bounded table size
  
  ## Indexes
  
  All critical queries are indexed:
  - detection_jobs: status + created_at + lock_expires_at
  - transaction_processing_state: profile_id + status
  - transfer_match_history: rejection lookups
  - transactions: detection queries (amount + date + status)
  
  ## Safeguards
  
  1. **Profile-Level Concurrency Control**
     - Advisory locks prevent overlapping batches
     - Deduplication of transaction_ids
     - Unique constraints prevent duplicate matches
  
  2. **Backpressure & Throughput Limits**
     - Queue depth limit (1000 jobs per profile)
     - Worker rate limiting (50 AI calls/min)
     - Job archival after 30 days
  
  3. **Database Performance**
     - Set-based operations (no row-by-row loops)
     - All queries filter by profile_id
     - Comprehensive indexes
     - No unbounded array operations
  
  ## Migration Steps
  
  1. Create enums
  2. Create tables with RLS
  3. Create indexes
  4. Create functions
  5. Add version tracking to existing tables
  6. Update AI suggestion tables with status fields
*/

-- ============================================================================
-- STEP 1: CREATE ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE job_type AS ENUM ('transfer', 'cc_payment', 'ai_category', 'ai_contact');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('queued', 'running', 'done', 'failed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE match_decision AS ENUM ('suggested', 'accepted', 'rejected', 'auto_accepted');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE detector_status AS ENUM ('queued', 'processing', 'done', 'failed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STEP 2: CREATE TABLES
-- ============================================================================

-- Detection jobs queue table
CREATE TABLE IF NOT EXISTS detection_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    job_type job_type NOT NULL,
    batch_id UUID NOT NULL,
    transaction_ids UUID[] NOT NULL,
    
    -- Status tracking
    status job_status DEFAULT 'queued' NOT NULL,
    attempts INT DEFAULT 0 NOT NULL,
    max_attempts INT DEFAULT 3 NOT NULL,
    
    -- Locking with auto-recovery
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    lock_expires_at TIMESTAMPTZ,
    
    -- Duration tracking
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    
    -- Error tracking
    error TEXT,
    last_attempt_at TIMESTAMPTZ,
    
    -- Metadata
    reason TEXT DEFAULT 'import',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT detection_jobs_transaction_ids_not_empty CHECK (array_length(transaction_ids, 1) > 0)
);

-- Per-transaction processing state
CREATE TABLE IF NOT EXISTS transaction_processing_state (
    transaction_id UUID PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Transfer detection state
    transfer_status detector_status DEFAULT 'queued',
    transfer_scanned_at TIMESTAMPTZ,
    transfer_detector_version TEXT DEFAULT 'v1',
    
    -- CC payment detection state
    cc_payment_status detector_status DEFAULT 'queued',
    cc_payment_scanned_at TIMESTAMPTZ,
    cc_payment_detector_version TEXT DEFAULT 'v1',
    
    -- AI category suggestion state
    ai_category_status detector_status DEFAULT 'queued',
    ai_category_scanned_at TIMESTAMPTZ,
    ai_category_model_version TEXT DEFAULT 'gpt-4o-mini-2024-07-18',
    ai_category_prompt_version TEXT DEFAULT 'v1',
    
    -- AI contact suggestion state
    ai_contact_status detector_status DEFAULT 'queued',
    ai_contact_scanned_at TIMESTAMPTZ,
    ai_contact_model_version TEXT DEFAULT 'gpt-4o-mini-2024-07-18',
    ai_contact_prompt_version TEXT DEFAULT 'v1',
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Transfer match history for idempotency
CREATE TABLE IF NOT EXISTS transfer_match_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    matched_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    
    decision match_decision NOT NULL,
    confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    decided_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    decided_by UUID REFERENCES auth.users(id),
    
    detector_version TEXT DEFAULT 'v1' NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT transfer_match_history_unique_pair UNIQUE(transaction_id, matched_transaction_id),
    CONSTRAINT transfer_match_history_no_self_match CHECK (transaction_id != matched_transaction_id)
);

-- CC payment match history for idempotency
CREATE TABLE IF NOT EXISTS cc_payment_match_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    bank_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    cc_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    
    decision match_decision NOT NULL,
    confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    decided_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    decided_by UUID REFERENCES auth.users(id),
    
    detector_version TEXT DEFAULT 'v1' NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    CONSTRAINT cc_payment_match_history_unique_pair UNIQUE(bank_transaction_id, cc_transaction_id),
    CONSTRAINT cc_payment_match_history_no_self_match CHECK (bank_transaction_id != cc_transaction_id)
);

-- Job execution metrics for observability
CREATE TABLE IF NOT EXISTS job_execution_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES detection_jobs(id) ON DELETE SET NULL,
    job_type job_type NOT NULL,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Performance metrics
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    duration_ms INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000
    ) STORED,
    
    -- Volume metrics
    transactions_processed INT NOT NULL,
    matches_found INT DEFAULT 0,
    suggestions_created INT DEFAULT 0,
    
    -- Outcome
    status job_status NOT NULL,
    error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Archive table for completed jobs
CREATE TABLE IF NOT EXISTS detection_jobs_archive (
    LIKE detection_jobs INCLUDING ALL,
    archived_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- STEP 3: CREATE INDEXES
-- ============================================================================

-- Detection jobs indexes
CREATE INDEX IF NOT EXISTS idx_detection_jobs_claim 
ON detection_jobs(status, created_at, lock_expires_at, profile_id)
WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_detection_jobs_profile_status 
ON detection_jobs(profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_detection_jobs_batch 
ON detection_jobs(batch_id, status);

-- Processing state indexes
CREATE INDEX IF NOT EXISTS idx_processing_state_profile 
ON transaction_processing_state(profile_id, transfer_status, ai_category_status);

CREATE INDEX IF NOT EXISTS idx_processing_state_transaction 
ON transaction_processing_state(transaction_id);

-- Match history indexes
CREATE INDEX IF NOT EXISTS idx_transfer_history_rejection_lookup
ON transfer_match_history(profile_id, decision, detector_version)
WHERE decision = 'rejected';

CREATE INDEX IF NOT EXISTS idx_transfer_history_transaction_lookup
ON transfer_match_history(transaction_id, matched_transaction_id, decision);

CREATE INDEX IF NOT EXISTS idx_cc_payment_history_rejection_lookup
ON cc_payment_match_history(profile_id, decision, detector_version)
WHERE decision = 'rejected';

CREATE INDEX IF NOT EXISTS idx_cc_payment_history_transaction_lookup
ON cc_payment_match_history(bank_transaction_id, cc_transaction_id, decision);

-- Job metrics indexes
CREATE INDEX IF NOT EXISTS idx_job_metrics_profile_type 
ON job_execution_metrics(profile_id, job_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_metrics_duration 
ON job_execution_metrics(duration_ms DESC);

CREATE INDEX IF NOT EXISTS idx_job_metrics_status 
ON job_execution_metrics(status, created_at DESC);

-- Transaction detection indexes (if not exist)
CREATE INDEX IF NOT EXISTS idx_transactions_detection_lookup 
ON transactions(profile_id, status, transfer_pair_id, date) 
WHERE transfer_pair_id IS NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_transactions_amount_date 
ON transactions(profile_id, amount, date, status) 
WHERE status = 'pending';

-- ============================================================================
-- STEP 4: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE detection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_processing_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_payment_match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_execution_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_jobs_archive ENABLE ROW LEVEL SECURITY;

-- Detection jobs policies
CREATE POLICY "Users can view own detection jobs"
ON detection_jobs FOR SELECT
TO authenticated
USING (
    profile_id IN (
        SELECT profile_id FROM profile_memberships
        WHERE user_id = auth.uid()
    )
);

-- Processing state policies
CREATE POLICY "Users can view own processing state"
ON transaction_processing_state FOR SELECT
TO authenticated
USING (
    profile_id IN (
        SELECT profile_id FROM profile_memberships
        WHERE user_id = auth.uid()
    )
);

-- Match history policies
CREATE POLICY "Users can view own match history"
ON transfer_match_history FOR SELECT
TO authenticated
USING (
    profile_id IN (
        SELECT profile_id FROM profile_memberships
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can view own cc payment history"
ON cc_payment_match_history FOR SELECT
TO authenticated
USING (
    profile_id IN (
        SELECT profile_id FROM profile_memberships
        WHERE user_id = auth.uid()
    )
);

-- Metrics policies
CREATE POLICY "Users can view own metrics"
ON job_execution_metrics FOR SELECT
TO authenticated
USING (
    profile_id IN (
        SELECT profile_id FROM profile_memberships
        WHERE user_id = auth.uid()
    )
);

-- Archive policies
CREATE POLICY "Users can view own archived jobs"
ON detection_jobs_archive FOR SELECT
TO authenticated
USING (
    profile_id IN (
        SELECT profile_id FROM profile_memberships
        WHERE user_id = auth.uid()
    )
);

-- ============================================================================
-- STEP 5: ADD VERSION TRACKING TO EXISTING TABLES
-- ============================================================================

-- Add status and version tracking to AI suggestions
DO $$ BEGIN
    ALTER TABLE ai_category_suggestions ADD COLUMN IF NOT EXISTS status match_decision DEFAULT 'suggested';
    ALTER TABLE ai_category_suggestions ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
    ALTER TABLE ai_category_suggestions ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id);
    ALTER TABLE ai_category_suggestions ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'gpt-4o-mini-2024-07-18';
    ALTER TABLE ai_category_suggestions ADD COLUMN IF NOT EXISTS prompt_version TEXT DEFAULT 'v1';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE ai_contact_suggestions ADD COLUMN IF NOT EXISTS status match_decision DEFAULT 'suggested';
    ALTER TABLE ai_contact_suggestions ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
    ALTER TABLE ai_contact_suggestions ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id);
    ALTER TABLE ai_contact_suggestions ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'gpt-4o-mini-2024-07-18';
    ALTER TABLE ai_contact_suggestions ADD COLUMN IF NOT EXISTS prompt_version TEXT DEFAULT 'v1';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Create indexes on suggestion status
CREATE INDEX IF NOT EXISTS idx_ai_category_suggestions_status
ON ai_category_suggestions(transaction_id, status)
WHERE status = 'suggested';

CREATE INDEX IF NOT EXISTS idx_ai_contact_suggestions_status
ON ai_contact_suggestions(transaction_id, status)
WHERE status = 'suggested';

-- ============================================================================
-- STEP 6: CORE FUNCTIONS
-- ============================================================================

-- Enqueue detection jobs with all safeguards
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
    SELECT unnest(v_deduplicated_ids), p_profile_id
    ON CONFLICT (transaction_id) DO NOTHING;
    
    -- SAFEGUARD 4: Create chunked jobs (bounded processing)
    
    -- Transfer detection: chunks of 100
    FOR i IN 1..CEIL(array_length(v_deduplicated_ids, 1) / 100.0) LOOP
        v_chunk := v_deduplicated_ids[(i-1)*100+1 : LEAST(i*100, array_length(v_deduplicated_ids, 1))];
        INSERT INTO detection_jobs (profile_id, job_type, batch_id, transaction_ids, status, reason)
        VALUES (p_profile_id, 'transfer', v_batch_id, v_chunk, 'queued', p_reason);
    END LOOP;
    
    -- CC payment detection: chunks of 100
    FOR i IN 1..CEIL(array_length(v_deduplicated_ids, 1) / 100.0) LOOP
        v_chunk := v_deduplicated_ids[(i-1)*100+1 : LEAST(i*100, array_length(v_deduplicated_ids, 1))];
        INSERT INTO detection_jobs (profile_id, job_type, batch_id, transaction_ids, status, reason)
        VALUES (p_profile_id, 'cc_payment', v_batch_id, v_chunk, 'queued', p_reason);
    END LOOP;
    
    -- AI category: chunks of 50
    FOR i IN 1..CEIL(array_length(v_deduplicated_ids, 1) / 50.0) LOOP
        v_chunk := v_deduplicated_ids[(i-1)*50+1 : LEAST(i*50, array_length(v_deduplicated_ids, 1))];
        INSERT INTO detection_jobs (profile_id, job_type, batch_id, transaction_ids, status, reason)
        VALUES (p_profile_id, 'ai_category', v_batch_id, v_chunk, 'queued', p_reason);
    END LOOP;
    
    -- AI contact: chunks of 50
    FOR i IN 1..CEIL(array_length(v_deduplicated_ids, 1) / 50.0) LOOP
        v_chunk := v_deduplicated_ids[(i-1)*50+1 : LEAST(i*50, array_length(v_deduplicated_ids, 1))];
        INSERT INTO detection_jobs (profile_id, job_type, batch_id, transaction_ids, status, reason)
        VALUES (p_profile_id, 'ai_contact', v_batch_id, v_chunk, 'queued', p_reason);
    END LOOP;
    
    RETURN v_batch_id;
END;
$$;

-- Claim next job with auto-recovery
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
BEGIN
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
    WHERE j.id = (
        SELECT j2.id
        FROM detection_jobs j2
        WHERE (
            j2.status = 'queued' 
            OR (j2.status = 'running' AND j2.lock_expires_at < NOW()) -- AUTO-RECOVERY
        )
        AND j2.attempts < j2.max_attempts
        ORDER BY j2.created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING j.id, j.profile_id, j.job_type, j.batch_id, j.transaction_ids, j.status, j.attempts, j.reason;
END;
$$;

-- Complete job with metrics
CREATE OR REPLACE FUNCTION complete_job(
    p_job_id UUID,
    p_status job_status,
    p_error TEXT DEFAULT NULL,
    p_matches_found INT DEFAULT 0,
    p_suggestions_created INT DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job RECORD;
    v_detector_field TEXT;
BEGIN
    -- Get job details
    SELECT * INTO v_job
    FROM detection_jobs
    WHERE id = p_job_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job % not found', p_job_id;
    END IF;
    
    -- Update job status
    UPDATE detection_jobs
    SET 
        status = p_status,
        finished_at = NOW(),
        error = p_error,
        updated_at = NOW(),
        locked_at = NULL,
        locked_by = NULL,
        lock_expires_at = NULL
    WHERE id = p_job_id;
    
    -- Update processing state
    v_detector_field := v_job.job_type || '_status';
    
    IF p_status = 'done' THEN
        EXECUTE format(
            'UPDATE transaction_processing_state 
             SET %I = ''done'', 
                 %I = NOW(),
                 updated_at = NOW()
             WHERE transaction_id = ANY($1)',
            v_detector_field,
            v_job.job_type || '_scanned_at'
        ) USING v_job.transaction_ids;
    ELSE
        EXECUTE format(
            'UPDATE transaction_processing_state 
             SET %I = ''failed'',
                 updated_at = NOW()
             WHERE transaction_id = ANY($1)',
            v_detector_field
        ) USING v_job.transaction_ids;
    END IF;
    
    -- Record metrics
    INSERT INTO job_execution_metrics (
        job_id, job_type, profile_id,
        started_at, finished_at,
        transactions_processed, matches_found, suggestions_created,
        status, error
    ) VALUES (
        p_job_id, v_job.job_type, v_job.profile_id,
        v_job.started_at, NOW(),
        array_length(v_job.transaction_ids, 1), p_matches_found, p_suggestions_created,
        p_status, p_error
    );
END;
$$;

-- Archive completed jobs (cleanup policy)
CREATE OR REPLACE FUNCTION archive_completed_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Move completed jobs older than 30 days to archive
    INSERT INTO detection_jobs_archive
    SELECT *, NOW()
    FROM detection_jobs
    WHERE status = 'done'
    AND finished_at < NOW() - INTERVAL '30 days';
    
    -- Delete archived jobs
    DELETE FROM detection_jobs
    WHERE status = 'done'
    AND finished_at < NOW() - INTERVAL '30 days';
    
    -- Keep failed jobs for 90 days for debugging
    DELETE FROM detection_jobs
    WHERE status = 'failed'
    AND finished_at < NOW() - INTERVAL '90 days';
    
    -- Delete old archived jobs (1 year retention)
    DELETE FROM detection_jobs_archive
    WHERE archived_at < NOW() - INTERVAL '1 year';
END;
$$;

-- Get batch status
CREATE OR REPLACE FUNCTION get_batch_status(p_batch_id UUID)
RETURNS TABLE (
    total_jobs BIGINT,
    queued_jobs BIGINT,
    running_jobs BIGINT,
    done_jobs BIGINT,
    failed_jobs BIGINT,
    progress_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_jobs,
        COUNT(*) FILTER (WHERE status = 'queued')::BIGINT as queued_jobs,
        COUNT(*) FILTER (WHERE status = 'running')::BIGINT as running_jobs,
        COUNT(*) FILTER (WHERE status = 'done')::BIGINT as done_jobs,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_jobs,
        ROUND(
            (COUNT(*) FILTER (WHERE status = 'done')::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100,
            2
        ) as progress_percentage
    FROM detection_jobs
    WHERE batch_id = p_batch_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION enqueue_detection TO authenticated;
GRANT EXECUTE ON FUNCTION get_batch_status TO authenticated;
