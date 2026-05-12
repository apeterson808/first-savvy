import { firstsavvy } from './firstsavvyClient';

/**
 * transactionService - Service Boundary Enforcement
 *
 * This service is the ONLY authorized way to change transaction status and edit journal entries.
 * All status changes MUST go through these methods to maintain:
 * - Proper journal entry creation
 * - Audit trail integrity
 * - Security boundaries
 *
 * DO NOT directly call supabase.from('transactions').update({status})
 * The database will reject direct status updates (enforced by trigger).
 *
 * Journal entries are edited in place with full audit logging (no reversal system).
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
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Get journal entry details for editing
 *
 * @param {string} entryId - UUID of journal entry
 * @returns {Promise<{data: object, error: object}>}
 */
export async function getJournalEntry(entryId) {
  try {
    const { data: entry, error: entryError } = await firstsavvy
      .from('journal_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (entryError) {
      return { data: null, error: entryError };
    }

    const { data: lines, error: linesError } = await firstsavvy
      .from('journal_entry_lines')
      .select(`
        *,
        account:user_chart_of_accounts!account_id (
          id,
          account_number,
          account_name,
          display_name,
          class
        )
      `)
      .eq('journal_entry_id', entryId)
      .order('line_number');

    if (linesError) {
      return { data: null, error: linesError };
    }

    return {
      data: {
        entry,
        lines
      },
      error: null
    };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Edit a journal entry in place
 * Validates debits equal credits, captures audit trail
 *
 * @param {string} entryId - UUID of journal entry to edit
 * @param {string} description - Updated description
 * @param {Array} lines - Array of line objects {account_id, debit_amount, credit_amount, description}
 * @param {string} reason - Reason for the edit
 * @returns {Promise<{data: object, error: object}>}
 */
export async function editJournalEntry(entryId, description, lines, reason = null) {
  try {
    const { data, error } = await firstsavvy.rpc('update_journal_entry', {
      p_entry_id: entryId,
      p_new_description: description,
      p_lines: lines,
      p_edit_reason: reason
    });

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Void a transaction (replaces delete)
 * Sets transaction status to 'voided' and voids the linked journal entry.
 * This is permanent — voided transactions remain in the register with a strikethrough.
 *
 * @param {string} transactionId - UUID of transaction to void
 * @returns {Promise<{data: object, error: object}>}
 */
export async function voidTransaction(transactionId) {
  try {
    const { data, error } = await firstsavvy.rpc('void_transaction', {
      p_transaction_id: transactionId
    });

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
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

