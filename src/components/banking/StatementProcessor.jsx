import { firstsavvy } from '@/api/firstsavvyClient';
import { format } from 'date-fns';

export const processStatementFile = async (file, onProgress) => {
  const fileExt = file.name.split('.').pop().toLowerCase();

  if (fileExt === 'csv') {
    onProgress?.('parsing');
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      return row;
    });

    return { type: 'csv', headers, rows };
  }

  if (fileExt === 'ofx' || fileExt === 'qfx') {
    onProgress?.('uploading');

    const user = await firstsavvy.auth.getUser();
    if (!user?.data?.user?.id) {
      throw new Error('You must be logged in to upload files');
    }

    const userId = user.data.user.id;
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}-${file.name}`;

    const { data: uploadData, error: uploadError } = await firstsavvy.storage
      .from('statement-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    const { data: urlData } = firstsavvy.storage
      .from('statement-files')
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    onProgress?.('extracting');

    const extractResponse = await firstsavvy.functions.parseOfx({ file_url: fileUrl });

    await firstsavvy.storage.from('statement-files').remove([filePath]);

    if (extractResponse.status === 'success' && extractResponse.output?.transactions) {
      return {
        type: 'transactions',
        transactions: extractResponse.output.transactions,
        institutionName: extractResponse.output.institutionName,
        accountNumber: extractResponse.output.accountNumber,
        beginningBalance: extractResponse.output.beginningBalance
      };
    }

    const errorMsg = extractResponse.details || extractResponse.error || 'Failed to extract data';
    throw new Error(errorMsg);
  }

  throw new Error(`Unsupported file type: .${fileExt}. Please upload a CSV, OFX, or QFX file.`);
};

export const parseDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;

  let cleanDate = dateStr.trim().split(' ')[0].split('T')[0];
  if (!cleanDate) return null;

  const mdyMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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

export const mapCsvToTransactions = (csvData, columnMappings, amountType, debitColumn, creditColumn) => {
  const transactions = csvData.rows.map(row => {
    let amount = 0;
    let type = 'expense';

    if (amountType === 'separate_columns') {
      const debit = parseFloat(row[debitColumn]?.replace(/[^0-9.-]/g, '') || 0);
      const credit = parseFloat(row[creditColumn]?.replace(/[^0-9.-]/g, '') || 0);

      if (credit > 0) {
        amount = credit;
        type = 'income';
      } else if (debit > 0) {
        amount = debit;
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
        type = rawAmount < 0 ? 'expense' : 'income';
      }
    }

    const originalDescription = row[columnMappings.description] || 'Unknown';
    return {
      date: parseDate(row[columnMappings.date]),
      description: originalDescription,
      original_description: originalDescription,
      amount,
      type,
      category: row[columnMappings.category] || null
    };
  }).filter(t => t.amount > 0 && t.date !== null);

  return transactions;
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
              chart_account_id: null
            })
          );

          updates.push(
            firstsavvy.entities.Transaction.update(candidate.id, {
              transfer_pair_id: pairId,
              type: candidateType,
              original_type: candidate.original_type || candidate.type,
              chart_account_id: null
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
