import { supabase } from './supabaseClient';

/**
 * Detection Queue API
 *
 * Phase 2: Background job queue for transaction detection and AI suggestions.
 * All detection now happens server-side via workers instead of client-side.
 */

export const detectionQueueAPI = {
  /**
   * Enqueue detection jobs for a batch of transactions
   *
   * @param {string} profileId - Profile ID
   * @param {string[]} transactionIds - Array of transaction IDs to process
   * @param {string} reason - Reason for enqueuing (e.g., 'import', 'manual_trigger')
   * @returns {Promise<{batchId: string, error: null} | {batchId: null, error: Error}>}
   */
  async enqueueDetection(profileId, transactionIds, reason = 'import') {
    try {
      if (!transactionIds || transactionIds.length === 0) {
        throw new Error('No transaction IDs provided');
      }

      const { data, error } = await supabase.rpc('enqueue_detection', {
        p_profile_id: profileId,
        p_transaction_ids: transactionIds,
        p_reason: reason
      });

      if (error) throw error;

      return { batchId: data, error: null };
    } catch (error) {
      console.error('Failed to enqueue detection jobs:', error);
      return { batchId: null, error };
    }
  },

  /**
   * Get status of a detection batch
   *
   * @param {string} batchId - Batch ID returned from enqueueDetection
   * @returns {Promise<{data: object, error: null} | {data: null, error: Error}>}
   */
  async getBatchStatus(batchId) {
    try {
      const { data, error } = await supabase.rpc('get_batch_status', {
        p_batch_id: batchId
      });

      if (error) throw error;

      return { data: data[0], error: null };
    } catch (error) {
      console.error('Failed to get batch status:', error);
      return { data: null, error };
    }
  },

  /**
   * Get all detection jobs for a profile
   *
   * @param {string} profileId - Profile ID
   * @param {string} status - Optional status filter ('queued', 'running', 'done', 'failed')
   * @returns {Promise<{data: array, error: null} | {data: null, error: Error}>}
   */
  async getJobs(profileId, status = null) {
    try {
      let query = supabase
        .from('detection_jobs')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Failed to get jobs:', error);
      return { data: null, error };
    }
  },

  /**
   * Get job execution metrics for a profile
   *
   * @param {string} profileId - Profile ID
   * @param {string} jobType - Optional job type filter
   * @returns {Promise<{data: array, error: null} | {data: null, error: Error}>}
   */
  async getMetrics(profileId, jobType = null) {
    try {
      let query = supabase
        .from('job_execution_metrics')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (jobType) {
        query = query.eq('job_type', jobType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return { data: null, error };
    }
  },

  /**
   * Trigger the detection worker manually
   *
   * @returns {Promise<{data: object, error: null} | {data: null, error: Error}>}
   */
  async triggerWorker() {
    try {
      const { data, error } = await supabase.functions.invoke('detection-worker', {
        body: { action: 'process' }
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Failed to trigger worker:', error);
      return { data: null, error };
    }
  },

  /**
   * Subscribe to batch status changes
   *
   * @param {string} batchId - Batch ID to monitor
   * @param {function} callback - Callback function receiving status updates
   * @returns {object} Subscription object with unsubscribe method
   */
  subscribeToBatchStatus(batchId, callback) {
    const channel = supabase
      .channel(`batch-${batchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'detection_jobs',
          filter: `batch_id=eq.${batchId}`
        },
        async (payload) => {
          // When any job in the batch updates, fetch full batch status
          const { data } = await this.getBatchStatus(batchId);
          callback(data);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  },

  /**
   * Reject a transfer match (prevents re-suggestion)
   *
   * @param {string} profileId - Profile ID
   * @param {string} transferPairId - Transfer pair ID to reject
   * @param {string} userId - User ID making the rejection
   * @returns {Promise<{error: null} | {error: Error}>}
   */
  async rejectTransferMatch(profileId, transferPairId, userId) {
    try {
      const { error } = await supabase.rpc('reject_transfer_match', {
        p_profile_id: profileId,
        p_transfer_pair_id: transferPairId,
        p_user_id: userId
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Failed to reject transfer match:', error);
      return { error };
    }
  },

  /**
   * Reject a credit card payment match (prevents re-suggestion)
   *
   * @param {string} profileId - Profile ID
   * @param {string} ccPaymentPairId - CC payment pair ID to reject
   * @param {string} userId - User ID making the rejection
   * @returns {Promise<{error: null} | {error: Error}>}
   */
  async rejectCCPaymentMatch(profileId, ccPaymentPairId, userId) {
    try {
      const { error } = await supabase.rpc('reject_cc_payment_match', {
        p_profile_id: profileId,
        p_cc_payment_pair_id: ccPaymentPairId,
        p_user_id: userId
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Failed to reject CC payment match:', error);
      return { error };
    }
  },

  /**
   * Reject an AI category suggestion
   *
   * @param {string} transactionId - Transaction ID
   * @param {string} userId - User ID making the rejection
   * @returns {Promise<{error: null} | {error: Error}>}
   */
  async rejectCategorySuggestion(transactionId, userId) {
    try {
      const { error } = await supabase
        .from('ai_category_suggestions')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: userId
        })
        .eq('transaction_id', transactionId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Failed to reject category suggestion:', error);
      return { error };
    }
  },

  /**
   * Reject an AI contact suggestion
   *
   * @param {string} transactionId - Transaction ID
   * @param {string} userId - User ID making the rejection
   * @returns {Promise<{error: null} | {error: Error}>}
   */
  async rejectContactSuggestion(transactionId, userId) {
    try {
      const { error } = await supabase
        .from('ai_contact_suggestions')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: userId
        })
        .eq('transaction_id', transactionId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Failed to reject contact suggestion:', error);
      return { error };
    }
  }
};

export default detectionQueueAPI;
