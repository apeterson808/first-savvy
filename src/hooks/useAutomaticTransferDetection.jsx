import { useCallback } from 'react';

/**
 * PHASE 2: Client-side detection is now DISABLED
 *
 * All detection now happens server-side via the detection-worker edge function.
 * This hook is kept for backward compatibility but does nothing.
 *
 * Detection is now triggered automatically when transactions are imported via:
 * - detectionQueueAPI.enqueueDetection() in TransactionReviewDialog
 * - Background worker processes jobs asynchronously
 * - UI reads cached results from ai_category_suggestions, transfer_pair_id, etc.
 *
 * This hook can be deleted after Phase 2 is stable (2 weeks).
 */
export function useAutomaticTransferDetection(profileId, pendingTransactions = []) {
  // NO-OP: Detection happens server-side

  const detectNewTransactions = useCallback((newTransactionIds) => {
    // NO-OP: Detection happens server-side via job queue
    console.log('[useAutomaticTransferDetection] Client-side detection disabled (Phase 2)');
  }, []);

  const scanAllPendingTransactions = useCallback(async () => {
    // NO-OP: Detection happens server-side via job queue
    console.log('[useAutomaticTransferDetection] Client-side detection disabled (Phase 2)');
    return { success: true, matchedCount: 0 };
  }, []);

  return { detectNewTransactions, scanAllPendingTransactions };
}
