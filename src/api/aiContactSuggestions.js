import { supabase } from './supabaseClient';

export async function saveAiContactSuggestions(suggestions, profileId) {
  try {
    const suggestionsWithProfile = suggestions.map(s => ({
      ...s,
      profile_id: profileId
    }));

    const { data, error } = await supabase
      .from('ai_contact_suggestions')
      .upsert(suggestionsWithProfile, {
        onConflict: 'transaction_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error saving AI contact suggestions:', error);
    return { data: null, error };
  }
}

export async function getAiContactSuggestionsForTransactions(transactionIds, profileId) {
  try {
    const { data, error } = await supabase
      .from('ai_contact_suggestions')
      .select('*')
      .eq('profile_id', profileId)
      .in('transaction_id', transactionIds);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching AI contact suggestions:', error);
    return { data: null, error };
  }
}

export async function deleteAiContactSuggestion(transactionId, profileId) {
  try {
    const { error } = await supabase
      .from('ai_contact_suggestions')
      .delete()
      .eq('transaction_id', transactionId)
      .eq('profile_id', profileId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting AI contact suggestion:', error);
    return { error };
  }
}

export async function deleteAiContactSuggestionsForTransactions(transactionIds, profileId) {
  try {
    const { error } = await supabase
      .from('ai_contact_suggestions')
      .delete()
      .eq('profile_id', profileId)
      .in('transaction_id', transactionIds);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting AI contact suggestions:', error);
    return { error };
  }
}

export async function getAiContactSuggestion(transactionId, profileId) {
  try {
    const { data, error } = await supabase
      .from('ai_contact_suggestions')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching AI contact suggestion:', error);
    return { data: null, error };
  }
}
