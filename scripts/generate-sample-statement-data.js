import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return envVars;
  } catch (error) {
    console.error('Error reading .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function generateCitiTransactions(month, year) {
  const transactions = [
    { description: 'Amazon.com', amount: 127.43, type: 'expense', day: 3 },
    { description: 'Costco Wholesale', amount: 284.56, type: 'expense', day: 5 },
    { description: 'Shell Gas Station', amount: 52.18, type: 'expense', day: 7 },
    { description: 'Starbucks', amount: 6.75, type: 'expense', day: 8 },
    { description: 'Target', amount: 93.21, type: 'expense', day: 10 },
    { description: 'Netflix', amount: 15.99, type: 'expense', day: 12 },
    { description: 'Uber', amount: 24.30, type: 'expense', day: 14 },
    { description: 'Whole Foods', amount: 156.78, type: 'expense', day: 15 },
    { description: 'Apple.com/bill', amount: 9.99, type: 'expense', day: 18 },
    { description: 'Payment Thank You', amount: 450.00, type: 'income', day: 20 }
  ];

  return transactions.map(tx => ({
    ...tx,
    date: generateDate(year, month, tx.day),
    status: 'posted'
  }));
}

function generateAmexTransactions(month, year) {
  const transactions = [
    { description: 'Delta Air Lines', amount: 387.50, type: 'expense', day: 2 },
    { description: 'Hilton Hotels', amount: 245.80, type: 'expense', day: 3 },
    { description: 'The Cheesecake Factory', amount: 67.45, type: 'expense', day: 6 },
    { description: 'Apple Store', amount: 1299.00, type: 'expense', day: 9 },
    { description: 'Nordstrom', amount: 198.34, type: 'expense', day: 11 },
    { description: 'Whole Foods Market', amount: 124.56, type: 'expense', day: 13 },
    { description: 'Uber', amount: 45.20, type: 'expense', day: 16 },
    { description: 'AMC Theatres', amount: 32.00, type: 'expense', day: 18 },
    { description: 'Best Buy', amount: 345.67, type: 'expense', day: 22 }
  ];

  return transactions.map(tx => ({
    ...tx,
    date: generateDate(year, month, tx.day),
    status: 'posted'
  }));
}

function generateICCUTransactions(month, year) {
  const transactions = [
    { description: 'Direct Deposit - Salary', amount: 3500.00, type: 'income', day: 1 },
    { description: 'Mortgage Payment', amount: 1850.00, type: 'expense', day: 2 },
    { description: 'Idaho Power', amount: 145.32, type: 'expense', day: 5 },
    { description: 'Verizon Wireless', amount: 125.00, type: 'expense', day: 7 },
    { description: 'Fred Meyer', amount: 234.67, type: 'expense', day: 9 },
    { description: 'Albertsons', amount: 156.43, type: 'expense', day: 12 },
    { description: 'Shell', amount: 48.90, type: 'expense', day: 14 },
    { description: 'Direct Deposit - Salary', amount: 3500.00, type: 'income', day: 15 },
    { description: 'ATM Withdrawal', amount: 200.00, type: 'expense', day: 17 },
    { description: 'State Farm Insurance', amount: 185.00, type: 'expense', day: 19 },
    { description: 'Winco Foods', amount: 98.76, type: 'expense', day: 21 },
    { description: 'Chevron', amount: 52.30, type: 'expense', day: 24 }
  ];

  return transactions.map(tx => ({
    ...tx,
    date: generateDate(year, month, tx.day),
    status: 'posted'
  }));
}

async function generateAndCacheStatements() {
  console.log('\n' + '='.repeat(60));
  console.log('GENERATING SAMPLE STATEMENT DATA');
  console.log('='.repeat(60) + '\n');

  await supabase.from('statement_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared existing statement cache\n');

  const { data: institutions } = await supabase
    .from('financial_institutions')
    .select('id, name');

  const institutionMap = {};
  institutions.forEach(inst => {
    institutionMap[inst.name] = inst.id;
  });

  const months = [
    { name: 'sep', num: 9 },
    { name: 'oct', num: 10 },
    { name: 'nov', num: 11 },
    { name: 'dec', num: 12 }
  ];
  const year = 2024;

  const statements = [];

  for (const month of months) {
    const citiTransactions = generateCitiTransactions(month.num, year);
    const amexTransactions = generateAmexTransactions(month.num, year);
    const iccuTransactions = generateICCUTransactions(month.num, year);

    const citiDebits = citiTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const citiCredits = citiTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

    const amexDebits = amexTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const amexCredits = amexTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

    const iccuDebits = iccuTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const iccuCredits = iccuTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

    statements.push({
      institution_id: institutionMap['Citibank'],
      institution_name: 'Citibank',
      account_type: 'credit',
      account_number_last4: '4532',
      statement_month: month.name,
      statement_year: year,
      transactions_data: citiTransactions,
      transaction_count: citiTransactions.length,
      total_debits: citiDebits.toFixed(2),
      total_credits: citiCredits.toFixed(2),
      file_name: `citi_${month.name}.pdf`
    });

    statements.push({
      institution_id: institutionMap['American Express'],
      institution_name: 'American Express',
      account_type: 'credit',
      account_number_last4: '1008',
      statement_month: month.name,
      statement_year: year,
      transactions_data: amexTransactions,
      transaction_count: amexTransactions.length,
      total_debits: amexDebits.toFixed(2),
      total_credits: amexCredits.toFixed(2),
      file_name: `amex_${month.name}.pdf`
    });

    statements.push({
      institution_id: institutionMap['Idaho Central Credit Union'],
      institution_name: 'Idaho Central Credit Union',
      account_type: 'checking',
      account_number_last4: '7890',
      statement_month: month.name,
      statement_year: year,
      transactions_data: iccuTransactions,
      transaction_count: iccuTransactions.length,
      total_debits: iccuDebits.toFixed(2),
      total_credits: iccuCredits.toFixed(2),
      file_name: `iccu_${month.name}.pdf`
    });
  }

  console.log(`Inserting ${statements.length} statement records...\n`);

  for (const statement of statements) {
    const { error } = await supabase
      .from('statement_cache')
      .insert(statement);

    if (error) {
      console.error(`Error caching ${statement.file_name}:`, error.message);
    } else {
      console.log(`Cached ${statement.file_name}: ${statement.transaction_count} transactions`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('GENERATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total statements cached: ${statements.length}`);
  console.log('\nStatements by Institution:');
  console.log('  Citibank (credit): 4 months');
  console.log('  American Express (credit): 4 months');
  console.log('  Idaho Central Credit Union (checking): 4 months');
  console.log('='.repeat(60) + '\n');
  console.log('Bank simulation ready!\n');
}

generateAndCacheStatements().catch(console.error);
