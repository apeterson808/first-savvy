import { supabase } from './supabaseClient';

export async function getSuggestionsForTransaction(transaction, profileId) {
  if (!transaction || !profileId) {
    return null;
  }

  const categorySuggestion = await getCategorySuggestionByPattern(
    transaction.description,
    profileId
  );

  const contactSuggestion = await suggestContactFromDescription(
    transaction.description,
    profileId
  );

  return {
    categoryId: categorySuggestion?.categoryId || null,
    categoryName: categorySuggestion?.categoryName || null,
    usageCount: categorySuggestion?.usageCount || 0,
    confidence: categorySuggestion?.confidence || 0,
    lastUsedDate: categorySuggestion?.lastUsedDate || null,
    contactId: contactSuggestion?.contactId || null,
    contactName: contactSuggestion?.contactName || null,
  };
}

export async function getCategorySuggestionByPattern(description, profileId) {
  if (!description || !profileId) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc(
      'get_category_suggestion_by_pattern',
      {
        p_description: description,
        p_profile_id: profileId,
        p_similarity_threshold: 0.3,
      }
    );

    if (error) {
      console.error('Error getting category suggestion:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const suggestion = data[0];
    return {
      categoryId: suggestion.suggested_category_id,
      categoryName: suggestion.category_name,
      usageCount: suggestion.usage_count,
      confidence: suggestion.confidence,
      lastUsedDate: suggestion.last_used_date,
    };
  } catch (err) {
    console.error('Error in getCategorySuggestionByPattern:', err);
    return null;
  }
}

export async function suggestContactFromDescription(description, profileId) {
  if (!description || !profileId) {
    return null;
  }

  const patterns = [
    /(?:TO|FROM)\s+([A-Z][A-Z\s]+?)(?:\s+\d|$)/i,
    /^([A-Z][A-Z\s]+?)(?:\s+\d|$)/i,
    /([A-Z][A-Z\s]{2,})/,
  ];

  let potentialName = null;
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      potentialName = match[1].trim();
      if (potentialName.length >= 3) {
        break;
      }
    }
  }

  if (!potentialName) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('profile_id', profileId)
      .ilike('name', `%${potentialName}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error suggesting contact:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      contactId: data.id,
      contactName: data.name,
    };
  } catch (err) {
    console.error('Error in suggestContactFromDescription:', err);
    return null;
  }
}

export async function getBulkSuggestionsForTransactions(transactions, profileId) {
  if (!transactions || transactions.length === 0 || !profileId) {
    return {};
  }

  const suggestions = {};

  await Promise.all(
    transactions.map(async (transaction) => {
      const suggestion = await getSuggestionsForTransaction(transaction, profileId);
      if (suggestion && (suggestion.categoryId || suggestion.contactId)) {
        suggestions[transaction.id] = suggestion;
      }
    })
  );

  return suggestions;
}
