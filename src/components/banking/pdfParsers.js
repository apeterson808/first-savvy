import { parseDate } from './StatementProcessor';

export const parseCitiStatement = (text, lines) => {
  const transactions = [];
  const lowerText = text.toLowerCase();

  if (!lowerText.includes('citi') && !lowerText.includes('costco')) {
    return null;
  }

  const accountMatch = text.match(/Account.*?ending.*?(\d{4})/i) || text.match(/Account Ending.*?(\d{4})/i);
  const accountNumber = accountMatch ? accountMatch[1] : null;

  let inPaymentsSection = false;
  let inPurchasesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('Payments, Credits and Adjustments') || line.includes('Payments and Credits')) {
      inPaymentsSection = true;
      inPurchasesSection = false;
      continue;
    }

    if (line.includes('Standard Purchases') || line.includes('Purchases Prior to')) {
      inPurchasesSection = true;
      inPaymentsSection = false;
      continue;
    }

    if (line.includes('Fees Charged') || line.includes('Interest Charged') || line.match(/^TOTAL\s/) || line.match(/^Total\s/)) {
      inPaymentsSection = false;
      inPurchasesSection = false;
      continue;
    }

    if (inPaymentsSection) {
      const paymentMatch = line.match(/^(\d{1,2}\/\d{1,2}).*?-\$?([\d,]+\.\d{2})$/);
      if (paymentMatch) {
        const [, dateStr, amountStr] = paymentMatch;
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        const description = line.substring(dateStr.length, line.lastIndexOf(amountStr) - 2).trim();

        if (amount > 0 && description) {
          transactions.push({
            date: parseDate(dateStr + '/25'),
            description: description,
            original_description: description,
            amount,
            type: 'income'
          });
        }
      }
    }

    if (inPurchasesSection) {
      const purchaseMatch = line.match(/^(\d{1,2}\/\d{1,2})(?:\s+\d{1,2}\/\d{1,2})?\s+(.+?)\s+\$?([\d,]+\.\d{2})$/);
      if (purchaseMatch) {
        const [, dateStr, description, amountStr] = purchaseMatch;
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        if (amount > 0 && description && !description.includes('TOTAL') && description.length > 3) {
          transactions.push({
            date: parseDate(dateStr + '/25'),
            description: description.trim(),
            original_description: description.trim(),
            amount,
            type: 'expense'
          });
        }
      }
    }
  }

  return {
    institutionName: 'Citi',
    accountNumber,
    transactions: transactions.filter(t => t.date !== null)
  };
};

export const parseAmexStatement = (text, lines) => {
  const transactions = [];
  const lowerText = text.toLowerCase();

  if (!lowerText.includes('american express') && !lowerText.includes('delta skymiles')) {
    return null;
  }

  const accountMatch = text.match(/Account Ending.*?(\d-\d{5})/i);
  const accountNumber = accountMatch ? accountMatch[1].replace('-', '') : null;

  let inPaymentsSection = false;
  let inChargesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('Payments and Credits') || line.match(/^Payments$/)) {
      inPaymentsSection = true;
      inChargesSection = false;
      continue;
    }

    if (line.includes('New Charges') || line.match(/^Detail$/)) {
      inChargesSection = true;
      inPaymentsSection = false;
      continue;
    }

    if (line.includes('Fees') || line.includes('Interest Charged') || line.match(/^Total\s/)) {
      inPaymentsSection = false;
      inChargesSection = false;
      continue;
    }

    if (inPaymentsSection) {
      const paymentMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\*?\s+(.+?)\s+-?\$?([\d,]+\.\d{2})$/);
      if (paymentMatch) {
        const [, dateStr, description, amountStr] = paymentMatch;
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        if (amount > 0) {
          transactions.push({
            date: parseDate(dateStr),
            description: description.trim(),
            original_description: description.trim(),
            amount,
            type: 'income'
          });
        }
      } else {
        const dateOnlyMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+)$/);
        if (dateOnlyMatch && i + 1 < lines.length) {
          const [, dateStr, description] = dateOnlyMatch;
          const nextLine = lines[i + 1].trim();
          const amountMatch = nextLine.match(/^-?\$?([\d,]+\.\d{2})$/);

          if (amountMatch) {
            const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
            if (amount > 0) {
              transactions.push({
                date: parseDate(dateStr),
                description: description.trim(),
                original_description: description.trim(),
                amount,
                type: 'income'
              });
              i++;
            }
          }
        }
      }
    }

    if (inChargesSection) {
      const chargeMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/);
      if (chargeMatch) {
        const [, dateStr, description, amountStr] = chargeMatch;
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        if (amount > 0 && description && !description.includes('Total') && description.length > 3) {
          transactions.push({
            date: parseDate(dateStr),
            description: description.trim(),
            original_description: description.trim(),
            amount,
            type: 'expense'
          });
        }
      } else {
        const dateOnlyMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+)$/);
        if (dateOnlyMatch && i + 1 < lines.length) {
          const [, dateStr, description] = dateOnlyMatch;

          if (description && !description.includes('Total') && description.length > 3) {
            const nextLine = lines[i + 1].trim();
            const amountMatch = nextLine.match(/^\$?([\d,]+\.\d{2})$/);

            if (amountMatch) {
              const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
              if (amount > 0) {
                transactions.push({
                  date: parseDate(dateStr),
                  description: description.trim(),
                  original_description: description.trim(),
                  amount,
                  type: 'expense'
                });
                i++;
              }
            }
          }
        }
      }
    }
  }

  return {
    institutionName: 'American Express',
    accountNumber,
    transactions: transactions.filter(t => t.date !== null)
  };
};

export const parseIccuStatement = (text, lines) => {
  const transactions = [];
  const lowerText = text.toLowerCase();

  if (!lowerText.includes('idaho central') && !lowerText.includes('iccu')) {
    return null;
  }

  const accountMatch = text.match(/Account.*?(\d{4})/i);
  const accountNumber = accountMatch ? accountMatch[1] : null;

  let inTransactionSection = false;
  let currentAccountType = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('SHARE SAVINGS') || line.includes('SAVINGS')) {
      currentAccountType = 'savings';
      inTransactionSection = true;
      continue;
    }

    if (line.includes('CENTRAL CHECKING') || line.includes('CHECKING')) {
      currentAccountType = 'checking';
      inTransactionSection = true;
      continue;
    }

    if (line.includes('CREDIT CARD')) {
      currentAccountType = 'credit_card';
      inTransactionSection = true;
      continue;
    }

    if (line.startsWith('Date') && line.includes('Description') && line.includes('Amount')) {
      continue;
    }

    if (line.includes('Beginning Balance') || line.includes('Ending Balance')) {
      inTransactionSection = false;
      continue;
    }

    if (inTransactionSection && line) {
      const transMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})$/);
      if (transMatch) {
        const [, dateStr, description, amountStr] = transMatch;
        const rawAmount = parseFloat(amountStr.replace(/[$,]/g, ''));
        const amount = Math.abs(rawAmount);
        const type = rawAmount < 0 ? 'expense' : 'income';

        if (amount > 0) {
          transactions.push({
            date: parseDate(dateStr),
            description: description.trim(),
            original_description: description.trim(),
            amount,
            type,
            accountType: currentAccountType
          });
        }
      }
    }
  }

  return {
    institutionName: 'Idaho Central Credit Union',
    accountNumber,
    transactions: transactions.filter(t => t.date !== null)
  };
};

export const detectInstitution = (text) => {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('costco anywhere') ||
      (lowerText.includes('citi') && lowerText.includes('costco'))) {
    return 'citi';
  }

  if (lowerText.includes('american express') ||
      lowerText.includes('delta skymiles')) {
    return 'amex';
  }

  if (lowerText.includes('idaho central') ||
      lowerText.includes('iccu')) {
    return 'iccu';
  }

  return null;
};

export const parsePdfStatement = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const institution = detectInstitution(text);

  if (!institution) {
    throw new Error('Could not detect bank institution from PDF. Supported banks: Citi, American Express, Idaho Central Credit Union');
  }

  let result = null;

  if (institution === 'citi') {
    result = parseCitiStatement(text, lines);
  } else if (institution === 'amex') {
    result = parseAmexStatement(text, lines);
  } else if (institution === 'iccu') {
    result = parseIccuStatement(text, lines);
  }

  if (!result || result.transactions.length === 0) {
    throw new Error(`Failed to extract transactions from ${institution} statement. The PDF format may have changed or the file may be corrupted.`);
  }

  return result;
};
