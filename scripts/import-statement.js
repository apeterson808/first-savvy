import { createClient } from '@supabase/supabase-js';
import * as pdfjsLib from 'pdfjs-dist';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://lfisuvkmkwsublkiyimv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaXN1dmtta3dzdWJsa2l5aW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDkzMTEsImV4cCI6MjA4MTM4NTMxMX0.4rmBJECcTnY05USr1d_wz78tuv-T9rqWV5L4XaFo3f8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const parseDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const mmddyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (mmddyy) {
    const [, month, day, year] = mmddyy;
    const fullYear = parseInt(year) >= 50 ? `19${year}` : `20${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

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

  let previousBalance = null;
  let newBalance = null;
  let statementStartDate = null;
  let statementEndDate = null;

  const previousBalanceMatch = text.match(/Previous\s+balance\s+\$?([\d,]+\.\d{2})/i);
  if (previousBalanceMatch) {
    previousBalance = parseFloat(previousBalanceMatch[1].replace(/,/g, ''));
  }

  const newBalanceMatch = text.match(/New\s+balance\s+\$?([\d,]+\.\d{2})/i);
  if (newBalanceMatch) {
    newBalance = parseFloat(newBalanceMatch[1].replace(/,/g, ''));
  }

  const billingPeriodMatch = text.match(/Billing\s+Period[\s:]+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (billingPeriodMatch) {
    statementStartDate = parseDate(billingPeriodMatch[1]);
    statementEndDate = parseDate(billingPeriodMatch[2]);
  }

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
          const fullDateStr = dateStr + '/25';
          transactions.push({
            date: parseDate(fullDateStr),
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
          const fullDateStr = dateStr + '/25';
          transactions.push({
            date: parseDate(fullDateStr),
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
    previousBalance,
    newBalance,
    beginningBalance: previousBalance,
    statementStartDate,
    statementEndDate,
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

  const parseAmexDate = (dateStr) => {
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!match) return null;

    const [, month, day, year] = match;
    const fullYear = parseInt(year) >= 50 ? `19${year}` : `20${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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

const parseIccuStatement = (text, lines) => {
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

const detectInstitution = (text) => {
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

const parsePdfStatement = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const institution = detectInstitution(text);

  if (!institution) {
    throw new Error('Could not detect bank institution from PDF');
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
    throw new Error(`Failed to extract transactions from ${institution} statement`);
  }

  return result;
};

async function extractTextFromPdf(pdfPath) {
  const dataBuffer = await fs.readFile(pdfPath);
  const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

async function findBankAccount(accountNumber, institutionName, profileId) {
  const { data: accounts, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('account_number_last4', accountNumber);

  if (error) {
    console.error('Error finding account:', error);
    return null;
  }

  if (accounts && accounts.length > 0) {
    return accounts[0];
  }

  console.log(`No account found with last 4 digits: ${accountNumber}`);
  return null;
}

async function importTransactions(pdfPath, profileId) {
  console.log('\n=== Starting Import Process ===\n');
  console.log('PDF File:', pdfPath);

  console.log('Extracting text from PDF...');
  const text = await extractTextFromPdf(pdfPath);

  console.log('Parsing statement...');
  const statementData = parsePdfStatement(text);

  console.log('\n=== Statement Summary ===');
  console.log('Institution:', statementData.institutionName);
  console.log('Account Number:', statementData.accountNumber || 'Not found');
  console.log('Transactions Found:', statementData.transactions.length);

  if (statementData.beginningBalance !== null && statementData.beginningBalance !== undefined) {
    console.log('Beginning Balance:', `$${statementData.beginningBalance.toFixed(2)}`);
  }
  if (statementData.previousBalance !== null && statementData.previousBalance !== undefined) {
    console.log('Previous Balance:', `$${statementData.previousBalance.toFixed(2)}`);
  }
  if (statementData.newBalance !== null && statementData.newBalance !== undefined) {
    console.log('New Balance:', `$${statementData.newBalance.toFixed(2)}`);
  }
  if (statementData.statementStartDate) {
    console.log('Statement Period:', `${statementData.statementStartDate} to ${statementData.statementEndDate}`);
  }

  console.log('\n=== Sample Transactions (First 5) ===');
  statementData.transactions.slice(0, 5).forEach((t, i) => {
    console.log(`${i + 1}. ${t.date} | ${t.description} | $${t.amount.toFixed(2)} (${t.type})`);
  });

  if (!statementData.accountNumber) {
    throw new Error('Could not extract account number from statement');
  }

  console.log('\nLooking up bank account in database...');
  const account = await findBankAccount(statementData.accountNumber, statementData.institutionName, profileId);

  if (!account) {
    console.log('\nAvailable accounts with last 4 digits:');
    const { data: allAccounts } = await supabase
      .from('user_chart_of_accounts')
      .select('display_name, account_number, account_number_last4')
      .eq('profile_id', profileId)
      .not('account_number_last4', 'is', null);

    if (allAccounts && allAccounts.length > 0) {
      allAccounts.forEach(a => {
        console.log(`- ${a.display_name} (Last 4: ${a.account_number_last4})`);
      });
    } else {
      console.log('No accounts found with last 4 digits set.');
      console.log('\nYou need to set the account_number_last4 field for your accounts.');
      console.log('Example: UPDATE user_chart_of_accounts SET account_number_last4 = \'1234\' WHERE display_name = \'Your Account\';');
    }

    throw new Error(`No account found matching last 4 digits: ${statementData.accountNumber}`);
  }

  console.log('Found Account:', account.display_name);
  console.log('Account ID:', account.id);

  console.log('\nImporting transactions to database...');

  const transactionsToInsert = statementData.transactions.map(t => ({
    profile_id: profileId,
    chart_account_id: account.id,
    transaction_date: t.date,
    description: t.description,
    original_description: t.original_description,
    amount: t.amount,
    type: t.type,
    status: 'posted',
    source: 'manual_import'
  }));

  const { data: insertedTransactions, error: insertError } = await supabase
    .from('transactions')
    .insert(transactionsToInsert)
    .select();

  if (insertError) {
    console.error('Error inserting transactions:', insertError);
    throw insertError;
  }

  console.log('\n=== Import Complete ===');
  console.log('Successfully imported', insertedTransactions.length, 'transactions');
  console.log('Account:', account.display_name);

  return {
    account,
    statementData,
    insertedCount: insertedTransactions.length
  };
}

const pdfPath = process.argv[2];
const profileId = process.argv[3];

if (!pdfPath) {
  console.error('Usage: node import-statement.js <path-to-pdf> [profile-id]');
  console.error('Example: node import-statement.js ./data/statements/citi_dec.pdf');
  process.exit(1);
}

if (!profileId) {
  console.log('No profile ID provided. Using first available profile...');
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .limit(1);

  if (!profiles || profiles.length === 0) {
    console.error('No profiles found in database');
    process.exit(1);
  }

  console.log('Using profile:', profiles[0].display_name);

  importTransactions(pdfPath, profiles[0].id)
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nImport failed:', error.message);
      process.exit(1);
    });
} else {
  importTransactions(pdfPath, profileId)
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nImport failed:', error.message);
      process.exit(1);
    });
}
