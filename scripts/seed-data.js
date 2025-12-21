import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import * as readline from 'readline';
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
    console.error('❌ Error reading .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatDate(date) {
  return format(date, 'yyyy-MM-dd');
}

function generateUUID() {
  return crypto.randomUUID();
}

async function promptConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n⚠️  WARNING: This will DELETE ALL existing transactions and accounts!\nType "DELETE" to confirm: ', (answer) => {
      rl.close();
      resolve(answer === 'DELETE');
    });
  });
}

async function cleanupDatabase() {
  console.log('\n🗑️  Starting database cleanup...\n');

  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  const { count: accountCount } = await supabase.from('bank_accounts').select('*', { count: 'exact', head: true });

  console.log(`Found ${txCount || 0} transactions`);
  console.log(`Found ${accountCount || 0} bank accounts`);

  await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted transactions');

  await supabase.from('bank_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted bank accounts');

  console.log('✓ Preserved user categories (auto-provisioned on signup)');

  console.log('\n✅ Database cleanup complete!\n');
}

async function createBankAccounts(userId) {
  console.log('🏦 Creating 3 bank accounts...');

  const accounts = [
    {
      account_name: 'Chase Checking',
      account_type: 'checking',
      institution: 'Chase Bank',
      account_number: '****4523',
      current_balance: 5234.50,
      is_active: true,
      start_date: '2025-01-15',
      user_id: userId
    },
    {
      account_name: 'Wells Fargo Savings',
      account_type: 'savings',
      institution: 'Wells Fargo',
      account_number: '****8901',
      current_balance: 15780.00,
      is_active: true,
      start_date: '2025-01-10',
      user_id: userId
    },
    {
      account_name: 'Chase Sapphire Reserve',
      account_type: 'credit',
      institution: 'Chase Bank',
      account_number: '****5678',
      current_balance: -2456.89,
      is_active: true,
      start_date: '2024-06-01',
      user_id: userId
    }
  ];

  const { data, error } = await supabase
    .from('bank_accounts')
    .insert(accounts)
    .select();

  if (error) throw error;

  const accountMap = {};
  data.forEach(acc => {
    accountMap[acc.account_name] = acc.id;
  });

  console.log(`✓ Created ${data.length} bank accounts`);
  return accountMap;
}

async function generatePostedTransactions(accountMap, userId) {
  console.log('💰 Generating 60 posted transactions (20 per account, uncategorized from Plaid)...');

  const transactions = [];
  const checkingId = accountMap['Chase Checking'];
  const savingsId = accountMap['Wells Fargo Savings'];
  const creditCardId = accountMap['Chase Sapphire Reserve'];

  const checkingTransactions = [
    { date: '2025-12-01', description: 'Paycheck Deposit', amount: 3500.00 },
    { date: '2025-12-02', description: 'Rent Payment', amount: -1800.00 },
    { date: '2025-12-03', description: 'PG&E - Electric Bill', amount: -145.67 },
    { date: '2025-12-03', description: 'AT&T Internet', amount: -79.99 },
    { date: '2025-12-04', description: 'WHOLE FOODS MKT #123', amount: -127.45 },
    { date: '2025-12-05', description: 'SHELL GAS STATION', amount: -52.30 },
    { date: '2025-12-06', description: 'STARBUCKS', amount: -8.45 },
    { date: '2025-12-07', description: 'SAFEWAY STORE', amount: -89.23 },
    { date: '2025-12-08', description: 'CVS PHARMACY', amount: -34.56 },
    { date: '2025-12-08', description: 'Transfer to Savings', amount: -500.00 },
    { date: '2025-12-09', description: 'CHEVRON GAS', amount: -48.90 },
    { date: '2025-12-10', description: 'CHIPOTLE MEXICAN GRILL', amount: -23.45 },
    { date: '2025-12-11', description: 'TARGET STORE', amount: -78.34 },
    { date: '2025-12-11', description: 'Verizon Mobile', amount: -119.99 },
    { date: '2025-12-12', description: 'UBER TRIP', amount: -28.50 },
    { date: '2025-12-13', description: 'TRADER JOES', amount: -65.78 },
    { date: '2025-12-14', description: 'Credit Card Payment', amount: -850.00 },
    { date: '2025-12-15', description: 'Paycheck Deposit', amount: 3500.00 },
    { date: '2025-12-15', description: 'COSTCO WHOLESALE', amount: -156.89 },
    { date: '2025-12-16', description: 'OLIVE GARDEN', amount: -67.23 }
  ];

  const savingsTransactions = [
    { date: '2025-11-30', description: 'Interest Payment', amount: 12.45 },
    { date: '2025-12-01', description: 'Transfer from Checking', amount: 1000.00 },
    { date: '2025-12-03', description: 'Transfer from Checking', amount: 500.00 },
    { date: '2025-12-05', description: 'ATM Withdrawal', amount: -200.00 },
    { date: '2025-12-07', description: 'Transfer from Checking', amount: 750.00 },
    { date: '2025-12-08', description: 'Transfer from Checking', amount: 500.00 },
    { date: '2025-12-10', description: 'Mobile Deposit', amount: 250.00 },
    { date: '2025-12-11', description: 'Transfer to Checking', amount: -300.00 },
    { date: '2025-12-12', description: 'Dividend Payment', amount: 45.67 },
    { date: '2025-12-13', description: 'Wire Transfer Fee', amount: -15.00 },
    { date: '2025-12-14', description: 'Transfer from Checking', amount: 600.00 },
    { date: '2025-12-15', description: 'ATM Withdrawal', amount: -100.00 },
    { date: '2025-12-15', description: 'Interest Payment', amount: 11.23 },
    { date: '2025-12-16', description: 'Transfer from Checking', amount: 400.00 },
    { date: '2025-12-16', description: 'Check Deposit', amount: 500.00 },
    { date: '2025-12-17', description: 'Transfer from Checking', amount: 350.00 },
    { date: '2025-12-17', description: 'Monthly Service Fee', amount: -5.00 },
    { date: '2025-12-18', description: 'Transfer from Checking', amount: 800.00 },
    { date: '2025-12-18', description: 'Cashback Reward', amount: 25.00 },
    { date: '2025-12-19', description: 'Transfer from Checking', amount: 300.00 }
  ];

  const creditCardTransactions = [
    { date: '2025-12-01', description: 'AMAZON.COM*XY98ZW', amount: -89.45 },
    { date: '2025-12-02', description: 'NETFLIX.COM', amount: -15.49 },
    { date: '2025-12-02', description: 'SPOTIFY', amount: -9.99 },
    { date: '2025-12-03', description: 'STARBUCKS COFFEE', amount: -12.34 },
    { date: '2025-12-04', description: 'APPLE.COM/BILL', amount: -24.99 },
    { date: '2025-12-05', description: 'UBER EATS', amount: -34.56 },
    { date: '2025-12-06', description: 'AMC THEATERS', amount: -45.00 },
    { date: '2025-12-07', description: 'BEST BUY', amount: -234.99 },
    { date: '2025-12-08', description: 'PANERA BREAD', amount: -18.67 },
    { date: '2025-12-09', description: 'LYFT RIDE', amount: -22.50 },
    { date: '2025-12-10', description: 'NORDSTROM', amount: -156.78 },
    { date: '2025-12-11', description: 'DOORDASH', amount: -42.34 },
    { date: '2025-12-12', description: 'HULU', amount: -14.99 },
    { date: '2025-12-13', description: 'LULULEMON', amount: -128.00 },
    { date: '2025-12-14', description: 'Payment Received - Thank You', amount: 850.00 },
    { date: '2025-12-14', description: 'CHEESECAKE FACTORY', amount: -67.89 },
    { date: '2025-12-15', description: 'AMAZON PRIME', amount: -14.99 },
    { date: '2025-12-16', description: 'WALGREENS', amount: -28.45 },
    { date: '2025-12-16', description: 'PANDA EXPRESS', amount: -19.50 },
    { date: '2025-12-17', description: 'GAS STATION', amount: -55.00 }
  ];

  checkingTransactions.forEach((tx, index) => {
    transactions.push({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.amount < 0 ? 'expense' : 'income',
      status: 'posted',
      category_id: null,
      bank_account_id: checkingId,
      payment_method: null,
      transfer_pair_id: null,
      plaid_transaction_id: `plaid_chk_${Date.now()}_${index}`,
      user_id: userId
    });
  });

  savingsTransactions.forEach((tx, index) => {
    transactions.push({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.amount < 0 ? 'expense' : 'income',
      status: 'posted',
      category_id: null,
      bank_account_id: savingsId,
      payment_method: null,
      transfer_pair_id: null,
      plaid_transaction_id: `plaid_sav_${Date.now()}_${index}`,
      user_id: userId
    });
  });

  creditCardTransactions.forEach((tx, index) => {
    transactions.push({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.amount < 0 ? 'expense' : 'income',
      status: 'posted',
      category_id: null,
      bank_account_id: creditCardId,
      payment_method: null,
      transfer_pair_id: null,
      plaid_transaction_id: `plaid_cc_${Date.now()}_${index}`,
      user_id: userId
    });
  });

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) throw error;

  console.log(`✓ Created ${data.length} posted transactions`);
  return data;
}

async function generatePendingTransactions(accountMap, userId) {
  console.log('⏳ Generating 30 pending transactions (10 per account, uncategorized from Plaid)...');

  const transactions = [];
  const checkingId = accountMap['Chase Checking'];
  const savingsId = accountMap['Wells Fargo Savings'];
  const creditCardId = accountMap['Chase Sapphire Reserve'];

  const checkingPendingTransactions = [
    { date: '2025-12-18', description: 'WHOLE FOODS PENDING', amount: -95.67 },
    { date: '2025-12-18', description: 'SHELL GAS', amount: -58.34 },
    { date: '2025-12-19', description: 'Transfer to Savings', amount: -400.00 },
    { date: '2025-12-19', description: 'STARBUCKS', amount: -9.25 },
    { date: '2025-12-19', description: 'SAFEWAY', amount: -112.45 },
    { date: '2025-12-20', description: 'Credit Card Payment', amount: -650.00 },
    { date: '2025-12-20', description: 'Transfer to Savings', amount: -300.00 },
    { date: '2025-12-20', description: 'CVS PHARMACY', amount: -42.89 },
    { date: '2025-12-20', description: 'Credit Card Payment', amount: -500.00 },
    { date: '2025-12-20', description: 'CHIPOTLE', amount: -26.78 }
  ];

  const savingsPendingTransactions = [
    { date: '2025-12-18', description: 'Interest Accrual', amount: 8.34 },
    { date: '2025-12-19', description: 'Transfer from Checking', amount: 400.00 },
    { date: '2025-12-19', description: 'Dividend Payment', amount: 32.50 },
    { date: '2025-12-19', description: 'ATM Withdrawal', amount: -80.00 },
    { date: '2025-12-20', description: 'Transfer from Checking', amount: 300.00 },
    { date: '2025-12-20', description: 'Mobile Deposit', amount: 175.00 },
    { date: '2025-12-20', description: 'Check Deposit', amount: 425.00 },
    { date: '2025-12-20', description: 'Cashback Bonus', amount: 15.00 },
    { date: '2025-12-20', description: 'Transfer to Checking', amount: -250.00 },
    { date: '2025-12-20', description: 'Wire Transfer', amount: 500.00 }
  ];

  const creditCardPendingTransactions = [
    { date: '2025-12-18', description: 'AMAZON.COM*AB12CD', amount: -78.99 },
    { date: '2025-12-18', description: 'TARGET', amount: -92.34 },
    { date: '2025-12-19', description: 'UBER EATS', amount: -38.67 },
    { date: '2025-12-19', description: 'BEST BUY', amount: -189.99 },
    { date: '2025-12-19', description: 'STARBUCKS', amount: -11.50 },
    { date: '2025-12-20', description: 'Payment Received', amount: 650.00 },
    { date: '2025-12-20', description: 'DOORDASH', amount: -45.78 },
    { date: '2025-12-20', description: 'Payment Received', amount: 500.00 },
    { date: '2025-12-20', description: 'NORDSTROM', amount: -145.00 },
    { date: '2025-12-20', description: 'PANERA BREAD', amount: -21.34 }
  ];

  checkingPendingTransactions.forEach((tx, index) => {
    transactions.push({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.amount < 0 ? 'expense' : 'income',
      status: 'pending',
      category_id: null,
      bank_account_id: checkingId,
      payment_method: null,
      transfer_pair_id: null,
      plaid_transaction_id: `plaid_chk_pend_${Date.now()}_${index}`,
      user_id: userId
    });
  });

  savingsPendingTransactions.forEach((tx, index) => {
    transactions.push({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.amount < 0 ? 'expense' : 'income',
      status: 'pending',
      category_id: null,
      bank_account_id: savingsId,
      payment_method: null,
      transfer_pair_id: null,
      plaid_transaction_id: `plaid_sav_pend_${Date.now()}_${index}`,
      user_id: userId
    });
  });

  creditCardPendingTransactions.forEach((tx, index) => {
    transactions.push({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.amount < 0 ? 'expense' : 'income',
      status: 'pending',
      category_id: null,
      bank_account_id: creditCardId,
      payment_method: null,
      transfer_pair_id: null,
      plaid_transaction_id: `plaid_cc_pend_${Date.now()}_${index}`,
      user_id: userId
    });
  });

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) throw error;

  console.log(`✓ Created ${data.length} pending transactions`);
  return data;
}

async function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SEED DATA SUMMARY');
  console.log('='.repeat(60) + '\n');

  const { count: accountCount } = await supabase.from('bank_accounts').select('*', { count: 'exact', head: true });
  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  const { count: postedCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'posted');
  const { count: pendingCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: uncategorizedCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).is('category_id', null);

  console.log(`🏦 Bank Accounts:           ${accountCount}`);
  console.log(`   ├─ Checking:             1`);
  console.log(`   ├─ Savings:              1`);
  console.log(`   └─ Credit Card:          1`);
  console.log(`\n💰 Transactions:            ${txCount}`);
  console.log(`   ├─ Posted:              ${postedCount}`);
  console.log(`   └─ Pending:             ${pendingCount}`);
  console.log(`\n📋 Categorization Status:`);
  console.log(`   ├─ Uncategorized:       ${uncategorizedCount} (imported from Plaid)`);
  console.log(`   └─ All transactions need categorization!`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Seed data generation complete!');
  console.log('🚀 All transactions are uncategorized - test auto-categorization!');
  console.log('💡 Look for transfers with matching amounts/dates to test matching');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('🌱 BASE44 SIMPLIFIED FINANCIAL DATA SEEDER');
  console.log('='.repeat(60));
  console.log(`📅 Seed date range: December 2025`);
  console.log('='.repeat(60));

  const userId = '0056b95c-7bbc-49dc-920b-b0e6e628986d';
  const userEmail = 'petersonandrew@hotmail.com';

  console.log(`👤 Seeding data for: ${userEmail} (${userId})\n`);

  const confirmed = await promptConfirmation();

  if (!confirmed) {
    console.log('\n❌ Seed operation cancelled.\n');
    process.exit(0);
  }

  try {
    await cleanupDatabase();

    const accountMap = await createBankAccounts(userId);

    await generatePostedTransactions(accountMap, userId);
    await generatePendingTransactions(accountMap, userId);

    await printSummary();

    const endTime = Date.now();
    console.log(`⏱️  Execution time: ${((endTime - startTime) / 1000).toFixed(2)}s\n`);

  } catch (error) {
    console.error('\n❌ Error during seed operation:', error);
    process.exit(1);
  }
}

main();
