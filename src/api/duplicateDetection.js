import { firstsavvy } from './firstsavvyClient';

export async function detectDuplicateTransactions(accountId, newTransactions) {
  if (!accountId || !newTransactions || newTransactions.length === 0) {
    return { duplicates: [], uniqueTransactions: newTransactions };
  }

  try {
    const { data: existingTransactions, error } = await firstsavvy
      .from('transactions')
      .select('id, date, amount, original_description, description')
      .eq('chart_account_id', accountId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching existing transactions:', error);
      return { duplicates: [], uniqueTransactions: newTransactions };
    }

    if (!existingTransactions || existingTransactions.length === 0) {
      return { duplicates: [], uniqueTransactions: newTransactions };
    }

    const duplicates = [];
    const uniqueTransactions = [];

    newTransactions.forEach(newTxn => {
      const isDuplicate = existingTransactions.some(existingTxn => {
        const sameDate = existingTxn.date === newTxn.date;
        const sameAmount = Math.abs(existingTxn.amount - newTxn.amount) < 0.01;
        const descToCompare = newTxn.original_description || newTxn.description;
        const existingDescToCompare = existingTxn.original_description || existingTxn.description;
        const sameDescription = descToCompare?.toLowerCase().trim() === existingDescToCompare?.toLowerCase().trim();

        return sameDate && sameAmount && sameDescription;
      });

      if (isDuplicate) {
        duplicates.push(newTxn);
      } else {
        uniqueTransactions.push(newTxn);
      }
    });

    return { duplicates, uniqueTransactions };
  } catch (error) {
    console.error('Error in duplicate detection:', error);
    return { duplicates: [], uniqueTransactions: newTransactions };
  }
}

export function getTransactionDateRange(transactions) {
  if (!transactions || transactions.length === 0) {
    return { startDate: null, endDate: null };
  }

  const dates = transactions.map(txn => new Date(txn.date)).filter(d => !isNaN(d));

  if (dates.length === 0) {
    return { startDate: null, endDate: null };
  }

  const startDate = new Date(Math.min(...dates));
  const endDate = new Date(Math.max(...dates));

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
