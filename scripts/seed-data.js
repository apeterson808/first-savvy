import { createClient } from '@supabase/supabase-js';
import { format, subMonths, addDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
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

const TODAY = new Date('2025-12-16');
const START_DATE = subMonths(TODAY, 6);

function formatDate(date) {
  return format(date, 'yyyy-MM-dd');
}

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
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
    rl.question('\n⚠️  WARNING: This will DELETE ALL existing financial data!\nType "DELETE" to confirm: ', (answer) => {
      rl.close();
      resolve(answer === 'DELETE');
    });
  });
}

async function cleanupDatabase() {
  console.log('\n🗑️  Starting database cleanup...\n');

  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  const { count: accountCount } = await supabase.from('bank_accounts').select('*', { count: 'exact', head: true });
  const { count: assetCount } = await supabase.from('assets').select('*', { count: 'exact', head: true });
  const { count: liabilityCount } = await supabase.from('liabilities').select('*', { count: 'exact', head: true });
  const { count: budgetCount } = await supabase.from('budgets').select('*', { count: 'exact', head: true });
  const { count: categoryCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  const { count: contactCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
  const { count: scoreCount } = await supabase.from('credit_scores').select('*', { count: 'exact', head: true });

  console.log(`Found ${txCount || 0} transactions`);
  console.log(`Found ${accountCount || 0} bank accounts`);
  console.log(`Found ${assetCount || 0} assets`);
  console.log(`Found ${liabilityCount || 0} liabilities`);
  console.log(`Found ${budgetCount || 0} budgets`);
  console.log(`Found ${categoryCount || 0} categories`);
  console.log(`Found ${contactCount || 0} contacts`);
  console.log(`Found ${scoreCount || 0} credit scores`);

  await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted transactions');

  await supabase.from('budgets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted budgets');

  await supabase.from('budget_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted budget groups');

  await supabase.from('categorization_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted categorization rules');

  await supabase.from('credit_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted credit scores');

  await supabase.from('bank_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted bank accounts');

  await supabase.from('assets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted assets');

  await supabase.from('liabilities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted liabilities');

  await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted categories');

  await supabase.from('contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted contacts');

  console.log('\n✅ Database cleanup complete!\n');
}

function getTransferCategoryId(amount, categoryMap) {
  return amount < 0 ? categoryMap['Transfer Expense'] : categoryMap['Transfer Income'];
}

async function createCategories() {
  console.log('📁 Creating categories...');

  const categories = [
    { name: 'Salary', type: 'income', detail_type: 'income', icon: 'Briefcase', color: '#10b981' },
    { name: 'Wages', type: 'income', detail_type: 'income', icon: 'DollarSign', color: '#10b981' },
    { name: 'Bonus', type: 'income', detail_type: 'income', icon: 'Gift', color: '#10b981' },
    { name: 'Investment Income', type: 'income', detail_type: 'income', icon: 'TrendingUp', color: '#10b981' },
    { name: 'Refund', type: 'income', detail_type: 'income', icon: 'RotateCcw', color: '#10b981' },
    { name: 'Gift', type: 'income', detail_type: 'income', icon: 'Heart', color: '#10b981' },
    { name: 'Other Income', type: 'income', detail_type: 'income', icon: 'Plus', color: '#10b981' },

    { name: 'Groceries', type: 'expense', detail_type: 'expense', icon: 'ShoppingCart', color: '#ef4444' },
    { name: 'Dining', type: 'expense', detail_type: 'expense', icon: 'Utensils', color: '#f97316' },
    { name: 'Gas', type: 'expense', detail_type: 'expense', icon: 'Fuel', color: '#f59e0b' },
    { name: 'Transportation', type: 'expense', detail_type: 'expense', icon: 'Car', color: '#eab308' },
    { name: 'Utilities', type: 'expense', detail_type: 'expense', icon: 'Lightbulb', color: '#84cc16' },
    { name: 'Rent', type: 'expense', detail_type: 'expense', icon: 'Home', color: '#22c55e' },
    { name: 'Mortgage Payment', type: 'expense', detail_type: 'expense', icon: 'Home', color: '#22c55e' },
    { name: 'Shopping', type: 'expense', detail_type: 'expense', icon: 'ShoppingBag', color: '#06b6d4' },
    { name: 'Entertainment', type: 'expense', detail_type: 'expense', icon: 'Film', color: '#0ea5e9' },
    { name: 'Healthcare', type: 'expense', detail_type: 'expense', icon: 'Heart', color: '#3b82f6' },
    { name: 'Insurance', type: 'expense', detail_type: 'expense', icon: 'Shield', color: '#6366f1' },
    { name: 'Education', type: 'expense', detail_type: 'expense', icon: 'BookOpen', color: '#8b5cf6' },
    { name: 'Travel', type: 'expense', detail_type: 'expense', icon: 'Plane', color: '#a855f7' },
    { name: 'Personal Care', type: 'expense', detail_type: 'expense', icon: 'Sparkles', color: '#d946ef' },
    { name: 'Subscriptions', type: 'expense', detail_type: 'expense', icon: 'CreditCard', color: '#ec4899' },
    { name: 'Other Expense', type: 'expense', detail_type: 'expense', icon: 'Minus', color: '#f43f5e' },

    { name: 'Transfer', type: 'income', detail_type: 'transfer', icon: 'ArrowLeftRight', color: '#64748b' },
    { name: 'Transfer', type: 'expense', detail_type: 'transfer', icon: 'ArrowLeftRight', color: '#64748b' },
  ];

  const { data, error } = await supabase
    .from('categories')
    .insert(categories.map(cat => ({ ...cat, is_system: true })))
    .select();

  if (error) throw error;

  const categoryMap = {};
  data.forEach(cat => {
    if (cat.detail_type === 'transfer') {
      if (cat.type === 'income') {
        categoryMap['Transfer Income'] = cat.id;
      } else if (cat.type === 'expense') {
        categoryMap['Transfer Expense'] = cat.id;
      }
    } else {
      categoryMap[cat.name] = cat.id;
    }
  });

  console.log(`✓ Created ${data.length} categories`);
  return categoryMap;
}

async function createBankAccounts() {
  console.log('🏦 Creating bank accounts...');

  const accounts = [
    {
      account_name: 'Chase Checking',
      account_type: 'checking',
      institution: 'Chase Bank',
      account_number: '****4523',
      current_balance: 8500.00,
      is_active: true,
      start_date: '2025-01-15'
    },
    {
      account_name: 'Wells Fargo Savings',
      account_type: 'savings',
      institution: 'Wells Fargo',
      account_number: '****8901',
      current_balance: 25000.00,
      is_active: true,
      start_date: '2025-01-10'
    },
    {
      account_name: 'Ally High-Yield Savings',
      account_type: 'savings',
      institution: 'Ally Bank',
      account_number: '****3344',
      current_balance: 15000.00,
      is_active: true,
      start_date: '2025-02-01'
    },
    {
      account_name: 'Chase Sapphire Reserve',
      account_type: 'credit',
      institution: 'Chase Bank',
      account_number: '****5678',
      current_balance: -3200.00,
      is_active: true,
      start_date: '2024-06-01'
    },
    {
      account_name: 'Citi Double Cash',
      account_type: 'credit',
      institution: 'Citibank',
      account_number: '****9012',
      current_balance: -1450.00,
      is_active: true,
      start_date: '2024-08-15'
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

async function createAssets() {
  console.log('📈 Creating investment assets...');

  const assets = [
    {
      name: 'Vanguard 401(k)',
      type: 'retirement',
      institution: 'Vanguard',
      current_value: 125000.00,
      purchase_date: '2020-01-01',
      description: '401(k) Retirement Account',
      is_active: true
    },
    {
      name: 'Fidelity Roth IRA',
      type: 'retirement',
      institution: 'Fidelity',
      current_value: 45000.00,
      purchase_date: '2021-03-15',
      description: 'Roth IRA',
      is_active: true
    },
    {
      name: 'Robinhood Stocks',
      type: 'brokerage',
      institution: 'Robinhood',
      current_value: 12500.00,
      purchase_date: '2023-01-10',
      description: 'Individual Brokerage Account',
      is_active: true
    }
  ];

  const { data, error } = await supabase
    .from('assets')
    .insert(assets)
    .select();

  if (error) throw error;

  const assetMap = {};
  data.forEach(asset => {
    assetMap[asset.name] = asset.id;
  });

  console.log(`✓ Created ${data.length} assets`);
  return assetMap;
}

async function createLiabilities() {
  console.log('🏠 Creating liabilities...');

  const liabilities = [
    {
      name: 'Home Mortgage',
      type: 'mortgage',
      institution: 'Wells Fargo Home Mortgage',
      current_balance: 285000.00,
      interest_rate: 3.75,
      minimum_payment: 1650.00,
      due_date: '2026-01-01',
      is_active: true
    },
    {
      name: 'Honda CR-V Loan',
      type: 'auto_loan',
      institution: 'Honda Financial',
      current_balance: 18500.00,
      interest_rate: 4.25,
      minimum_payment: 425.00,
      due_date: '2026-01-22',
      is_active: true
    }
  ];

  const { data, error } = await supabase
    .from('liabilities')
    .insert(liabilities)
    .select();

  if (error) throw error;

  const liabilityMap = {};
  data.forEach(liability => {
    liabilityMap[liability.name] = liability.id;
  });

  console.log(`✓ Created ${data.length} liabilities`);
  return liabilityMap;
}

async function createContacts() {
  console.log('👥 Creating contacts...');

  const contacts = [
    { name: 'Whole Foods Market', type: 'business', email: 'customer@wholefoods.com', notes: 'Primary grocery store' },
    { name: 'Shell Gas Station', type: 'business', email: 'support@shell.com', notes: 'Regular gas station' },
    { name: 'Amazon', type: 'business', email: 'customer-service@amazon.com', notes: 'Online shopping' },
    { name: 'Netflix', type: 'business', email: 'support@netflix.com', notes: 'Streaming subscription' },
    { name: 'AT&T', type: 'business', phone: '800-288-2020', notes: 'Internet and phone provider' },
    { name: 'Starbucks', type: 'business', email: 'support@starbucks.com', notes: 'Coffee shop' },
    { name: 'John Smith', type: 'person', email: 'john.smith@email.com', phone: '555-0101', notes: 'Friend' },
    { name: 'Sarah Johnson', type: 'person', email: 'sarah.j@email.com', phone: '555-0102', notes: 'Colleague' },
  ];

  const { data, error } = await supabase
    .from('contacts')
    .insert(contacts)
    .select();

  if (error) throw error;

  const contactMap = {};
  data.forEach(contact => {
    contactMap[contact.name] = contact.id;
  });

  console.log(`✓ Created ${data.length} contacts`);
  return contactMap;
}

async function generatePostedTransactions(accountMap, categoryMap, contactMap) {
  console.log('💰 Generating posted transactions (June-November 2025)...');

  const transactions = [];
  const checkingId = accountMap['Chase Checking'];
  const savingsId = accountMap['Wells Fargo Savings'];
  const allySavingsId = accountMap['Ally High-Yield Savings'];
  const sapphireId = accountMap['Chase Sapphire Reserve'];
  const citiId = accountMap['Citi Double Cash'];

  const monthStart = new Date('2025-06-15');
  const monthEnd = new Date('2025-11-30');

  const merchants = [
    { name: 'WHOLE FOODS MKT #123', category: 'Groceries', amount: [80, 150], paymentMethod: 'debit_card', contactName: 'Whole Foods Market' },
    { name: 'SAFEWAY STORE #456', category: 'Groceries', amount: [60, 120], paymentMethod: 'debit_card', contactName: null },
    { name: 'TRADER JOES #789', category: 'Groceries', amount: [45, 90], paymentMethod: 'debit_card', contactName: null },
    { name: 'SHELL OIL', category: 'Gas', amount: [45, 65], paymentMethod: 'debit_card', contactName: 'Shell Gas Station' },
    { name: 'CHEVRON STATION', category: 'Gas', amount: [50, 70], paymentMethod: 'debit_card', contactName: null },
    { name: 'STARBUCKS #1234', category: 'Dining', amount: [5, 15], paymentMethod: 'credit_card', contactName: 'Starbucks' },
    { name: 'CHIPOTLE MEXICAN', category: 'Dining', amount: [12, 25], paymentMethod: 'credit_card', contactName: null },
    { name: 'OLIVE GARDEN', category: 'Dining', amount: [40, 80], paymentMethod: 'credit_card', contactName: null },
    { name: 'TARGET STORE #123', category: 'Shopping', amount: [30, 150], paymentMethod: 'credit_card', contactName: null },
    { name: 'AMAZON.COM*AB12CD', category: 'Shopping', amount: [25, 200], paymentMethod: 'credit_card', contactName: 'Amazon' },
    { name: 'AMC THEATERS', category: 'Entertainment', amount: [30, 60], paymentMethod: 'credit_card', contactName: null },
    { name: 'SPOTIFY', category: 'Subscriptions', amount: [9.99, 9.99], paymentMethod: 'credit_card', contactName: 'Netflix' },
  ];

  for (let month = 0; month < 6; month++) {
    const currentMonth = new Date(2025, 5 + month, 1);
    const endOfCurrentMonth = endOfMonth(currentMonth);

    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 1)),
      description: 'Rent Payment',
      amount: -2200.00,
      type: 'expense',
      status: 'posted',
      category_id: categoryMap['Rent'],
      bank_account_id: checkingId,
      payment_method: 'check'
    });

    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 15)),
      description: 'PG&E - Utilities',
      amount: -randomAmount(150, 200),
      type: 'expense',
      status: 'posted',
      category_id: categoryMap['Utilities'],
      bank_account_id: checkingId,
      payment_method: 'bank_transfer'
    });

    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 10)),
      description: 'AT&T Internet',
      amount: -79.99,
      type: 'expense',
      status: 'posted',
      category_id: categoryMap['Utilities'],
      bank_account_id: checkingId,
      payment_method: 'bank_transfer',
      contact_id: contactMap['AT&T']
    });

    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 12)),
      description: 'Verizon Mobile',
      amount: -119.99,
      type: 'expense',
      status: 'posted',
      category_id: categoryMap['Utilities'],
      bank_account_id: checkingId,
      payment_method: 'bank_transfer'
    });

    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 1)),
      description: 'Paycheck Deposit',
      amount: 6500.00,
      type: 'income',
      status: 'posted',
      category_id: categoryMap['Salary'],
      bank_account_id: checkingId,
      payment_method: 'direct_deposit'
    });

    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 15)),
      description: 'Paycheck Deposit',
      amount: 6500.00,
      type: 'income',
      status: 'posted',
      category_id: categoryMap['Salary'],
      bank_account_id: checkingId,
      payment_method: 'direct_deposit'
    });

    for (let i = 0; i < 15; i++) {
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      const txDate = randomDate(currentMonth, endOfCurrentMonth);
      const accountId = merchant.paymentMethod === 'credit_card'
        ? (Math.random() > 0.5 ? sapphireId : citiId)
        : checkingId;

      const transaction = {
        date: formatDate(txDate),
        description: merchant.name,
        amount: -randomAmount(merchant.amount[0], merchant.amount[1]),
        type: 'expense',
        status: 'posted',
        category_id: categoryMap[merchant.category],
        bank_account_id: accountId,
        payment_method: merchant.paymentMethod
      };

      if (merchant.contactName && contactMap[merchant.contactName]) {
        transaction.contact_id = contactMap[merchant.contactName];
      }

      transactions.push(transaction);
    }

    transactions.push({
      date: formatDate(endOfCurrentMonth),
      description: 'Interest Payment',
      amount: randomAmount(8, 15),
      type: 'income',
      status: 'posted',
      category_id: categoryMap['Investment Income'],
      bank_account_id: savingsId,
      payment_method: 'bank_transfer'
    });
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) throw error;

  console.log(`✓ Created ${data.length} posted transactions`);
  return data;
}

async function generatePendingTransactions(accountMap, categoryMap, contactMap) {
  console.log('⏳ Generating pending December transactions with AI suggestions...');

  const transactions = [];
  const checkingId = accountMap['Chase Checking'];
  const sapphireId = accountMap['Chase Sapphire Reserve'];
  const citiId = accountMap['Citi Double Cash'];

  const decemberStart = new Date('2025-12-01');
  const decemberEnd = new Date('2025-12-16');

  const pendingMerchants = [
    { name: 'WHOLE FOODS MKT #123', suggestedCategory: 'Groceries', amount: [80, 150], contactName: 'Whole Foods Market' },
    { name: 'SHELL OIL 12345', suggestedCategory: 'Gas', amount: [55, 65], contactName: 'Shell Gas Station' },
    { name: 'STARBUCKS COFFEE', suggestedCategory: 'Dining', amount: [6, 14], contactName: 'Starbucks' },
    { name: 'AMAZON.COM*XY98ZW', suggestedCategory: 'Shopping', amount: [45, 180], contactName: 'Amazon' },
    { name: 'CHIPOTLE #456', suggestedCategory: 'Dining', amount: [15, 28], contactName: null },
    { name: 'TARGET T-1234', suggestedCategory: 'Shopping', amount: [50, 120], contactName: null },
    { name: 'NETFLIX.COM', suggestedCategory: 'Subscriptions', amount: [15.49, 15.49], contactName: 'Netflix' },
    { name: 'CVS PHARMACY', suggestedCategory: 'Healthcare', amount: [20, 60], contactName: null },
    { name: 'UBER *TRIP', suggestedCategory: 'Transportation', amount: [12, 35], contactName: null },
    { name: 'SPOTIFY USA', suggestedCategory: 'Subscriptions', amount: [9.99, 9.99], contactName: null },
  ];

  for (let i = 0; i < 25; i++) {
    const merchant = pendingMerchants[Math.floor(Math.random() * pendingMerchants.length)];
    const txDate = randomDate(decemberStart, decemberEnd);
    const accountId = Math.random() > 0.4
      ? (Math.random() > 0.5 ? sapphireId : citiId)
      : checkingId;

    const useAISuggestion = Math.random() > 0.25;

    const transaction = {
      date: formatDate(txDate),
      description: merchant.name,
      amount: -randomAmount(merchant.amount[0], merchant.amount[1]),
      type: 'expense',
      status: 'pending',
      category_id: null,
      ai_suggested_category_id: useAISuggestion ? categoryMap[merchant.suggestedCategory] : null,
      bank_account_id: accountId,
      payment_method: accountId === checkingId ? 'debit_card' : 'credit_card'
    };

    if (merchant.contactName && contactMap[merchant.contactName]) {
      transaction.contact_id = contactMap[merchant.contactName];
    }

    transactions.push(transaction);
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) throw error;

  console.log(`✓ Created ${data.length} pending transactions with AI suggestions`);
  return data;
}

async function generateInvestmentTransactions(assetMap, categoryMap, accountMap) {
  console.log('📊 Generating investment-related transactions (all posted)...');

  const transactions = [];
  const checkingId = accountMap['Chase Checking'];

  for (let month = 0; month < 7; month++) {
    const currentMonth = new Date(2025, 5 + month, 1);

    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 5)),
      description: 'Dividend Payment - VTSAX',
      amount: randomAmount(80, 150),
      type: 'income',
      status: 'posted',
      category_id: categoryMap['Investment Income'],
      bank_account_id: checkingId,
      payment_method: 'bank_transfer'
    });

    const contribution401k = -1000.00;
    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 15)),
      description: '401(k) Contribution (Payroll Deduction)',
      amount: contribution401k,
      type: 'expense',
      status: 'posted',
      category_id: categoryMap['Other Expense'],
      bank_account_id: checkingId,
      payment_method: 'bank_transfer',
      notes: 'Automatic payroll deduction for retirement'
    });

    const contributionIRA = -500.00;
    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 10)),
      description: 'IRA Contribution',
      amount: contributionIRA,
      type: 'expense',
      status: 'posted',
      category_id: categoryMap['Other Expense'],
      bank_account_id: checkingId,
      payment_method: 'bank_transfer',
      notes: 'Roth IRA contribution'
    });
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) throw error;

  console.log(`✓ Created ${data.length} investment-related transactions`);
  return data;
}

async function generateTransferTransactions(accountMap, categoryMap) {
  console.log('🔄 Generating matched and unmatched transfer transactions...');

  const transactions = [];
  const checkingId = accountMap['Chase Checking'];
  const savingsId = accountMap['Wells Fargo Savings'];
  const allySavingsId = accountMap['Ally High-Yield Savings'];
  const sapphireId = accountMap['Chase Sapphire Reserve'];
  const citiId = accountMap['Citi Double Cash'];

  for (let month = 0; month < 6; month++) {
    const currentMonth = new Date(2025, 5 + month, 1);

    const transferPairId1 = generateUUID();
    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 10)),
      description: 'Transfer to Savings - Emergency Fund',
      amount: -500.00,
      type: 'transfer',
      status: 'posted',
      category_id: getTransferCategoryId(-500.00, categoryMap),
      bank_account_id: checkingId,
      payment_method: 'bank_transfer',
      transfer_pair_id: transferPairId1
    });
    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 10)),
      description: 'Transfer from Checking - Emergency Fund',
      amount: 500.00,
      type: 'transfer',
      status: 'posted',
      category_id: getTransferCategoryId(500.00, categoryMap),
      bank_account_id: savingsId,
      payment_method: 'bank_transfer',
      transfer_pair_id: transferPairId1
    });

    const transferPairId2 = generateUUID();
    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 20)),
      description: 'Transfer to Ally Savings',
      amount: -1000.00,
      type: 'transfer',
      status: 'posted',
      category_id: getTransferCategoryId(-1000.00, categoryMap),
      bank_account_id: checkingId,
      payment_method: 'bank_transfer',
      transfer_pair_id: transferPairId2
    });
    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 20)),
      description: 'Transfer from Checking',
      amount: 1000.00,
      type: 'transfer',
      status: 'posted',
      category_id: getTransferCategoryId(1000.00, categoryMap),
      bank_account_id: allySavingsId,
      payment_method: 'bank_transfer',
      transfer_pair_id: transferPairId2
    });

    const ccPaymentPairId = generateUUID();
    const paymentAmount = randomAmount(1000, 1500);
    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 14)),
      description: 'Credit Card Payment - Chase Sapphire',
      amount: -paymentAmount,
      type: 'transfer',
      status: 'posted',
      category_id: getTransferCategoryId(-paymentAmount, categoryMap),
      bank_account_id: checkingId,
      payment_method: 'bank_transfer',
      transfer_pair_id: ccPaymentPairId
    });
    transactions.push({
      date: formatDate(new Date(2025, 5 + month, 14)),
      description: 'Payment Received - Thank You',
      amount: paymentAmount,
      type: 'transfer',
      status: 'posted',
      category_id: getTransferCategoryId(paymentAmount, categoryMap),
      bank_account_id: sapphireId,
      payment_method: 'bank_transfer',
      transfer_pair_id: ccPaymentPairId
    });
  }

  transactions.push({
    date: '2025-08-15',
    description: 'Transfer to Savings',
    amount: -750.00,
    type: 'transfer',
    status: 'posted',
    category_id: getTransferCategoryId(-750.00, categoryMap),
    bank_account_id: checkingId,
    payment_method: 'bank_transfer',
    transfer_pair_id: null
  });
  transactions.push({
    date: '2025-08-15',
    description: 'Deposit from Checking',
    amount: 750.00,
    type: 'transfer',
    status: 'posted',
    category_id: getTransferCategoryId(750.00, categoryMap),
    bank_account_id: savingsId,
    payment_method: 'bank_transfer',
    transfer_pair_id: null
  });

  transactions.push({
    date: '2025-09-22',
    description: 'Credit Card Payment',
    amount: -800.00,
    type: 'transfer',
    status: 'posted',
    category_id: getTransferCategoryId(-800.00, categoryMap),
    bank_account_id: checkingId,
    payment_method: 'bank_transfer',
    transfer_pair_id: null
  });

  transactions.push({
    date: '2025-10-05',
    description: 'Account Transfer',
    amount: -300.00,
    type: 'transfer',
    status: 'posted',
    category_id: getTransferCategoryId(-300.00, categoryMap),
    bank_account_id: checkingId,
    payment_method: 'bank_transfer',
    transfer_pair_id: null
  });
  transactions.push({
    date: '2025-10-05',
    description: 'Incoming Transfer',
    amount: 300.00,
    type: 'transfer',
    status: 'posted',
    category_id: getTransferCategoryId(300.00, categoryMap),
    bank_account_id: allySavingsId,
    payment_method: 'bank_transfer',
    transfer_pair_id: null
  });

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) throw error;

  const matched = data.filter(t => t.transfer_pair_id !== null).length;
  const unmatched = data.filter(t => t.transfer_pair_id === null).length;
  console.log(`✓ Created ${data.length} transfer transactions (${matched} matched, ${unmatched} unmatched)`);
  return data;
}

async function createCreditScores() {
  console.log('📊 Creating credit scores...');

  const scores = [];
  const bureaus = ['TransUnion', 'Equifax', 'Experian'];

  for (let month = 0; month < 7; month++) {
    const score = 720 + (month * 4);
    scores.push({
      score: score,
      bureau: bureaus[month % 3],
      last_checked: formatDate(endOfMonth(new Date(2025, 5 + month, 1)))
    });
  }

  const { data, error } = await supabase
    .from('credit_scores')
    .insert(scores)
    .select();

  if (error) throw error;

  console.log(`✓ Created ${data.length} credit score entries`);
  return data;
}

async function createBudgets(categoryMap) {
  console.log('💵 Creating budgets...');

  const expenseGroup = await supabase
    .from('budget_groups')
    .insert({ name: 'Monthly Budget', type: 'expense' })
    .select()
    .single();

  const incomeGroup = await supabase
    .from('budget_groups')
    .insert({ name: 'Income', type: 'income' })
    .select()
    .single();

  if (expenseGroup.error) throw expenseGroup.error;
  if (incomeGroup.error) throw incomeGroup.error;

  const budgets = [
    { name: 'Groceries', limit_amount: 800, category_id: categoryMap['Groceries'], group_id: expenseGroup.data.id, period: 'monthly', is_active: true },
    { name: 'Dining Out', limit_amount: 400, category_id: categoryMap['Dining'], group_id: expenseGroup.data.id, period: 'monthly', is_active: true },
    { name: 'Gas & Fuel', limit_amount: 200, category_id: categoryMap['Gas'], group_id: expenseGroup.data.id, period: 'monthly', is_active: true },
    { name: 'Entertainment', limit_amount: 300, category_id: categoryMap['Entertainment'], group_id: expenseGroup.data.id, period: 'monthly', is_active: true },
    { name: 'Shopping', limit_amount: 500, category_id: categoryMap['Shopping'], group_id: expenseGroup.data.id, period: 'monthly', is_active: true },
    { name: 'Monthly Salary', limit_amount: 13000, category_id: categoryMap['Salary'], group_id: incomeGroup.data.id, period: 'monthly', is_active: true },
  ];

  const { data, error } = await supabase
    .from('budgets')
    .insert(budgets)
    .select();

  if (error) throw error;

  console.log(`✓ Created ${data.length} budgets`);
  return data;
}

async function createCategorizationRules(categoryMap) {
  console.log('🔧 Creating categorization rules...');

  const rules = [
    { pattern: 'WHOLE FOODS|SAFEWAY|TRADER JOE', category_id: categoryMap['Groceries'], priority: 10, is_active: true },
    { pattern: 'SHELL|CHEVRON|76|ARCO', category_id: categoryMap['Gas'], priority: 10, is_active: true },
    { pattern: 'AMAZON', category_id: categoryMap['Shopping'], priority: 5, is_active: true },
    { pattern: 'NETFLIX|SPOTIFY|HULU|DISNEY', category_id: categoryMap['Subscriptions'], priority: 10, is_active: true },
    { pattern: 'STARBUCKS|COFFEE BEAN|PEET', category_id: categoryMap['Dining'], priority: 8, is_active: true },
    { pattern: 'TARGET|WALMART|COSTCO', category_id: categoryMap['Shopping'], priority: 7, is_active: true },
    { pattern: 'UBER|LYFT', category_id: categoryMap['Transportation'], priority: 9, is_active: true },
  ];

  const { data, error } = await supabase
    .from('categorization_rules')
    .insert(rules)
    .select();

  if (error) throw error;

  console.log(`✓ Created ${data.length} categorization rules`);
  return data;
}

async function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SEED DATA SUMMARY');
  console.log('='.repeat(60) + '\n');

  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  const { count: accountCount } = await supabase.from('bank_accounts').select('*', { count: 'exact', head: true });
  const { count: assetCount } = await supabase.from('assets').select('*', { count: 'exact', head: true });
  const { count: liabilityCount } = await supabase.from('liabilities').select('*', { count: 'exact', head: true });
  const { count: budgetCount } = await supabase.from('budgets').select('*', { count: 'exact', head: true });
  const { count: categoryCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  const { count: contactCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
  const { count: scoreCount } = await supabase.from('credit_scores').select('*', { count: 'exact', head: true });
  const { count: ruleCount } = await supabase.from('categorization_rules').select('*', { count: 'exact', head: true });

  const { count: postedCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'posted');
  const { count: pendingCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending');

  const { count: matchedCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).not('transfer_pair_id', 'is', null);
  const { count: unmatchedCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'transfer').is('transfer_pair_id', null);

  const { count: aiSuggestedCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).not('ai_suggested_category_id', 'is', null);

  console.log(`📁 Categories:              ${categoryCount}`);
  console.log(`🏦 Bank Accounts:           ${accountCount}`);
  console.log(`📈 Investment Assets:       ${assetCount}`);
  console.log(`🏠 Liabilities:             ${liabilityCount}`);
  console.log(`👥 Contacts:                ${contactCount}`);
  console.log(`💰 Transactions:            ${txCount}`);
  console.log(`   ├─ Posted:              ${postedCount}`);
  console.log(`   └─ Pending:             ${pendingCount}`);
  console.log(`🔄 Transfer Transactions:   `);
  console.log(`   ├─ Matched pairs:       ${matchedCount / 2}`);
  console.log(`   └─ Unmatched:           ${unmatchedCount}`);
  console.log(`🤖 AI Suggested:            ${aiSuggestedCount}`);
  console.log(`💵 Budgets:                 ${budgetCount}`);
  console.log(`🔧 Categorization Rules:   ${ruleCount}`);
  console.log(`📊 Credit Scores:           ${scoreCount}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Seed data generation complete!');
  console.log('🚀 You can now view your data in the application');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('🌱 BASE44 FINANCIAL DATA SEEDER');
  console.log('='.repeat(60));
  console.log(`📅 Seed date range: June 15, 2025 - December 16, 2025`);
  console.log(`📍 Reference date: ${formatDate(TODAY)}`);
  console.log('='.repeat(60));

  const confirmed = await promptConfirmation();

  if (!confirmed) {
    console.log('\n❌ Seed operation cancelled.\n');
    process.exit(0);
  }

  try {
    await cleanupDatabase();

    const categoryMap = await createCategories();
    const accountMap = await createBankAccounts();
    const assetMap = await createAssets();
    const liabilityMap = await createLiabilities();
    const contactMap = await createContacts();

    await generatePostedTransactions(accountMap, categoryMap, contactMap);
    await generatePendingTransactions(accountMap, categoryMap, contactMap);
    await generateInvestmentTransactions(assetMap, categoryMap, accountMap);
    await generateTransferTransactions(accountMap, categoryMap);

    await createBudgets(categoryMap);

    await printSummary();

    const endTime = Date.now();
    console.log(`⏱️  Execution time: ${((endTime - startTime) / 1000).toFixed(2)}s\n`);

  } catch (error) {
    console.error('\n❌ Error during seed operation:', error);
    process.exit(1);
  }
}

main();
