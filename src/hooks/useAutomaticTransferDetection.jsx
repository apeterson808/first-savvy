import { useEffect, useRef, useCallback } from 'react';
import { transferAutoDetectionAPI } from '../api/transferAutoDetection';

export function useAutomaticTransferDetection(profileId, pendingTransactions = []) {
  const lastDetectionRef = useRef(new Date(0));
  const scannedTransactionIdsRef = useRef(new Set());
  const detectionInProgressRef = useRef(false);
  const DETECTION_COOLDOWN_MS = 2000;

  const runDetection = useCallback(async (transactionIds = []) => {
    if (!profileId || detectionInProgressRef.current) {
      return;
    }

    const now = Date.now();
    const timeSinceLastDetection = now - lastDetectionRef.current.getTime();

    if (timeSinceLastDetection < DETECTION_COOLDOWN_MS) {
      return;
    }

    const idsToScan = transactionIds.length > 0
      ? transactionIds.filter(id => !scannedTransactionIdsRef.current.has(id))
      : [];

    if (idsToScan.length === 0 && transactionIds.length > 0) {
      return;
    }

    try {
      detectionInProgressRef.current = true;
      lastDetectionRef.current = new Date();

      const idsForDetection = idsToScan.length > 0 ? idsToScan : undefined;

      await transferAutoDetectionAPI.detectTransfers(profileId, idsForDetection);

      if (idsToScan.length > 0) {
        idsToScan.forEach(id => scannedTransactionIdsRef.current.add(id));
      }
    } catch (error) {
      console.warn('Automatic transfer detection failed:', error);
    } finally {
      detectionInProgressRef.current = false;
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileId || !pendingTransactions || pendingTransactions.length === 0) {
      return;
    }

    const unscannedTransactions = pendingTransactions.filter(
      tx => tx.id && !scannedTransactionIdsRef.current.has(tx.id)
    );

    if (unscannedTransactions.length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const transactionIds = unscannedTransactions.map(tx => tx.id);
      runDetection(transactionIds);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [profileId, pendingTransactions, runDetection]);

  const detectNewTransactions = useCallback((newTransactionIds) => {
    if (!newTransactionIds || newTransactionIds.length === 0) {
      return;
    }

    setTimeout(() => {
      runDetection(newTransactionIds);
    }, 300);
  }, [runDetection]);

  return { detectNewTransactions };
}
