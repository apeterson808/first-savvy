import { useEffect, useRef } from 'react';
import { creditCardPaymentDetectionAPI } from '@/api/creditCardPaymentDetection';

export function useAutomaticCreditCardPaymentDetection(profileId, postedTransactions = []) {
  const lastDetectionRef = useRef(new Date(0));
  const scannedTransactionIdsRef = useRef(new Set());
  const detectionInProgressRef = useRef(false);
  const DETECTION_COOLDOWN_MS = 2000;

  const detectNewPayments = async (transactionIds = null) => {
    if (!profileId) {
      console.log('[CC Payment Detection] Skipped - no profile ID');
      return;
    }

    const now = new Date();
    if (now - lastDetectionRef.current < DETECTION_COOLDOWN_MS) {
      console.log('[CC Payment Detection] Skipped - cooldown active');
      return;
    }

    if (detectionInProgressRef.current) {
      console.log('[CC Payment Detection] Skipped - detection in progress');
      return;
    }

    try {
      detectionInProgressRef.current = true;
      lastDetectionRef.current = now;

      console.log(`[CC Payment Detection] Running detection for profile ${profileId}`, {
        transactionIds: transactionIds?.length || 'all',
        transactionCount: transactionIds?.length
      });

      const { data, error } = await creditCardPaymentDetectionAPI.detectPayments(
        profileId,
        transactionIds
      );

      if (error) {
        console.error('[CC Payment Detection] Error:', error);
        return;
      }

      if (data) {
        const matchedCount = data[0]?.matched_count || 0;
        const totalConfidence = data[0]?.total_confidence || 0;
        const avgConfidence = matchedCount > 0 ? (totalConfidence / matchedCount).toFixed(1) : 0;

        if (matchedCount > 0) {
          console.log(`[CC Payment Detection] ✓ Found ${matchedCount} payment pair(s) (avg confidence: ${avgConfidence}%)`);
        } else {
          console.log('[CC Payment Detection] No matches found');
        }
      }
    } catch (error) {
      console.error('[CC Payment Detection] Exception:', error);
    } finally {
      detectionInProgressRef.current = false;
    }
  };

  useEffect(() => {
    if (!profileId || !postedTransactions || postedTransactions.length === 0) {
      return;
    }

    const newTransactionIds = postedTransactions
      .filter(t =>
        !scannedTransactionIdsRef.current.has(t.id) &&
        !t.cc_payment_pair_id &&
        !t.transfer_pair_id
      )
      .map(t => t.id);

    if (newTransactionIds.length > 0) {
      console.log(`[CC Payment Detection] Found ${newTransactionIds.length} new transactions to scan`);
      newTransactionIds.forEach(id => scannedTransactionIdsRef.current.add(id));
      detectNewPayments(newTransactionIds);
    }
  }, [profileId, postedTransactions]);

  return { detectNewPayments };
}
