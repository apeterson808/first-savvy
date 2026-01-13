import { supabase } from './supabaseClient';

export const transferAutoDetectionAPI = {
  async detectTransfers(profileId, transactionIds = null) {
    try {
      const { data, error } = await supabase.rpc('auto_detect_transfers', {
        p_profile_id: profileId,
        p_transaction_ids: transactionIds
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error detecting transfers:', error);
      return { data: null, error };
    }
  },

  async getUnreviewedTransfers(profileId) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          account:bank_account_id (
            id,
            display_name,
            account_number
          )
        `)
        .eq('profile_id', profileId)
        .eq('status', 'pending')
        .eq('transfer_auto_detected', true)
        .eq('transfer_reviewed', false)
        .not('transfer_pair_id', 'is', null)
        .order('date', { ascending: false });

      if (error) throw error;

      const transferPairs = [];
      const processedIds = new Set();

      data?.forEach(transaction => {
        if (processedIds.has(transaction.id)) return;

        const matchingTransaction = data.find(
          t => t.transfer_pair_id === transaction.transfer_pair_id &&
               t.id !== transaction.id
        );

        if (matchingTransaction) {
          const sourceTransaction = transaction.amount < 0 ? transaction : matchingTransaction;
          const destTransaction = transaction.amount > 0 ? transaction : matchingTransaction;

          transferPairs.push({
            id: transaction.transfer_pair_id,
            source: sourceTransaction,
            destination: destTransaction,
            confidence: transaction.transfer_match_confidence,
            date: transaction.date
          });

          processedIds.add(transaction.id);
          processedIds.add(matchingTransaction.id);
        }
      });

      return { data: transferPairs, error: null };
    } catch (error) {
      console.error('Error fetching unreviewed transfers:', error);
      return { data: null, error };
    }
  },

  async acceptTransfer(transferPairId) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          transfer_reviewed: true,
          type: 'transfer'
        })
        .eq('transfer_pair_id', transferPairId);

      if (error) throw error;

      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('profile_id, bank_account_id, transfer_pattern_id')
        .eq('transfer_pair_id', transferPairId)
        .limit(2);

      if (!fetchError && transactions?.length === 2) {
        const patternId = transactions[0].transfer_pattern_id;
        if (patternId) {
          await supabase.rpc('increment_pattern_acceptance', {
            p_pattern_id: patternId
          }).catch(err => console.warn('Pattern update failed:', err));
        }
      }

      return { error: null };
    } catch (error) {
      console.error('Error accepting transfer:', error);
      return { error };
    }
  },

  async rejectTransfer(transferPairId) {
    try {
      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('profile_id, bank_account_id, transfer_pattern_id')
        .eq('transfer_pair_id', transferPairId)
        .limit(2);

      if (fetchError) throw fetchError;

      const patternId = transactions?.[0]?.transfer_pattern_id;

      const { error } = await supabase
        .from('transactions')
        .update({
          transfer_pair_id: null,
          type: null,
          transfer_match_confidence: null,
          transfer_auto_detected: false,
          transfer_reviewed: false,
          transfer_pattern_id: null
        })
        .eq('transfer_pair_id', transferPairId);

      if (error) throw error;

      if (patternId) {
        await supabase.rpc('increment_pattern_rejection', {
          p_pattern_id: patternId
        }).catch(err => console.warn('Pattern update failed:', err));
      }

      return { error: null };
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      return { error };
    }
  },

  async acceptAllTransfers(profileId) {
    try {
      const { data: unreviewedTransfers, error: fetchError } = await supabase
        .from('transactions')
        .select('transfer_pair_id')
        .eq('profile_id', profileId)
        .eq('status', 'pending')
        .eq('transfer_auto_detected', true)
        .eq('transfer_reviewed', false)
        .not('transfer_pair_id', 'is', null);

      if (fetchError) throw fetchError;

      const uniquePairIds = [...new Set(unreviewedTransfers?.map(t => t.transfer_pair_id) || [])];

      for (const pairId of uniquePairIds) {
        await this.acceptTransfer(pairId);
      }

      return { error: null, count: uniquePairIds.length };
    } catch (error) {
      console.error('Error accepting all transfers:', error);
      return { error, count: 0 };
    }
  },

  async unmatchTransfer(transferPairId) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          transfer_pair_id: null,
          type: null,
          transfer_match_confidence: null,
          transfer_auto_detected: false,
          transfer_reviewed: false,
          transfer_pattern_id: null
        })
        .eq('transfer_pair_id', transferPairId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error unmatching transfer:', error);
      return { error };
    }
  },

  async linkTransferPair(transactionId1, transactionId2, profileId) {
    try {
      const { data, error } = await supabase.rpc('link_transfer_pair', {
        p_transaction_id_1: transactionId1,
        p_transaction_id_2: transactionId2,
        p_profile_id: profileId
      });

      if (error) throw error;

      if (data && !data.success) {
        return { data: null, error: new Error(data.error) };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error linking transfer pair:', error);
      return { data: null, error };
    }
  },

  async unlinkTransferPair(transactionId, profileId) {
    try {
      const { data, error } = await supabase.rpc('unlink_transfer_pair', {
        p_transaction_id: transactionId,
        p_profile_id: profileId
      });

      if (error) throw error;

      if (data && !data.success) {
        return { data: null, error: new Error(data.error) };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error unlinking transfer pair:', error);
      return { data: null, error };
    }
  }
};
