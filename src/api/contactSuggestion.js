import { firstsavvy } from './firstsavvyClient';

export const contactSuggestionAPI = {
  async getSuggestionsForTransactions(transactions, contacts) {
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

    for (const transaction of transactionsNeedingSuggestions) {
      try {
        const result = await firstsavvy.rpc.aiSuggestContact({
          description: transaction.description,
          contacts: contacts.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type
          }))
        });

        if (result.contactId) {
          suggestions[transaction.id] = result.contactId;
        }
      } catch (error) {
        console.error(`Failed to get contact suggestion for transaction ${transaction.id}:`, error);
      }
    }

    return suggestions;
  }
};
