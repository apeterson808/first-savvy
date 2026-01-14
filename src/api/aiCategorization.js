import { firstsavvy } from './firstsavvyClient';
import transactionRulesApi from './transactionRules';

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
   * Learn from user's manual categorization
   * Creates a rule if we detect a pattern worth learning
   */
  async learnFromCategorization(transaction, categoryId, profileId, userId) {
    // Skip transfers
    if (transaction.type === 'transfer') {
      return null;
    }

    // Check if there are similar transactions already categorized
    const similarTransactions = await this.findSimilarTransactions(
      transaction.description,
      profileId
    );

    // If we find 2+ similar transactions with the same category, create a rule
    const categorizedSimilar = similarTransactions.filter(
      t => t.category_account_id === categoryId
    );

    if (categorizedSimilar.length >= 2) {
      // Extract a pattern from the description
      const pattern = this.extractPattern(transaction.description);

      if (pattern) {
        // Check if rule already exists
        const existingRules = await transactionRulesApi.getCategorizationRules(profileId);
        const ruleExists = existingRules.some(
          rule => rule.match_value.toLowerCase() === pattern.toLowerCase() &&
                  rule.category_account_id === categoryId
        );

        if (!ruleExists) {
          // Create a new rule
          try {
            const rule = await transactionRulesApi.createCategorizationRule({
              user_id: userId,
              profile_id: profileId,
              name: `Auto-learned: ${pattern}`,
              match_type: 'contains',
              match_value: pattern,
              category_account_id: categoryId,
              transaction_type: transaction.type || 'all',
              priority: 100, // Lower priority than user-created rules
              is_active: true,
              apply_to_existing: false
            });

            return {
              ruleCreated: true,
              rule
            };
          } catch (error) {
            console.error('Failed to create auto-learned rule:', error);
          }
        }
      }
    }

    return null;
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
  },

  /**
   * Check if a transaction matches existing learned patterns
   */
  async checkLearnedPatterns(transaction, profileId) {
    try {
      const rules = await transactionRulesApi.getActiveCategorizationRules(profileId);

      for (const rule of rules) {
        if (transactionRulesApi.matchDescription(
          transaction.description,
          rule.match_type,
          rule.match_value
        )) {
          // Check if this is compatible with transaction type
          if (rule.transaction_type === 'all' || rule.transaction_type === transaction.type) {
            return {
              categoryId: rule.category_account_id,
              ruleName: rule.name
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to check learned patterns:', error);
      return null;
    }
  }
};

export default aiCategorizationApi;
