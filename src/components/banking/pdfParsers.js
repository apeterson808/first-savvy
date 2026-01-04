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
        const amount = Math.abs(parseFloat(amountStr.replace(/,/g, '')));
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
        const amount = Math.abs(parseFloat(amountStr.replace(/,/g, '')));

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

  const parseAmexDate = (dateStr) => {
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!match) return null;

    const [, month, day, year] = match;
    const fullYear = parseInt(year) >= 50 ? `19${year}` : `20${year}`;
    const formatted = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    const testDate = new Date(formatted);
    if (!isNaN(testDate.getTime())) {
      return formatted;
    }
    return null;
  };

  const cleanMerchantName = (text) => {
    let cleaned = text;

    cleaned = cleaned.replace(/^AplPay\s+/i, '');
    cleaned = cleaned.replace(/^SP\s+/i, '');
    cleaned = cleaned.replace(/^TST\*\s+/i, '');
    cleaned = cleaned.replace(/^SPO\*\s+/i, '');
    cleaned = cleaned.replace(/^BT\*\s+/i, '');

    cleaned = cleaned.replace(/\s+\d{3}-\d{3}-\d{4}$/, '');
    cleaned = cleaned.replace(/\s+\+\d{10,}$/, '');
    cleaned = cleaned.replace(/\s+\d{10,}$/, '');

    cleaned = cleaned.replace(/\s+[A-Z]{2}$/, '');

    cleaned = cleaned.replace(/\s+\d{5}(-\d{4})?$/, '');

    return cleaned.trim();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'Payments and Credits' || line === 'Payments') {
      inPaymentsSection = true;
      inChargesSection = false;
      continue;
    }

    if (line === 'Credits') {
      inPaymentsSection = true;
      inChargesSection = false;
      continue;
    }

    if (line === 'New Charges' || (line === 'Detail' && inPaymentsSection === false)) {
      inChargesSection = true;
      inPaymentsSection = false;
      continue;
    }

    if (line.startsWith('Fees') || line.startsWith('Interest Charged') ||
        line.startsWith('Total Fees') || line.startsWith('Total Interest') ||
        line === 'Summary' || line === 'Amount') {
      inPaymentsSection = false;
      inChargesSection = false;
      continue;
    }

    if (inPaymentsSection) {
      const paymentMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\*?\s+(.+?)\s+-\$?([\d,]+\.\d{2})$/);
      if (paymentMatch) {
        const [, dateStr, description, amountStr] = paymentMatch;
        const amount = Math.abs(parseFloat(amountStr.replace(/,/g, '')));
        const date = parseAmexDate(dateStr);

        if (amount > 0 && date && description && !description.match(/^(Payments|Credits|Total)/i)) {
          transactions.push({
            date,
            description: description.trim(),
            original_description: description.trim(),
            amount,
            type: 'income'
          });
        }
      }
    }

    if (inChargesSection) {
      const chargeMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/);
      if (chargeMatch) {
        const [, dateStr, rawDescription, amountStr] = chargeMatch;
        const amount = Math.abs(parseFloat(amountStr.replace(/,/g, '')));
        const date = parseAmexDate(dateStr);

        if (amount > 0 && date && rawDescription &&
            !rawDescription.match(/^(Total|Amount|Card Ending|JENNA)/i) &&
            rawDescription.length > 3) {

          const description = cleanMerchantName(rawDescription);

          transactions.push({
            date,
            description,
            original_description: rawDescription.trim(),
            amount,
            type: 'expense'
          });
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
  let beginningBalance = null;

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

    if (line.includes('Beginning Balance')) {
      inTransactionSection = false;
      const balanceMatch = line.match(/\$?([\d,]+\.\d{2})/);
      if (balanceMatch && !beginningBalance) {
        beginningBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
      }
      continue;
    }

    if (line.includes('Ending Balance')) {
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
    beginningBalance,
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
