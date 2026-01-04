import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

pdfjsLib.GlobalWorkerOptions.workerSrc = join(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

const parseDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;

  let month, day, year;
  const parts = dateStr.split('/');

  if (parts.length === 3) {
    [month, day, year] = parts;
    if (year.length === 2) {
      year = parseInt(year) >= 50 ? `19${year}` : `20${year}`;
    }
  } else if (parts.length === 2) {
    [month, day] = parts;
    year = new Date().getFullYear().toString();
  } else {
    return null;
  }

  const monthPadded = month.padStart(2, '0');
  const dayPadded = day.padStart(2, '0');
  const formatted = `${year}-${monthPadded}-${dayPadded}`;

  const testDate = new Date(formatted);
  if (!isNaN(testDate.getTime())) {
    return formatted;
  }
  return null;
};

const parseIccuStatement = (text, lines, fileName) => {
  const accounts = {};
  const lowerText = text.toLowerCase();

  if (!lowerText.includes('idaho central') && !lowerText.includes('iccu')) {
    return null;
  }

  let inTransactionSection = false;
  let currentAccountType = null;
  let currentAccountLast4 = null;
  let beginningBalance = null;
  let endingBalance = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const savingsMatch = line.match(/.*?(\d{4})\s+-\s+SHARE SAVINGS/i) ||
                         line.match(/SHARE SAVINGS.*?(\d{4})/i);
    if (savingsMatch) {
      if (currentAccountLast4 && accounts[currentAccountLast4]) {
        accounts[currentAccountLast4].ending_balance = endingBalance;
      }

      currentAccountLast4 = savingsMatch[1];
      currentAccountType = 'savings';
      inTransactionSection = false;
      beginningBalance = null;
      endingBalance = null;

      if (!accounts[currentAccountLast4]) {
        accounts[currentAccountLast4] = {
          last_four: currentAccountLast4,
          account_type: 'savings',
          account_name: 'Share Savings',
          transactions: [],
          beginning_balance: null,
          ending_balance: null
        };
      }
      continue;
    }

    const checkingMatch = line.match(/.*?(\d{4})\s+-\s+CENTRAL CHECKING/i) ||
                          line.match(/CENTRAL CHECKING.*?(\d{4})/i);
    if (checkingMatch) {
      if (currentAccountLast4 && accounts[currentAccountLast4]) {
        accounts[currentAccountLast4].ending_balance = endingBalance;
      }

      currentAccountLast4 = checkingMatch[1];
      currentAccountType = 'checking';
      inTransactionSection = false;
      beginningBalance = null;
      endingBalance = null;

      if (!accounts[currentAccountLast4]) {
        accounts[currentAccountLast4] = {
          last_four: currentAccountLast4,
          account_type: 'checking',
          account_name: 'Central Checking',
          transactions: [],
          beginning_balance: null,
          ending_balance: null
        };
      }
      continue;
    }

    const beginBalMatch = line.match(/Beginning Balance.*?\$?([\d,]+\.\d{2})/i);
    if (beginBalMatch && currentAccountLast4) {
      beginningBalance = parseFloat(beginBalMatch[1].replace(/,/g, ''));
      if (accounts[currentAccountLast4] && accounts[currentAccountLast4].beginning_balance === null) {
        accounts[currentAccountLast4].beginning_balance = beginningBalance;
      }
      inTransactionSection = true;
      continue;
    }

    const endBalMatch = line.match(/Ending Balance.*?\$?([\d,]+\.\d{2})/i);
    if (endBalMatch && currentAccountLast4) {
      endingBalance = parseFloat(endBalMatch[1].replace(/,/g, ''));
      accounts[currentAccountLast4].ending_balance = endingBalance;
      inTransactionSection = false;
      continue;
    }

    if (line.match(/^Date\s+Description/i)) {
      inTransactionSection = true;
      continue;
    }

    if (inTransactionSection && currentAccountLast4 && line) {
      const transMatch = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+([-]?\$?[\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?$/);
      if (transMatch) {
        const [, dateStr, description, amountStr, balanceStr] = transMatch;
        const rawAmount = parseFloat(amountStr.replace(/[$,]/g, ''));
        const amount = Math.abs(rawAmount);
        const type = rawAmount < 0 ? 'expense' : 'income';
        const balance = balanceStr ? parseFloat(balanceStr.replace(/,/g, '')) : null;

        if (amount > 0 && description.trim().length > 0) {
          accounts[currentAccountLast4].transactions.push({
            date: parseDate(dateStr),
            description: description.trim(),
            amount,
            type,
            balance
          });
        }
      }
    }
  }

  if (currentAccountLast4 && accounts[currentAccountLast4]) {
    accounts[currentAccountLast4].ending_balance = endingBalance;
  }

  const monthMatch = fileName.match(/_([a-z]{3})\./i);
  const statementMonth = monthMatch ? monthMatch[1].toLowerCase() : null;

  return {
    institutionName: 'Idaho Central Credit Union',
    fileName,
    statementMonth,
    accounts: Object.values(accounts)
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
    'iccu_sep.pdf',
    'iccu_oct.pdf',
    'iccu_nov.pdf',
    'iccu_dec.pdf'
  ];

  const results = {};

  for (const file of statementFiles) {
    const filePath = join(__dirname, '../data/statements', file);
    console.log(`Processing ${file}...`);

    try {
      const { fullText, lines } = await extractTextFromPDF(filePath);
      const parsed = parseIccuStatement(fullText, lines, file);

      if (parsed && parsed.accounts.length > 0) {
        console.log(`  ✓ Found ${parsed.accounts.length} accounts`);
        parsed.accounts.forEach(account => {
          console.log(`    - ${account.account_name} (...${account.last_four}): ${account.transactions.length} transactions`);
        });
        results[file] = parsed;
      } else {
        console.log(`  ✗ No data extracted`);
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }

  const outputPath = join(__dirname, 'iccu-extracted-data.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Data saved to ${outputPath}`);
}

main().catch(console.error);
