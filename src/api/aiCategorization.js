import { firstsavvy } from './firstsavvyClient';

export const aiCategorizationApi = {
  /**
   * Get AI suggestion for a single transaction
   */
  async getSuggestion(transaction) {
    try {
      const result = await firstsavvy.functions.aiCategorizeTransaction({
        description: transaction.description,
        amount: transaction.amount,
        profileId: transaction.profile_id
      });

      if (result.chartAccountId) {
        return {
          categoryId: result.chartAccountId,
          confidence: result.confidence,
          accountNumber: result.accountNumber
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get AI suggestion:', error);
      return null;
    }
  },

  /**
   * Get AI suggestions for multiple transactions
   */
  async getSuggestionsForTransactions(transactions) {
    const suggestions = {};

    // Only get suggestions for uncategorized transactions
    const uncategorizedTransactions = transactions.filter(
      txn => !txn.category_account_id && txn.type !== 'transfer'
    );

    // Get suggestions in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < uncategorizedTransactions.length; i += batchSize) {
      const batch = uncategorizedTransactions.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (txn) => {
          const suggestion = await this.getSuggestion(txn);
          if (suggestion) {
            suggestions[txn.id] = suggestion.categoryId;
          }
        })
      );
    }

    return suggestions;
  },

  /**
   * Find similar transactions based on description
   */
  async findSimilarTransactions(description, profileId) {
    try {
      const allTransactions = await firstsavvy.entities.Transaction.filter(
        { profile_id: profileId },
        '-date',
        1000
      );

      const pattern = this.extractPattern(description);
      if (!pattern) return [];

      return allTransactions.filter(txn =>
        txn.description.toLowerCase().includes(pattern.toLowerCase()) &&
        txn.category_account_id
      );
    } catch (error) {
      console.error('Failed to find similar transactions:', error);
      return [];
    }
  },

  /**
   * Extract a meaningful pattern from a transaction description
   */
  extractPattern(description) {
    if (!description) return null;

    // Remove common noise words and patterns
    let cleaned = description
      .toLowerCase()
      .replace(/\d+/g, '') // Remove numbers
      .replace(/[#*]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    // Split into words and take the most significant ones
    const words = cleaned.split(' ').filter(word =>
      word.length > 3 &&
      !['the', 'and', 'for', 'with', 'from', 'payment', 'purchase'].includes(word)
    );

    // Return the first significant word or first 2 words
    if (words.length === 0) return null;
    if (words.length === 1) return words[0];

    // For multiple words, try to find a brand/merchant name
    // Usually it's at the beginning of the description
    const firstWords = words.slice(0, 2).join(' ');
    return firstWords;
  }
};

export default aiCategorizationApi;
