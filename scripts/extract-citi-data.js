import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

pdfjsLib.GlobalWorkerOptions.workerSrc = join(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

const parseDate = (dateStr, year) => {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const parts = dateStr.split('/');
  if (parts.length === 2) {
    const [month, day] = parts;
    const monthPadded = month.padStart(2, '0');
    const dayPadded = day.padStart(2, '0');
    const formatted = `${year}-${monthPadded}-${dayPadded}`;

    const testDate = new Date(formatted);
    if (!isNaN(testDate.getTime())) {
      return formatted;
    }
  }
  return null;
};

const parseCitiStatement = (text, lines, fileName) => {
  const transactions = [];
  const lowerText = text.toLowerCase();

  if (!lowerText.includes('citi') && !lowerText.includes('costco')) {
    return null;
  }

  const accountMatch = text.match(/Account\s+number\s+ending\s+in:\s+(\d{4})/i) ||
                       text.match(/Account.*?ending.*?(\d{4})/i);
  const accountNumber = accountMatch ? accountMatch[1] : null;

  const previousBalanceMatch = text.match(/Previous\s+balance\s+\$?([\d,]+\.\d{2})/i);
  const beginningBalance = previousBalanceMatch ? -parseFloat(previousBalanceMatch[1].replace(/,/g, '')) : 0;

  const newBalanceMatch = text.match(/New\s+balance\s+\$?([\d,]+\.\d{2})/i);
  const endingBalance = newBalanceMatch ? -parseFloat(newBalanceMatch[1].replace(/,/g, '')) : 0;

  const monthMatch = fileName.match(/_([a-z]{3})\./i);
  const statementMonth = monthMatch ? monthMatch[1].toLowerCase() : 'dec';
  const year = 2025;

  let inPaymentsSection = false;
  let inPurchasesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('Payments, Credits and Adjustments')) {
      inPaymentsSection = true;
      inPurchasesSection = false;
      continue;
    }

    if (line.includes('Standard Purchases') || line === 'ANDREW J PETERSON Standard Purchases') {
      inPurchasesSection = true;
      inPaymentsSection = false;
      continue;
    }

    if (line.startsWith('Purchases Prior') || line.startsWith('2025 Totals')) {
      inPurchasesSection = false;
      inPaymentsSection = false;
      continue;
    }

    if (inPaymentsSection) {
      const paymentMatch = line.match(/^(\d{1,2}\/\d{1,2})\s+(.+?)\s+-\s+\$?([\d,]+\.\d{2})$/);
      if (paymentMatch) {
        const [, dateStr, description, amountStr] = paymentMatch;
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        if (amount > 0 && description) {
          const date = parseDate(dateStr, year);
          if (date) {
            transactions.push({
              date,
              description: description.trim(),
              amount,
              type: 'income'
            });
          }
        }
      }
    }

    if (inPurchasesSection) {
      const purchaseMatch = line.match(/^(\d{1,2}\/\d{1,2})\s+(?:\d{1,2}\/\d{1,2}\s+)?(.+?)\s+\$?([\d,]+\.\d{2})$/);
      if (purchaseMatch) {
        const [, dateStr, description, amountStr] = purchaseMatch;
        const amount = parseFloat(amountStr.replace(/,/g, ''));

        if (amount > 0 && description && !description.includes('TOTAL') && description.length > 3) {
          const date = parseDate(dateStr, year);
          if (date) {
            transactions.push({
              date,
              description: description.trim(),
              amount,
              type: 'expense'
            });
          }
        }
      }
    }
  }

  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  let currentBalance = beginningBalance;
  const transactionsWithBalance = transactions.map(txn => {
    if (txn.type === 'income') {
      currentBalance += txn.amount;
    } else {
      currentBalance -= txn.amount;
    }
    return {
      ...txn,
      balance: parseFloat(currentBalance.toFixed(2))
    };
  });

  if (transactionsWithBalance.length > 0) {
    transactionsWithBalance.unshift({
      date: transactionsWithBalance[0].date.split('-').slice(0, 2).join('-') + '-01',
      description: 'Beginning Balance',
      amount: 0,
      type: 'expense',
      balance: beginningBalance
    });
  }

  return {
    institutionName: 'Citi',
    fileName,
    statementMonth,
    accountNumber,
    beginningBalance,
    endingBalance,
    transactions: transactionsWithBalance
  };
};

async function extractTextFromPDF(pdfPath) {
  const buffer = readFileSync(pdfPath);
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let fullText = '';
  const lines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';

    const pageLines = pageText.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);
    lines.push(...pageLines);
  }

  return { fullText, lines };
}

async function main() {
  const statementFiles = [
    'citi_sep.pdf',
    'citi_oct.pdf',
    'citi_nov.pdf',
    'citi_dec.pdf'
  ];

  const citiData = {};

  for (const file of statementFiles) {
    const filePath = join(__dirname, '../data/statements', file);
    console.log(`Processing ${file}...`);

    try {
      const { fullText, lines } = await extractTextFromPDF(filePath);
      const parsed = parseCitiStatement(fullText, lines, file);

      if (parsed && parsed.transactions.length > 0) {
        const monthKey = `citi_${parsed.statementMonth}`;
        citiData[monthKey] = {
          statement_month: parsed.statementMonth,
          statement_year: 2025,
          accounts: [
            {
              last_four: parsed.accountNumber,
              account_type: 'credit_card',
              account_name: 'Citi Costco Credit Card',
              beginning_balance: parsed.beginningBalance,
              ending_balance: parsed.endingBalance,
              transactions: parsed.transactions
            }
          ]
        };
        console.log(`  ✓ Found ${parsed.transactions.length} transactions`);
        console.log(`    Account: ${parsed.accountNumber}`);
        console.log(`    Beginning: $${parsed.beginningBalance}`);
        console.log(`    Ending: $${parsed.endingBalance}`);
      } else {
        console.log(`  ✗ No data extracted`);
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  const outputPath = join(__dirname, 'citi-extracted-data.json');
  writeFileSync(outputPath, JSON.stringify(citiData, null, 2));
  console.log(`\n✓ Data saved to ${outputPath}`);
}

main().catch(console.error);
