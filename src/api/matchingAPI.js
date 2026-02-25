import { supabase } from './supabaseClient';

export const matchingAPI = {
  async detectMatches(profileId, transactionIds = null) {
    const { data, error } = await supabase.rpc('auto_detect_matches_unified', {
      p_profile_id: profileId,
      p_transaction_ids: transactionIds
    });
    return { data, error };
  },

  async getUnreviewedMatches(profileId, matchType = null) {
    let query = supabase
      .from('transactions')
      .select('*, account:bank_account_id(*)')
      .eq('profile_id', profileId)
      .eq('status', 'pending')
      .eq('match_auto_detected', true)
      .eq('match_reviewed', false)
      .not('paired_transaction_id', 'is', null)
      .order('date', { ascending: false });

    if (matchType) {
      query = query.eq('match_type', matchType);
    }

    const { data, error } = await query;

    const matchPairs = [];
    const processedIds = new Set();

    data?.forEach(transaction => {
      if (processedIds.has(transaction.id)) return;

      const matchingTransaction = data.find(
        t => t.paired_transaction_id === transaction.id && t.id !== transaction.id
      );

      if (matchingTransaction) {
        matchPairs.push({
          transaction1: transaction,
          transaction2: matchingTransaction,
          match_type: transaction.match_type,
          confidence: transaction.match_confidence
        });
        processedIds.add(transaction.id);
        processedIds.add(matchingTransaction.id);
      }
    });

    return { data: matchPairs, error };
  },

  async acceptMatch(transactionId, profileId) {
    const { data: transaction } = await supabase
      .from('transactions')
      .select('paired_transaction_id')
      .eq('id', transactionId)
      .eq('profile_id', profileId)
      .single();

    if (!transaction?.paired_transaction_id) {
      return { error: { message: 'Transaction is not paired' } };
    }

    const { error } = await supabase
      .from('transactions')
      .update({ match_reviewed: true })
      .in('id', [transactionId, transaction.paired_transaction_id])
      .eq('profile_id', profileId);

    return { error };
  },

  async rejectMatch(transactionId, profileId, userId) {
    const { error } = await supabase.rpc('reject_match_unified', {
      p_profile_id: profileId,
      p_transaction_id: transactionId,
      p_user_id: userId
    });
    return { error };
  },

  async linkManual(transactionId1, transactionId2, matchType, profileId, userId) {
    const { error } = await supabase.rpc('link_match_unified', {
      p_profile_id: profileId,
      p_transaction_id_1: transactionId1,
      p_transaction_id_2: transactionId2,
      p_match_type: matchType,
      p_user_id: userId
    });
    return { error };
  },

  async unmatch(transactionId, profileId) {
    const { data: transaction } = await supabase
      .from('transactions')
      .select('paired_transaction_id')
      .eq('id', transactionId)
      .eq('profile_id', profileId)
      .single();

    if (!transaction?.paired_transaction_id) {
      return { error: { message: 'Transaction is not paired' } };
    }

    const { error } = await supabase
      .from('transactions')
      .update({
        paired_transaction_id: null,
        match_type: null,
        type: null,
        match_confidence: null,
        match_auto_detected: false,
        match_reviewed: false
      })
      .in('id', [transactionId, transaction.paired_transaction_id])
      .eq('profile_id', profileId);

    return { error };
  },

  async getSuggestedMatches(transactionId, profileId) {
    const { data: transaction, error: txnError } = await supabase
      .from('transactions')
      .select('*, account:bank_account_id(*)')
      .eq('id', transactionId)
      .eq('profile_id', profileId)
      .single();

    if (txnError || !transaction) {
      return { data: [], error: txnError };
    }

    const daysDiff = 3;
    const dateFrom = new Date(transaction.date);
    dateFrom.setDate(dateFrom.getDate() - daysDiff);
    const dateTo = new Date(transaction.date);
    dateTo.setDate(dateTo.getDate() + daysDiff);

    const { data: candidates, error } = await supabase
      .from('transactions')
      .select('*, account:bank_account_id(*)')
      .eq('profile_id', profileId)
      .eq('status', 'pending')
      .is('paired_transaction_id', null)
      .neq('id', transactionId)
      .neq('bank_account_id', transaction.bank_account_id)
      .gte('date', dateFrom.toISOString().split('T')[0])
      .lte('date', dateTo.toISOString().split('T')[0]);

    if (error) return { data: [], error };

    const matches = candidates
      .filter(c => {
        const amountMatch = Math.abs(Math.abs(c.amount) - Math.abs(transaction.amount)) < 0.01;
        const oppositeSign = (c.amount > 0) !== (transaction.amount > 0);
        return amountMatch && oppositeSign;
      })
      .map(c => {
        const tDate = new Date(transaction.date);
        const cDate = new Date(c.date);
        const daysDiff = Math.abs((tDate - cDate) / (1000 * 60 * 60 * 24));

        let confidence = 50;
        if (daysDiff === 0) confidence = 95;
        else if (daysDiff === 1) confidence = 90;
        else if (daysDiff === 2) confidence = 85;
        else if (daysDiff === 3) confidence = 80;

        let matchType = 'transfer';
        if (c.account?.account_detail === 'CreditCard' || transaction.account?.account_detail === 'CreditCard') {
          matchType = 'credit_card_payment';
        }

        return {
          ...c,
          confidence,
          match_type: matchType
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    return { data: matches, error: null };
  },

  async getMatchHistory(profileId, limit = 100) {
    const { data, error } = await supabase
      .from('transaction_match_history')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data, error };
  }
};
