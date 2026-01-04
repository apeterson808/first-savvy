import { readFileSync } from 'fs';
import { PDFParse } from 'pdf-parse';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const parseDate = (dateStr) => {
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

  const mdyShortMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdyShortMatch) {
    const [, month, day, year] = mdyShortMatch;
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
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
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}

  return null;
};

const parseCitiStatement = (text, lines) => {
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

    if (line.includes('Standard Purchases') || line.includes('New Charges')) {
      inPurchasesSection = true;
      inPaymentsSection = false;
      continue;
    }

    if (line.includes('Fees Charged') || line.includes('Interest Charged') || line.includes('Total')) {
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

        if (amount > 0 && description && !description.includes('TOTAL')) {
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

const parseAmexStatement = (text, lines) => {
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
      const paymentMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\*?\s+(.+?)\s+-\$?([\d,]+\.\d{2})$/);
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
      }
    }

    if (inChargesSection) {
      const chargeMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/);
      if (chargeMatch) {
        const [, dateStr, description, amountStr] = chargeMatch;
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        if (amount > 0 && description && !description.includes('Total')) {
          transactions.push({
            date: parseDate(dateStr),
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
    institutionName: 'American Express',
    accountNumber,
    transactions: transactions.filter(t => t.date !== null)
  };
};

async function testCiti() {
  console.log('\n=== Testing Citi Statement ===');
  const filePath = join(__dirname, '..', 'data', 'statements', 'citi_dec.pdf');
  const dataBuffer = readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer, verbosity: 0 });
  const data = await parser.getText();
  const text = data.text;
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const result = parseCitiStatement(text, lines);

  if (result) {
    console.log(`Institution: ${result.institutionName}`);
    console.log(`Account Number: ${result.accountNumber}`);
    console.log(`Transactions found: ${result.transactions.length}`);
    console.log('\nSample transactions:');
    result.transactions.slice(0, 5).forEach((t, i) => {
      console.log(`${i + 1}. ${t.date} | ${t.description.substring(0, 40)} | $${t.amount.toFixed(2)} (${t.type})`);
    });
  } else {
    console.log('Failed to parse Citi statement');
  }
}

async function testAmex() {
  console.log('\n=== Testing AmEx Statement ===');
  const filePath = join(__dirname, '..', 'data', 'statements', 'amex_dec.pdf');
  const dataBuffer = readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer, verbosity: 0 });
  const data = await parser.getText();
  const text = data.text;
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const result = parseAmexStatement(text, lines);

  if (result) {
    console.log(`Institution: ${result.institutionName}`);
    console.log(`Account Number: ${result.accountNumber}`);
    console.log(`Transactions found: ${result.transactions.length}`);
    console.log('\nSample transactions:');
    result.transactions.slice(0, 5).forEach((t, i) => {
      console.log(`${i + 1}. ${t.date} | ${t.description.substring(0, 40)} | $${t.amount.toFixed(2)} (${t.type})`);
    });
  } else {
    console.log('Failed to parse AmEx statement');
  }
}

async function main() {
  await testCiti();
  await testAmex();
}

main().catch(console.error);
