import { firstsavvy } from './firstsavvyClient';
import { saveAiContactSuggestions } from './aiContactSuggestions';

export const contactSuggestionAPI = {
  async getSuggestionsForTransactions(transactions, contacts, profileId = null) {
    if (!transactions?.length || !contacts?.length) {
      return {};
    }

    const transactionsNeedingSuggestions = transactions.filter(
      t => !t.contact_id && t.description && t.type !== 'transfer'
    );

    if (transactionsNeedingSuggestions.length === 0) {
      return {};
    }

    const suggestions = {};
    const suggestionsToSave = [];

    for (const transaction of transactionsNeedingSuggestions) {
      try {
        const result = await firstsavvy.functions.aiSuggestContact({
          description: transaction.description,
          contacts: contacts.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type
          }))
        });

        if (result.contactId) {
          suggestions[transaction.id] = result.contactId;

          // Prepare to save to database if profileId is provided
          if (profileId) {
            suggestionsToSave.push({
              transaction_id: transaction.id,
              suggested_contact_id: result.contactId,
              confidence_score: result.confidence || 0.8,
              profile_id: profileId
            });
          }
        }
      } catch (error) {
        console.error(`Failed to get contact suggestion for transaction ${transaction.id}:`, error);
      }
    }

    // Save all suggestions to database
    if (suggestionsToSave.length > 0 && profileId) {
      await saveAiContactSuggestions(suggestionsToSave, profileId);
    }

    return suggestions;
  }
};
