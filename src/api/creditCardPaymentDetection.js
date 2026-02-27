import { supabase } from './supabaseClient';

export const creditCardPaymentDetectionAPI = {
  async detectPayments(profileId, transactionIds = null) {
    try {
      const { data, error } = await supabase.rpc('auto_detect_credit_card_payments_optimized', {
        p_profile_id: profileId,
        p_transaction_ids: transactionIds
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error detecting credit card payments:', error);
      return { data: null, error };
    }
  },

  async getUnreviewedPayments(profileId) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          account:bank_account_id (
            id,
            display_name,
            account_number,
            type,
            class
          )
        `)
        .eq('profile_id', profileId)
        .eq('status', 'pending')
        .eq('cc_payment_auto_detected', true)
        .eq('cc_payment_reviewed', false)
        .not('cc_payment_pair_id', 'is', null)
        .order('date', { ascending: false });

      if (error) throw error;

      const paymentPairs = [];
      const processedIds = new Set();

      data?.forEach(transaction => {
        if (processedIds.has(transaction.id)) return;

        const matchingTransaction = data.find(
          t => t.cc_payment_pair_id === transaction.cc_payment_pair_id &&
               t.id !== transaction.id
        );

        if (matchingTransaction) {
          const bankTransaction = transaction.amount < 0 ? transaction : matchingTransaction;
          const ccTransaction = transaction.amount > 0 ? transaction : matchingTransaction;

          paymentPairs.push({
            id: transaction.cc_payment_pair_id,
            bankTransaction,
            creditCardTransaction: ccTransaction,
            confidence: transaction.cc_payment_match_confidence,
            date: transaction.date
          });

          processedIds.add(transaction.id);
          processedIds.add(matchingTransaction.id);
        }
      });

      return { data: paymentPairs, error: null };
    } catch (error) {
      console.error('Error fetching unreviewed payments:', error);
      return { data: null, error };
    }
  },

  async acceptPayment(ccPaymentPairId) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          cc_payment_reviewed: true,
          type: 'credit_card_payment'
        })
        .eq('cc_payment_pair_id', ccPaymentPairId);

      if (error) throw error;

      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('profile_id, bank_account_id, cc_payment_pattern_id')
        .eq('cc_payment_pair_id', ccPaymentPairId)
        .limit(2);

      if (!fetchError && transactions?.length === 2) {
        const patternId = transactions[0].cc_payment_pattern_id;
        if (patternId) {
          await supabase.rpc('increment_cc_payment_pattern_acceptance', {
            p_pattern_id: patternId
          }).catch(() => {
            // Silently fail if pattern update fails
          });
        }
      }

      return { error: null };
    } catch (error) {
      console.error('Error accepting credit card payment:', error);
      return { error };
    }
  },

  async rejectPayment(ccPaymentPairId) {
    try {
      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('profile_id, bank_account_id, cc_payment_pattern_id')
        .eq('cc_payment_pair_id', ccPaymentPairId)
        .limit(2);

      if (fetchError) throw fetchError;

      const patternId = transactions?.[0]?.cc_payment_pattern_id;

      const { error } = await supabase
        .from('transactions')
        .update({
          cc_payment_pair_id: null,
          type: null,
          cc_payment_match_confidence: null,
          cc_payment_auto_detected: false,
          cc_payment_reviewed: false,
          cc_payment_pattern_id: null
        })
        .eq('cc_payment_pair_id', ccPaymentPairId);

      if (error) throw error;

      if (patternId) {
        await supabase.rpc('increment_cc_payment_pattern_rejection', {
          p_pattern_id: patternId
        }).catch(() => {
          // Silently fail if pattern update fails
        });
      }

      return { error: null };
    } catch (error) {
      console.error('Error rejecting credit card payment:', error);
      return { error };
    }
  },

  async acceptAllPayments(profileId) {
    try {
      const { data: unreviewedPayments, error: fetchError } = await supabase
        .from('transactions')
        .select('cc_payment_pair_id')
        .eq('profile_id', profileId)
        .eq('status', 'pending')
        .eq('cc_payment_auto_detected', true)
        .eq('cc_payment_reviewed', false)
        .not('cc_payment_pair_id', 'is', null);

      if (fetchError) throw fetchError;

      const uniquePairIds = [...new Set(unreviewedPayments?.map(t => t.cc_payment_pair_id) || [])];

      for (const pairId of uniquePairIds) {
        await this.acceptPayment(pairId);
      }

      return { error: null, count: uniquePairIds.length };
    } catch (error) {
      console.error('Error accepting all credit card payments:', error);
      return { error, count: 0 };
    }
  },

  async unmatchPayment(ccPaymentPairId) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          cc_payment_pair_id: null,
          type: null,
          cc_payment_match_confidence: null,
          cc_payment_auto_detected: false,
          cc_payment_reviewed: false,
          cc_payment_pattern_id: null
        })
        .eq('cc_payment_pair_id', ccPaymentPairId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error unmatching credit card payment:', error);
      return { error };
    }
  },

  async linkPaymentPair(bankTransactionId, ccTransactionId, profileId) {
    try {
      const pairId = crypto.randomUUID();

      const { error } = await supabase
        .from('transactions')
        .update({
          cc_payment_pair_id: pairId,
          type: 'credit_card_payment',
          cc_payment_reviewed: true,
          cc_payment_auto_detected: false,
          cc_payment_match_confidence: 100
        })
        .in('id', [bankTransactionId, ccTransactionId])
        .eq('profile_id', profileId);

      if (error) throw error;
      return { data: { success: true, pair_id: pairId }, error: null };
    } catch (error) {
      console.error('Error linking payment pair:', error);
      return { data: null, error };
    }
  },

  async unlinkPaymentPair(transactionId, profileId) {
    try {
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('cc_payment_pair_id')
        .eq('id', transactionId)
        .eq('profile_id', profileId)
        .single();

      if (fetchError) throw fetchError;

      if (!transaction.cc_payment_pair_id) {
        return { data: { success: true }, error: null };
      }

      const { error } = await supabase
        .from('transactions')
        .update({
          cc_payment_pair_id: null,
          type: null,
          cc_payment_match_confidence: null,
          cc_payment_auto_detected: false,
          cc_payment_reviewed: false,
          cc_payment_pattern_id: null
        })
        .eq('cc_payment_pair_id', transaction.cc_payment_pair_id);

      if (error) throw error;
      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('Error unlinking payment pair:', error);
      return { data: null, error };
    }
  }
};
