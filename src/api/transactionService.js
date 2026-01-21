import { firstsavvy } from './firstsavvyClient';

/**
 * transactionService - Service Boundary Enforcement
 *
 * This service is the ONLY authorized way to change transaction status.
 * All status changes MUST go through these methods to maintain:
 * - Proper journal entry creation/reversal
 * - Audit trail integrity
 * - Security boundaries
 *
 * DO NOT directly call supabase.from('transactions').update({status})
 * The database will reject direct status updates (enforced by trigger).
 */

/**
 * Post a transaction (pending → posted)
 * Creates a journal entry via database trigger
 *
 * @param {string} transactionId - UUID of transaction to post
 * @returns {Promise<{data: object, error: object}>}
 */
export async function postTransaction(transactionId) {
  try {
    // Use RPC function to set flag and update status in one transaction
    const { data, error } = await firstsavvy.rpc('rpc_post_transaction', {
      p_transaction_id: transactionId
    });

    if (error) {
      console.error('Error posting transaction:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Exception posting transaction:', err);
    return { data: null, error: err };
  }
}

/**
 * Undo post a transaction (posted → pending)
 * Creates a reversal journal entry
 *
 * @param {string} transactionId - UUID of transaction to undo
 * @param {string} reason - Optional reason for unposting
 * @returns {Promise<{data: object, error: object}>}
 */
export async function undoPostTransaction(transactionId, reason = null) {
  try {
    const { data, error } = await firstsavvy.rpc('undo_post_transaction', {
      p_transaction_id: transactionId,
      p_reason: reason
    });

    if (error) {
      console.error('Error unposting transaction:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Exception unposting transaction:', err);
    return { data: null, error: err };
  }
}

/**
 * Undo post a transfer pair (both transactions)
 * Creates ONE reversal journal entry for the shared JE
 *
 * @param {string} pairId - UUID of the transfer pair
 * @param {string} reason - Optional reason for unposting
 * @returns {Promise<{data: object, error: object}>}
 */
export async function undoPostTransferPair(pairId, reason = null) {
  try {
    const { data, error } = await firstsavvy.rpc('undo_post_transfer_pair', {
      p_pair_id: pairId,
      p_reason: reason
    });

    if (error) {
      console.error('Error unposting transfer pair:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Exception unposting transfer pair:', err);
    return { data: null, error: err };
  }
}

/**
 * Undo post a credit card payment pair (both transactions)
 * Creates ONE reversal journal entry for the shared JE
 *
 * @param {string} paymentId - UUID of the payment pair
 * @param {string} reason - Optional reason for unposting
 * @returns {Promise<{data: object, error: object}>}
 */
export async function undoPostCCPaymentPair(paymentId, reason = null) {
  try {
    const { data, error } = await firstsavvy.rpc('undo_post_cc_payment_pair', {
      p_payment_id: paymentId,
      p_reason: reason
    });

    if (error) {
      console.error('Error unposting payment pair:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Exception unposting payment pair:', err);
    return { data: null, error: err };
  }
}

/**
 * Post multiple transactions in batch
 *
 * @param {string[]} transactionIds - Array of transaction UUIDs
 * @returns {Promise<{data: object[], errors: object[]}>}
 */
export async function postTransactionsBatch(transactionIds) {
  const results = [];
  const errors = [];

  for (const id of transactionIds) {
    const result = await postTransaction(id);
    if (result.error) {
      errors.push({ id, error: result.error });
    } else {
      results.push(result.data);
    }
  }

  return { data: results, errors };
}

/**
 * Undo post multiple transactions in batch
 *
 * @param {string[]} transactionIds - Array of transaction UUIDs
 * @param {string} reason - Optional reason for unposting
 * @returns {Promise<{data: object[], errors: object[]}>}
 */
export async function undoPostTransactionsBatch(transactionIds, reason = null) {
  const results = [];
  const errors = [];

  for (const id of transactionIds) {
    const result = await undoPostTransaction(id, reason);
    if (result.error) {
      errors.push({ id, error: result.error });
    } else {
      results.push(result.data);
    }
  }

  return { data: results, errors };
}
