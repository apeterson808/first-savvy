import { readFileSync } from 'fs';
import { PDFParse } from 'pdf-parse';

const cleanAmount = (amountStr) => {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;

  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
    /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
    /(\w{3})\s+(\d{1,2}),?\s+(\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      if (match[1].match(/^\d+$/)) {
        let month = match[1];
        let day = match[2];
        let year = match[3];

        if (year.length === 2) {
          year = '20' + year;
        }

        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        const monthMap = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        const month = monthMap[match[1]];
        const day = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
    }
  }

  return null;
};

const parseCitiStatement = (text) => {
  const transactions = [];
  const lines = text.split('\n');

  let accountNumber = '';
  const accountMatch = text.match(/Account\s+Number[:\s]+(\d+)/i) ||
                      text.match(/\*+(\d{4})/);
  if (accountMatch) {
    accountNumber = '****' + accountMatch[1].slice(-4);
  }

  const transactionPattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR)?/gi;
  let match;

  while ((match = transactionPattern.exec(text)) !== null) {
    const date = parseDate(match[1]);
    const description = match[2].trim();
    const amount = cleanAmount(match[3]);
    const isCredit = match[4] === 'CR';

    if (date && amount > 0) {
      transactions.push({
        date,
        description,
        amount,
        type: isCredit ? 'income' : 'expense',
        status: 'posted'
      });
    }
  }

  return {
    institution: 'Citi',
    accountType: 'credit',
    accountNumber,
    transactions
  };
};

const parseAmexStatement = (text) => {
  const transactions = [];
  const lines = text.split('\n');

  let accountNumber = '';
  const accountMatch = text.match(/(\d{4})\s*$/m) ||
                      text.match(/\*+(\d{4})/);
  if (accountMatch) {
    accountNumber = '****' + accountMatch[1];
  }

  const transactionPattern = /(\d{1,2}\/\d{1,2})\s+(.+?)\s+(-?[\d,]+\.\d{2})/gi;
  let match;

  while ((match = transactionPattern.exec(text)) !== null) {
    const dateStr = match[1] + '/2024';
    const date = parseDate(dateStr);
    const description = match[2].trim();
    const amount = Math.abs(cleanAmount(match[3]));

    if (date && amount > 0) {
      transactions.push({
        date,
        description,
        amount,
        type: 'expense',
        status: 'posted'
      });
    }
  }

  return {
    institution: 'American Express',
    accountType: 'credit',
    accountNumber,
    transactions
  };
};

const parseICCUStatement = (text) => {
  const transactions = [];
  const lines = text.split('\n');

  let accountNumber = '';
  const accountMatch = text.match(/Account\s+(\d+)/i) ||
                      text.match(/\*+(\d{4})/);
  if (accountMatch) {
    accountNumber = '****' + accountMatch[1].slice(-4);
  }

  const accountType = text.toLowerCase().includes('checking') ? 'checking' :
                     text.toLowerCase().includes('savings') ? 'savings' : 'checking';

  const transactionPattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})/gi;
  let match;

  while ((match = transactionPattern.exec(text)) !== null) {
    const date = parseDate(match[1]);
    const description = match[2].trim();
    const amount = cleanAmount(match[3]);

    if (date && amount !== 0) {
      transactions.push({
        date,
        description,
        amount: Math.abs(amount),
        type: amount < 0 ? 'expense' : 'income',
        status: 'posted'
      });
    }
  }

  return {
    institution: 'Idaho Central Credit Union',
    accountType,
    accountNumber,
    transactions
  };
};

export const parsePDFStatement = async (pdfPath) => {
  try {
    const dataBuffer = readFileSync(pdfPath);
    const parser = new PDFParse();
    const data = await parser.parse(dataBuffer);
    const text = data.text;

    if (text.toLowerCase().includes('citi') || text.toLowerCase().includes('citibank')) {
      return parseCitiStatement(text);
    } else if (text.toLowerCase().includes('american express') || text.toLowerCase().includes('amex')) {
      return parseAmexStatement(text);
    } else if (text.toLowerCase().includes('idaho central') || text.toLowerCase().includes('iccu')) {
      return parseICCUStatement(text);
    }

    throw new Error('Unknown bank statement format');
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
};
