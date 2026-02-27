/**
 * Matching Compatibility Layer
 *
 * Provides backward compatibility between old matching system
 * (transfer_pair_id, cc_payment_pair_id) and new unified system
 * (paired_transaction_id, match_type).
 */

export function isMatched(transaction) {
  // Check unified system first
  if (transaction.paired_transaction_id != null) {
    return true;
  }

  // Fallback to legacy system
  return transaction.transfer_pair_id != null || transaction.cc_payment_pair_id != null;
}

export function getPairedTransactionId(transaction) {
  // Unified system
  if (transaction.paired_transaction_id) {
    return transaction.paired_transaction_id;
  }

  // Legacy system - we need to find the pair by pair_id
  return null;
}

export function getMatchType(transaction) {
  // Unified system
  if (transaction.match_type) {
    return transaction.match_type;
  }

  // Legacy system
  if (transaction.transfer_pair_id) {
    return 'transfer';
  }
  if (transaction.cc_payment_pair_id) {
    return 'credit_card_payment';
  }

  return null;
}

export function getMatchConfidence(transaction) {
  // Unified system
  if (transaction.match_confidence != null) {
    return transaction.match_confidence;
  }

  // Legacy system
  if (transaction.transfer_match_confidence != null) {
    return transaction.transfer_match_confidence;
  }
  if (transaction.cc_payment_match_confidence != null) {
    return transaction.cc_payment_match_confidence;
  }

  return null;
}

export function isAutoDetected(transaction) {
  // Unified system
  if (transaction.match_auto_detected != null) {
    return transaction.match_auto_detected;
  }

  // Legacy system
  return transaction.transfer_auto_detected || transaction.cc_payment_auto_detected || false;
}

export function isReviewed(transaction) {
  // Unified system
  if (transaction.match_reviewed != null) {
    return transaction.match_reviewed;
  }

  // Legacy system
  return transaction.transfer_reviewed || transaction.cc_payment_reviewed || false;
}

export function findPairedTransaction(transaction, allTransactions) {
  if (!transaction) return null;

  // Unified system
  if (transaction.paired_transaction_id) {
    return allTransactions.find(t => t.id === transaction.paired_transaction_id);
  }

  // Legacy system - find by pair_id
  if (transaction.transfer_pair_id) {
    return allTransactions.find(t =>
      t.id !== transaction.id &&
      t.transfer_pair_id === transaction.transfer_pair_id
    );
  }

  if (transaction.cc_payment_pair_id) {
    return allTransactions.find(t =>
      t.id !== transaction.id &&
      t.cc_payment_pair_id === transaction.cc_payment_pair_id
    );
  }

  return null;
}

export function getUnreviewedMatchCount(transactions) {
  const unreviewed = transactions.filter(t => {
    if (!isMatched(t)) return false;
    if (isReviewed(t)) return false;
    if (!isAutoDetected(t)) return false;
    return true;
  });

  // Divide by 2 since each pair has 2 transactions
  return Math.floor(unreviewed.length / 2);
}

export function normalizeTransaction(transaction) {
  /**
   * Normalizes a transaction to use unified fields,
   * copying from legacy fields if unified fields are missing
   */
  return {
    ...transaction,
    paired_transaction_id: transaction.paired_transaction_id || null,
    match_type: getMatchType(transaction),
    match_confidence: getMatchConfidence(transaction),
    match_auto_detected: isAutoDetected(transaction),
    match_reviewed: isReviewed(transaction),
  };
}
