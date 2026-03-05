import { supabase } from './supabaseClient';
import { toast } from 'sonner';

export const findTransferMatches = async (transactionId, profileId) => {
  const { data, error } = await supabase.rpc('find_transfer_matches', {
    p_transaction_id: transactionId,
    p_profile_id: profileId
  });

  if (error) throw error;
  return data || [];
};

export const autoMatchTransfers = async (profileId, minConfidence = 90) => {
  const { data, error } = await supabase.rpc('auto_match_transfers', {
    p_profile_id: profileId,
    p_min_confidence: minConfidence
  });

  if (error) throw error;
  return data?.[0] || { matched_count: 0, suggestion_count: 0 };
};

export const applyTransferMatch = async (suggestionId, profileId) => {
  const { data, error } = await supabase.rpc('apply_transfer_match', {
    p_suggestion_id: suggestionId,
    p_profile_id: profileId
  });

  if (error) throw error;
  return data;
};

export const getTransferSuggestions = async (profileId, status = 'pending') => {
  let query = supabase
    .from('transfer_match_suggestions')
    .select(`
      *,
      transaction_1:transactions!transaction_1_id(
        id,
        date,
        description,
        amount,
        bank_account_id,
        bank_account:user_chart_of_accounts!bank_account_id(display_name)
      ),
      transaction_2:transactions!transaction_2_id(
        id,
        date,
        description,
        amount,
        bank_account_id,
        bank_account:user_chart_of_accounts!bank_account_id(display_name)
      )
    `)
    .eq('profile_id', profileId)
    .order('confidence_score', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};

export const rejectTransferSuggestion = async (suggestionId) => {
  const { error } = await supabase
    .from('transfer_match_suggestions')
    .update({ status: 'rejected' })
    .eq('id', suggestionId);

  if (error) throw error;
};

export const runAutoMatchForProfile = async (profileId) => {
  const result = await autoMatchTransfers(profileId, 90);
  return result;
};

export const refreshMatches = async (profileId) => {
  const result = await autoMatchTransfers(profileId, 90);

  if (result.matched_count > 0) {
    toast.success(`Automatically matched ${result.matched_count} transfer pair${result.matched_count > 1 ? 's' : ''}`);
  }

  if (result.suggestion_count > 0) {
    toast.info(`Found ${result.suggestion_count} potential match${result.suggestion_count > 1 ? 'es' : ''} for manual review`);
  }

  if (result.matched_count === 0 && result.suggestion_count === 0) {
    toast.info('No new transfer matches found');
  }

  return result;
};
