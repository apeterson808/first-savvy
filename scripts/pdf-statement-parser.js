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
  let accountMatch = text.match(/Account\s+number\s+ending\s+in:\s+(\d+)/i);
  if (!accountMatch) {
    accountMatch = text.match(/Card\s+by\s+Citi\s+-\s+(\d+)/i);
  }
  if (accountMatch) {
    accountNumber = '****' + accountMatch[1];
  }

  let beginningBalance = null;
  let endingBalance = null;

  const prevBalanceMatch = text.match(/Previous\s+Balance[:\s]+\$?([\d,]+\.\d{2})/i);
  if (prevBalanceMatch) {
    beginningBalance = cleanAmount(prevBalanceMatch[1]);
  }

  const newBalanceMatch = text.match(/New\s+Balance[:\s]+\$?([\d,]+\.\d{2})/i);
  if (newBalanceMatch) {
    endingBalance = cleanAmount(newBalanceMatch[1]);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const singleDateMatch = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})$/);
    const dualDateMatch = line.match(/^(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})$/);
    const monthDayYearMatch = line.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})$/);

    let date, description, rawAmount;

    if (monthDayYearMatch) {
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      const [_, monthStr, day, year, desc, amt] = monthDayYearMatch;
      const month = monthMap[monthStr];
      date = `${year}-${month}-${day.padStart(2, '0')}`;
      description = desc.trim();
      rawAmount = cleanAmount(amt);
    } else if (dualDateMatch) {
      const [_, saleDate, postDate, desc, amt] = dualDateMatch;
      date = postDate;
      description = desc.trim();
      rawAmount = cleanAmount(amt);

      const [month, day] = date.split('/');
      const year = '2024';
      date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (singleDateMatch) {
      const [_, dateStr, desc, amt] = singleDateMatch;
      date = dateStr;
      description = desc.trim();
      rawAmount = cleanAmount(amt);

      const [month, day] = date.split('/');
      const year = '2024';
      date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    if (date && rawAmount !== undefined && rawAmount !== 0) {
      const isCredit = rawAmount < 0;
      const amount = Math.abs(rawAmount);

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
    transactions,
    beginningBalance,
    endingBalance
  };
};

const parseAmexStatement = (text) => {
  const transactions = [];
  const lines = text.split('\n');

  let accountNumber = '';
  const accountMatch = text.match(/Account\s+Ending\s+\d+-(\d{5})/i);
  if (accountMatch) {
    accountNumber = '****' + accountMatch[1].slice(-4);
  }

  let beginningBalance = null;
  let endingBalance = null;

  const prevBalanceMatch = text.match(/Previous\s+Balance[:\s]+\$?([\d,]+\.\d{2})/i);
  if (prevBalanceMatch) {
    beginningBalance = cleanAmount(prevBalanceMatch[1]);
  }

  const newBalanceMatch = text.match(/New\s+Balance[:\s]+\$?([\d,]+\.\d{2})/i);
  if (newBalanceMatch) {
    endingBalance = cleanAmount(newBalanceMatch[1]);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+)/);

    if (dateMatch) {
      const dateStr = dateMatch[1];
      const description = dateMatch[2].trim();

      let amount = 0;
      let isCredit = false;

      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const amountMatch = lines[j].match(/^(-?\$[\d,]+\.\d{2})/);
        if (amountMatch) {
          const rawAmount = cleanAmount(amountMatch[1]);
          isCredit = rawAmount < 0;
          amount = Math.abs(rawAmount);
          break;
        }
      }

      if (amount > 0) {
        const [month, day, year] = dateStr.split('/');
        const fullYear = year.length === 2 ? '20' + year : year;
        const date = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        transactions.push({
          date,
          description,
          amount,
          type: isCredit ? 'income' : 'expense',
          status: 'posted'
        });
      }
    }
  }

  return {
    institution: 'American Express',
    accountType: 'credit',
    accountNumber,
    transactions,
    beginningBalance,
    endingBalance
  };
};

const parseICCUStatement = (text) => {
  const accounts = [];
  const lines = text.split('\n');

  const savingsHeaderIndex = lines.findIndex(line =>
    line.includes('SHARE SAVINGS - PERSONAL SAVINGS')
  );
  const checkingHeaderIndex = lines.findIndex(line =>
    line.includes('CENTRAL CHECKING - MAIN CHECKING')
  );

  const parseAccountSection = (startIndex, endIndex, accountType) => {
    if (startIndex === -1) return null;

    const sectionLines = lines.slice(startIndex, endIndex !== -1 ? endIndex : lines.length);
    const sectionText = sectionLines.join('\n');

    let accountNumber = '';
    const accountMatch = sectionText.match(/Account\s+No\.\s+\*\*(\d+)/i);
    if (accountMatch) {
      accountNumber = '****' + accountMatch[1];
    }

    const transactions = [];
    let beginningBalance = null;
    let endingBalance = null;

    for (let i = 0; i < sectionLines.length; i++) {
      const line = sectionLines[i];

      const transMatch = line.match(/^(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(.+)$/);

      if (transMatch) {
        const [_, effDate, postDate, amount1Str, amount2Str, description] = transMatch;

        const descLower = description.toLowerCase().trim();

        if (descLower.includes('beginning balance')) {
          beginningBalance = parseFloat(amount2Str.replace(/,/g, ''));
          continue;
        }

        if (descLower.includes('ending balance')) {
          endingBalance = parseFloat(amount2Str.replace(/,/g, ''));
          continue;
        }

        let amount = 0;
        let type = 'expense';

        const isWithdrawal = descLower.includes('withdrawal') ||
                            descLower.includes('ach withdrawal') ||
                            descLower.includes('check') ||
                            descLower.includes('fee') ||
                            descLower.includes('transfer to') ||
                            descLower.includes('point of sale');

        const isDeposit = descLower.includes('deposit') ||
                         descLower.includes('transfer from') ||
                         descLower.includes('payment deposit') ||
                         descLower.includes('real time payment');

        if (isWithdrawal) {
          type = 'expense';
          amount = parseFloat(amount1Str.replace(/,/g, ''));
        } else if (isDeposit) {
          type = 'income';
          amount = parseFloat(amount1Str.replace(/,/g, ''));
        } else {
          type = 'expense';
          amount = parseFloat(amount1Str.replace(/,/g, ''));
        }

        const date = postDate;
        const [month, day] = date.split('/');
        const currentYear = new Date().getFullYear();
        const fullDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        if (amount > 0) {
          transactions.push({
            date: fullDate,
            description: description.trim(),
            amount,
            type,
            status: 'posted'
          });
        }
      }
    }

    return {
      institution: 'Idaho Central Credit Union',
      accountType,
      accountNumber,
      transactions,
      beginningBalance,
      endingBalance
    };
  };

  if (savingsHeaderIndex !== -1) {
    const savingsAccount = parseAccountSection(
      savingsHeaderIndex,
      checkingHeaderIndex,
      'savings'
    );
    if (savingsAccount) {
      accounts.push(savingsAccount);
    }
  }

  if (checkingHeaderIndex !== -1) {
    const checkingAccount = parseAccountSection(
      checkingHeaderIndex,
      -1,
      'checking'
    );
    if (checkingAccount) {
      accounts.push(checkingAccount);
    }
  }

  return accounts.length > 0 ? accounts : [{
    institution: 'Idaho Central Credit Union',
    accountType: 'checking',
    accountNumber: '',
    transactions: [],
    beginningBalance: null,
    endingBalance: null
  }];
};

export const parsePDFStatement = async (pdfPath) => {
  try {
    const dataBuffer = readFileSync(pdfPath);
    const parser = new PDFParse({ data: dataBuffer, verbosity: 0 });
    const data = await parser.getText();
    const text = data.text;
    const lowerText = text.toLowerCase();

    if (lowerText.includes('share savings') || lowerText.includes('central checking') ||
        lowerText.includes('return service requested')) {
      return parseICCUStatement(text);
    } else if (lowerText.includes('american express') || lowerText.includes('skymiles')) {
      return parseAmexStatement(text);
    } else if (lowerText.includes('costco anywhere') || lowerText.includes('citibank')) {
      return parseCitiStatement(text);
    }

    throw new Error('Unknown bank statement format');
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
};
