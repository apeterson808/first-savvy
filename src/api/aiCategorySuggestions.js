import { supabase } from './supabaseClient';

export async function saveAiCategorySuggestions(suggestions, profileId) {
  try {
    const suggestionsWithProfile = suggestions.map(s => ({
      ...s,
      profile_id: profileId
    }));

    const { data, error } = await supabase
      .from('ai_category_suggestions')
      .upsert(suggestionsWithProfile, {
        onConflict: 'transaction_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error saving AI category suggestions:', error);
    return { data: null, error };
  }
}

export async function getAiCategorySuggestionsForTransactions(transactionIds, profileId) {
  try {
    const { data, error } = await supabase
      .from('ai_category_suggestions')
      .select('*')
      .eq('profile_id', profileId)
      .in('transaction_id', transactionIds);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching AI category suggestions:', error);
    return { data: null, error };
  }
}

export async function deleteAiCategorySuggestion(transactionId, profileId) {
  try {
    const { error } = await supabase
      .from('ai_category_suggestions')
      .delete()
      .eq('transaction_id', transactionId)
      .eq('profile_id', profileId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting AI category suggestion:', error);
    return { error };
  }
}

export async function deleteAiCategorySuggestionsForTransactions(transactionIds, profileId) {
  try {
    const { error } = await supabase
      .from('ai_category_suggestions')
      .delete()
      .eq('profile_id', profileId)
      .in('transaction_id', transactionIds);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting AI category suggestions:', error);
    return { error };
  }
}

export async function getAiCategorySuggestion(transactionId, profileId) {
  try {
    const { data, error } = await supabase
      .from('ai_category_suggestions')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching AI category suggestion:', error);
    return { data: null, error };
  }
}
