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
 * - UI reads cached results from cc_payment_pair_id field
 *
 * This hook can be deleted after Phase 2 is stable (2 weeks).
 */
export function useAutomaticCreditCardPaymentDetection(profileId, pendingTransactions = []) {
  // NO-OP: Detection happens server-side

  const detectNewPayments = useCallback(async (transactionIds = null) => {
    // NO-OP: Detection happens server-side via job queue
  }, []);

  const scanAllPendingTransactions = useCallback(async () => {
    // NO-OP: Detection happens server-side via job queue
    return { success: true, matchedCount: 0 };
  }, []);

  return { detectNewPayments, scanAllPendingTransactions };
}
