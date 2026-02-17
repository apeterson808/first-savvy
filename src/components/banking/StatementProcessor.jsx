import { format } from 'date-fns';
import Papa from 'papaparse';

export const processStatementFile = async (file, onProgress) => {
  const fileExt = file.name.split('.').pop().toLowerCase();

  if (fileExt === 'csv') {
    onProgress?.('parsing');
    const text = await file.text();

    const parseResult = Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      trimHeaders: true,
      trim: true
    });

    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing warnings:', parseResult.errors);
    }

    const data = parseResult.data;

    if (data.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    const headers = data[0];
    const rows = data.slice(1).map(values => {
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      return row;
    });

    return { type: 'csv', headers, rows };
  }

  throw new Error(`Unsupported file type: .${fileExt}. Please upload a CSV file.`);
};

export const parseDate = (dateStr) => {
  if (!dateStr) return null;

  if (typeof dateStr !== 'string') {
    if (dateStr instanceof Date) {
      return format(dateStr, 'yyyy-MM-dd');
    }
    dateStr = String(dateStr);
  }

  let cleanDate = dateStr.trim().split(' ')[0].split('T')[0];
  if (!cleanDate) return null;

  const mdyMatch4 = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch4) {
    const [, month, day, year] = mdyMatch4;
    const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const testDate = new Date(formatted);
    if (!isNaN(testDate.getTime())) {
      return formatted;
    }
  }

  const mdyMatch2 = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdyMatch2) {
    const [, month, day, year] = mdyMatch2;
    const fullYear = parseInt(year) >= 50 ? `19${year}` : `20${year}`;
    const formatted = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const testDate = new Date(formatted);
    if (!isNaN(testDate.getTime())) {
      return formatted;
    }
  }

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanDate)) {
    const parts = cleanDate.split('-');
    const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    const testDate = new Date(formatted);
    if (!isNaN(testDate.getTime())) {
      return formatted;
    }
  }

  try {
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed.getTime())) {
      return format(parsed, 'yyyy-MM-dd');
    }
  } catch (e) {}

  return null;
};

export const mapCsvToTransactions = (csvData, columnMappings, amountType, debitColumn, creditColumn, accountClass = 'asset') => {
  const allTransactions = csvData.rows.map(row => {
    let amount = 0;
    let type = 'expense';

    if (amountType === 'separate_columns') {
      const debit = parseFloat(row[debitColumn]?.replace(/[^0-9.-]/g, '') || 0);
      const credit = parseFloat(row[creditColumn]?.replace(/[^0-9.-]/g, '') || 0);

      if (Math.abs(credit) > 0) {
        amount = Math.abs(credit);
        type = 'income';
      } else if (Math.abs(debit) > 0) {
        amount = Math.abs(debit);
        type = 'expense';
      }
    } else {
      const rawAmount = parseFloat(row[columnMappings.amount]?.replace(/[^0-9.-]/g, '') || 0);

      if (amountType === 'always_expense') {
        amount = Math.abs(rawAmount);
        type = 'expense';
      } else if (amountType === 'always_income') {
        amount = Math.abs(rawAmount);
        type = 'income';
      } else {
        amount = Math.abs(rawAmount);
        // For liabilities (credit cards): positive = expense (purchase), negative = income (payment)
        // For assets (bank accounts): negative = expense (withdrawal), positive = income (deposit)
        if (accountClass === 'liability') {
          type = rawAmount >= 0 ? 'expense' : 'income';
        } else {
          type = rawAmount < 0 ? 'expense' : 'income';
        }
      }
    }

    const originalDescription = row[columnMappings.description] || 'Unknown';
    const parsedDate = parseDate(row[columnMappings.date]);

    return {
      date: parsedDate,
      description: originalDescription,
      original_description: originalDescription,
      amount,
      type
    };
  });

  const filtered = allTransactions.filter(t => t.amount > 0 && t.date !== null);
  return filtered;
};

export const splitTransactionsByGoLiveDate = (transactions, goLiveDate) => {
  const posted = [];
  const pending = [];

  transactions.forEach(txn => {
    if (txn.date < goLiveDate) {
      posted.push({ ...txn, status: 'posted' });
    } else {
      pending.push({ ...txn, status: 'pending' });
    }
  });

  return { posted, pending };
};

export const calculateOpeningBalanceForDate = (previousBalance, transactions, startDate, isLiability = true) => {
  if (!previousBalance || !transactions || transactions.length === 0 || !startDate) {
    return previousBalance || 0;
  }

  const selectedDate = new Date(startDate);
  let calculatedBalance = previousBalance;

  const transactionsBeforeStartDate = transactions.filter(txn => {
    const txnDate = new Date(txn.date);
    return txnDate < selectedDate;
  });

  transactionsBeforeStartDate.forEach(txn => {
    if (isLiability) {
      if (txn.type === 'expense') {
        calculatedBalance += txn.amount;
      } else if (txn.type === 'income') {
        calculatedBalance -= txn.amount;
      }
    } else {
      if (txn.type === 'expense') {
        calculatedBalance -= txn.amount;
      } else if (txn.type === 'income') {
        calculatedBalance += txn.amount;
      }
    }
  });

  return calculatedBalance;
};

export const calculateBeginningBalanceFromCurrent = (currentBalance, transactions, startDate, isLiability = false) => {
  if (currentBalance === undefined || currentBalance === null || !transactions || transactions.length === 0 || !startDate) {
    return currentBalance || 0;
  }

  const selectedDate = new Date(startDate);
  selectedDate.setHours(0, 0, 0, 0);
  let beginningBalance = currentBalance;

  const transactionsOnOrAfterStartDate = transactions.filter(txn => {
    const txnDate = new Date(txn.date);
    txnDate.setHours(0, 0, 0, 0);
    return txnDate >= selectedDate;
  });

  transactionsOnOrAfterStartDate.forEach(txn => {
    if (isLiability) {
      if (txn.type === 'expense') {
        beginningBalance -= txn.amount;
      } else if (txn.type === 'income') {
        beginningBalance += txn.amount;
      }
    } else {
      if (txn.type === 'expense') {
        beginningBalance += txn.amount;
      } else if (txn.type === 'income') {
        beginningBalance -= txn.amount;
      }
    }
  });

  return Math.round(beginningBalance * 100) / 100;
};

export const autoMatchTransfers = async (newTransactions) => {
  try {
    const allPendingTransactions = await firstsavvy.entities.Transaction.filter({ status: 'pending' });

    let matchedCount = 0;
    const processedIds = new Set();
    const updates = [];

    for (const txn of newTransactions) {
      if (processedIds.has(txn.id) || txn.transfer_pair_id) continue;

      for (const candidate of allPendingTransactions) {
        if (processedIds.has(candidate.id) || candidate.transfer_pair_id) continue;
        if (candidate.id === txn.id) continue;

        const amountMatch = Math.abs(Math.abs(txn.amount) - Math.abs(candidate.amount)) < 0.01;
        const oppositeSigns = (txn.amount > 0 && candidate.amount < 0) || (txn.amount < 0 && candidate.amount > 0);

        const txnDate = new Date(txn.date);
        const candidateDate = new Date(candidate.date);
        const daysDiff = Math.abs((txnDate - candidateDate) / (1000 * 60 * 60 * 24));
        const dateMatch = daysDiff <= 7;

        if (!amountMatch || !oppositeSigns || !dateMatch) continue;

        const normalizeDesc = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const txnDesc = normalizeDesc(txn.description);
        const candidateDesc = normalizeDesc(candidate.description);

        const commonWords = txnDesc.split(' ').filter(word =>
          word.length > 3 && candidateDesc.includes(word)
        ).length;

        let confidence = 50;
        confidence += Math.max(0, 30 - daysDiff * 4);
        confidence += commonWords * 10;

        if (confidence >= 80) {
          const pairId = crypto.randomUUID();

          const txnType = txn.amount > 0 ? 'transfer' : 'transfer';
          const candidateType = candidate.amount > 0 ? 'transfer' : 'transfer';

          updates.push(
            firstsavvy.entities.Transaction.update(txn.id, {
              transfer_pair_id: pairId,
              type: txnType,
              original_type: txn.original_type || txn.type,
              category_account_id: null
            })
          );

          updates.push(
            firstsavvy.entities.Transaction.update(candidate.id, {
              transfer_pair_id: pairId,
              type: candidateType,
              original_type: candidate.original_type || candidate.type,
              category_account_id: null
            })
          );

          processedIds.add(txn.id);
          processedIds.add(candidate.id);
          matchedCount++;
          break;
        }
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return matchedCount;
  } catch (err) {
    console.error('Error auto-matching transfers:', err);
    return 0;
  }
};
