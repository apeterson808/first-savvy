import { useEffect, useRef } from 'react';
import { creditCardPaymentDetectionAPI } from '@/api/creditCardPaymentDetection';

export function useAutomaticCreditCardPaymentDetection(profileId, postedTransactions = []) {
  const lastDetectionRef = useRef(new Date(0));
  const scannedTransactionIdsRef = useRef(new Set());
  const detectionInProgressRef = useRef(false);
  const DETECTION_COOLDOWN_MS = 2000;

  const detectNewPayments = async (transactionIds = null) => {
    if (!profileId) return;

    const now = new Date();
    if (now - lastDetectionRef.current < DETECTION_COOLDOWN_MS) {
      return;
    }

    if (detectionInProgressRef.current) {
      return;
    }

    try {
      detectionInProgressRef.current = true;
      lastDetectionRef.current = now;

      const { data, error } = await creditCardPaymentDetectionAPI.detectPayments(
        profileId,
        transactionIds
      );

      if (error) {
        console.error('Error detecting credit card payments:', error);
        return;
      }

      if (data) {
        const matchedCount = data[0]?.matched_count || 0;
        if (matchedCount > 0) {
          console.log(`Detected ${matchedCount} credit card payment pairs`);
        }
      }
    } catch (error) {
      console.error('Error in credit card payment detection:', error);
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
      newTransactionIds.forEach(id => scannedTransactionIdsRef.current.add(id));
      detectNewPayments(newTransactionIds);
    }
  }, [profileId, postedTransactions]);

  return { detectNewPayments };
}
