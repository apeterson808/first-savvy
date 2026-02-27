import { useState, useCallback } from 'react';
import { matchingAPI } from '@/api/matchingAPI';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function useUnifiedMatching(profileId, userId) {
  const queryClient = useQueryClient();
  const [selectedMatches, setSelectedMatches] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  const isPaired = useCallback((transaction) => {
    return transaction && transaction.paired_transaction_id != null;
  }, []);

  const findPair = useCallback((transaction, allTransactions) => {
    if (!transaction?.paired_transaction_id) return null;
    return allTransactions.find(t => t.id === transaction.paired_transaction_id);
  }, []);

  const getSuggestedMatches = useCallback(async (transactionId) => {
    if (!profileId) return { data: [], error: null };

    const { data, error } = await matchingAPI.getSuggestedMatches(transactionId, profileId);
    return { data: data || [], error };
  }, [profileId]);

  const linkMatches = useCallback(async (txnId1, txnId2, matchType) => {
    if (!profileId || !userId) {
      toast.error('Missing profile or user information');
      return { success: false };
    }

    setIsProcessing(true);
    try {
      const { error } = await matchingAPI.linkManual(txnId1, txnId2, matchType, profileId, userId);

      if (error) {
        toast.error(error.message || 'Failed to link transactions');
        return { success: false, error };
      }

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      toast.success(`${matchType === 'transfer' ? 'Transfer' : 'Payment'} linked successfully`);
      return { success: true };
    } catch (err) {
      console.error('Error linking transactions:', err);
      toast.error('Failed to link transactions');
      return { success: false, error: err };
    } finally {
      setIsProcessing(false);
    }
  }, [profileId, userId, queryClient]);

  const unmatch = useCallback(async (transactionId) => {
    if (!profileId) {
      toast.error('Missing profile information');
      return { success: false };
    }

    setIsProcessing(true);
    try {
      const { error } = await matchingAPI.unmatch(transactionId, profileId);

      if (error) {
        toast.error(error.message || 'Failed to unmatch transactions');
        return { success: false, error };
      }

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      toast.success('Transactions unmatched');
      return { success: true };
    } catch (err) {
      console.error('Error unmatching transactions:', err);
      toast.error('Failed to unmatch transactions');
      return { success: false, error: err };
    } finally {
      setIsProcessing(false);
    }
  }, [profileId, queryClient]);

  const acceptMatch = useCallback(async (transactionId) => {
    if (!profileId) {
      toast.error('Missing profile information');
      return { success: false };
    }

    setIsProcessing(true);
    try {
      const { error } = await matchingAPI.acceptMatch(transactionId, profileId);

      if (error) {
        toast.error(error.message || 'Failed to accept match');
        return { success: false, error };
      }

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      toast.success('Match accepted');
      return { success: true };
    } catch (err) {
      console.error('Error accepting match:', err);
      toast.error('Failed to accept match');
      return { success: false, error: err };
    } finally {
      setIsProcessing(false);
    }
  }, [profileId, queryClient]);

  const rejectMatch = useCallback(async (transactionId) => {
    if (!profileId || !userId) {
      toast.error('Missing profile or user information');
      return { success: false };
    }

    setIsProcessing(true);
    try {
      const { error } = await matchingAPI.rejectMatch(transactionId, profileId, userId);

      if (error) {
        toast.error(error.message || 'Failed to reject match');
        return { success: false, error };
      }

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      toast.success('Match rejected');
      return { success: true };
    } catch (err) {
      console.error('Error rejecting match:', err);
      toast.error('Failed to reject match');
      return { success: false, error: err };
    } finally {
      setIsProcessing(false);
    }
  }, [profileId, userId, queryClient]);

  const detectMatches = useCallback(async (transactionIds = null) => {
    return { success: false };
  }, []);

  const determineMatchType = useCallback((transaction, match, accounts) => {
    const transAccount = accounts.find(a => a.id === transaction.bank_account_id);
    const matchAccount = accounts.find(a => a.id === match.bank_account_id);

    if (transAccount?.account_detail === 'CreditCard' || matchAccount?.account_detail === 'CreditCard') {
      return 'credit_card_payment';
    }

    return 'transfer';
  }, []);

  return {
    isPaired,
    findPair,
    getSuggestedMatches,
    linkMatches,
    unmatch,
    acceptMatch,
    rejectMatch,
    detectMatches,
    determineMatchType,
    selectedMatches,
    setSelectedMatches,
    isProcessing
  };
}
