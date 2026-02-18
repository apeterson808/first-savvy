function normalizeDescription(desc) {
  if (!desc) return '';
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTokens(desc) {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by']);
  return normalizeDescription(desc)
    .split(' ')
    .filter(t => t.length > 2 && !stopWords.has(t));
}

function getDescriptionKey(transaction) {
  return transaction.original_description || transaction.description || '';
}

export function isSimilarDescription(desc1, desc2) {
  const norm1 = normalizeDescription(desc1);
  const norm2 = normalizeDescription(desc2);

  if (!norm1 || !norm2) return false;

  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  const tokens1 = extractTokens(desc1);
  const tokens2 = extractTokens(desc2);

  if (tokens1.length === 0 || tokens2.length === 0) return false;

  const set1 = new Set(tokens1);
  const overlap = tokens2.filter(t => set1.has(t)).length;
  const union = new Set([...tokens1, ...tokens2]).size;

  const jaccard = overlap / union;
  if (jaccard >= 0.5) return true;

  const longer = norm1.length > norm2.length ? norm1 : norm2;
  const shorter = norm1.length > norm2.length ? norm2 : norm1;

  if (shorter.length >= 4 && longer.includes(shorter)) return true;
  const shortTokens = extractTokens(shorter);
  if (shortTokens.length >= 1 && shortTokens.every(t => longer.includes(t))) return true;

  return false;
}

export function findSimilarUncategorized(categorizedTransaction, allTransactions) {
  const sourceDesc = getDescriptionKey(categorizedTransaction);
  if (!sourceDesc) return [];

  return allTransactions.filter(txn => {
    if (txn.id === categorizedTransaction.id) return false;
    if (txn.category_account_id) return false;
    if (txn.type === 'transfer' || txn.type === 'credit_card_payment') return false;
    if (txn.status === 'excluded') return false;

    const targetDesc = getDescriptionKey(txn);
    return isSimilarDescription(sourceDesc, targetDesc);
  });
}

export function findSimilarWithoutContact(sourceTransaction, allTransactions) {
  const sourceDesc = getDescriptionKey(sourceTransaction);
  if (!sourceDesc) return [];

  return allTransactions.filter(txn => {
    if (txn.id === sourceTransaction.id) return false;
    if (txn.contact_id) return false;
    if (txn.type === 'transfer' || txn.type === 'credit_card_payment') return false;
    if (txn.status === 'excluded') return false;

    const targetDesc = getDescriptionKey(txn);
    return isSimilarDescription(sourceDesc, targetDesc);
  });
}
