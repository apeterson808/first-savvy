import { supabase } from './supabaseClient';

export const categorizationMemoryAPI = {
  /**
   * Generate a transaction fingerprint for matching
   */
  generateFingerprint(date, originalDescription, amount, bankAccountId) {
    return `${date}|${originalDescription.toLowerCase().trim()}|${amount}|${bankAccountId || 'null'}`;
  },

  /**
   * Store a categorization decision in memory
   */
  async storeMemory(profileId, transaction, categoryAccountId) {
    try {
      const { data, error } = await supabase.rpc('store_categorization_memory', {
        p_profile_id: profileId,
        p_transaction_date: transaction.date,
        p_original_description: transaction.original_description || transaction.description,
        p_amount: transaction.amount,
        p_bank_account_id: transaction.bank_account_id,
        p_category_account_id: categoryAccountId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to store categorization memory:', error);
      throw error;
    }
  },

  /**
   * Lookup a remembered category for a transaction
   */
  async lookupMemory(profileId, transaction) {
    try {
      const { data, error } = await supabase.rpc('lookup_categorization_memory', {
        p_profile_id: profileId,
        p_transaction_date: transaction.date,
        p_original_description: transaction.original_description || transaction.description,
        p_amount: transaction.amount,
        p_bank_account_id: transaction.bank_account_id
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to lookup categorization memory:', error);
      return null;
    }
  },

  /**
   * Batch lookup memories for multiple transactions
   */
  async batchLookupMemories(profileId, transactions) {
    const memories = {};

    for (const txn of transactions) {
      const categoryId = await this.lookupMemory(profileId, txn);
      if (categoryId) {
        memories[txn.id || txn.temp_id] = categoryId;
      }
    }

    return memories;
  },

  /**
   * Get memory statistics for a profile
   */
  async getStats(profileId) {
    try {
      const { data, error } = await supabase.rpc('get_categorization_memory_stats', {
        p_profile_id: profileId
      });

      if (error) throw error;
      return data[0] || {
        total_memories: 0,
        recent_memories: 0,
        avg_use_count: 0,
        oldest_memory: null,
        newest_memory: null
      };
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      return null;
    }
  },

  /**
   * Get all memories for a profile (for management UI)
   */
  async getMemories(profileId, limit = 100, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('transaction_categorization_memory')
        .select(`
          *,
          category:category_account_id(id, display_name, account_number),
          bank_account:bank_account_id(id, display_name, account_number)
        `)
        .eq('profile_id', profileId)
        .order('last_used_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get memories:', error);
      throw error;
    }
  },

  /**
   * Delete a specific memory
   */
  async deleteMemory(memoryId) {
    try {
      const { error } = await supabase
        .from('transaction_categorization_memory')
        .delete()
        .eq('id', memoryId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to delete memory:', error);
      throw error;
    }
  },

  /**
   * Clear all memories for a profile
   */
  async clearAllMemories(profileId) {
    try {
      const { error } = await supabase
        .from('transaction_categorization_memory')
        .delete()
        .eq('profile_id', profileId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to clear memories:', error);
      throw error;
    }
  },

  /**
   * Clear old memories (older than specified days)
   */
  async clearOldMemories(profileId, daysOld = 180) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await supabase
        .from('transaction_categorization_memory')
        .delete()
        .eq('profile_id', profileId)
        .lt('last_used_at', cutoffDate.toISOString());

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to clear old memories:', error);
      throw error;
    }
  }
};

export default categorizationMemoryAPI;
