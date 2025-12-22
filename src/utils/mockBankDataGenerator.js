import { format, addDays, subDays, differenceInDays, isWithinInterval } from 'date-fns';
import { supabase } from '@/api/supabaseClient';

const MERCHANT_CATEGORIES = {
  'Grocery & Food': [
    { name: 'Whole Foods', range: [45, 150] },
    { name: 'Trader Joe\'s', range: [30, 90] },
    { name: 'Safeway', range: [25, 120] },
    { name: 'Target', range: [50, 200] },
  ],
  'Dining & Restaurants': [
    { name: 'Starbucks', range: [5, 15] },
    { name: 'Chipotle', range: [10, 25] },
    { name: 'Local Pizza Co', range: [20, 45] },
    { name: 'Olive Garden', range: [35, 80] },
    { name: 'McDonald\'s', range: [8, 20] },
  ],
  'Gas & Automotive': [
    { name: 'Shell Gas Station', range: [40, 75] },
    { name: 'Chevron', range: [45, 80] },
    { name: 'AutoZone', range: [25, 150] },
  ],
  'Shopping & Retail': [
    { name: 'Amazon', range: [15, 250] },
    { name: 'Walmart', range: [30, 150] },
    { name: 'Best Buy', range: [50, 500] },
    { name: 'Home Depot', range: [40, 300] },
  ],
  'Utilities & Services': [
    { name: 'PG&E Electric', range: [80, 150], frequency: 'monthly' },
    { name: 'Comcast Internet', range: [65, 95], frequency: 'monthly' },
    { name: 'AT&T Mobile', range: [45, 85], frequency: 'monthly' },
    { name: 'Water District', range: [30, 60], frequency: 'monthly' },
  ],
  'Entertainment & Subscriptions': [
    { name: 'Netflix', range: [15, 20], frequency: 'monthly' },
    { name: 'Spotify', range: [10, 15], frequency: 'monthly' },
    { name: 'Disney+', range: [8, 12], frequency: 'monthly' },
    { name: 'AMC Theaters', range: [15, 50] },
  ],
  'Healthcare & Pharmacy': [
    { name: 'CVS Pharmacy', range: [15, 75] },
    { name: 'Walgreens', range: [20, 60] },
    { name: 'Kaiser Medical', range: [25, 200] },
  ],
  'Income': [
    { name: 'Payroll Deposit', range: [2500, 4500], frequency: 'biweekly' },
    { name: 'Direct Deposit Salary', range: [3000, 5000], frequency: 'biweekly' },
  ],
};

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function generateAccountNumber() {
  return Math.floor(Math.random() * 900000000 + 100000000).toString();
}

function generateLastFour() {
  return Math.floor(Math.random() * 9000 + 1000).toString();
}

export async function createMockAccounts(institution, accountsToCreate, userId) {
  const mockItemId = `mock_item_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const serviceConnection = {
    user_id: userId,
    service_type: 'mock_bank',
    service_identifier: mockItemId,
    connection_status: 'active',
    connection_metadata: {
      institution_id: institution.id,
      institution_name: institution.name,
      connection_type: 'demo',
      mock: true,
    },
    last_sync_at: new Date().toISOString(),
  };

  const { data: connectionData, error: connectionError } = await supabase
    .from('service_connections')
    .insert(serviceConnection)
    .select()
    .single();

  if (connectionError) {
    console.error('Error creating service connection:', connectionError);
    throw connectionError;
  }

  const accounts = [];
  for (const mockAccount of accountsToCreate) {
    const accountNumber = generateAccountNumber();
    const lastFour = mockAccount.lastFour || generateLastFour();

    let accountData;
    if (mockAccount.type === 'credit_card') {
      accountData = {
        user_id: userId,
        card_name: `${institution.name} ${mockAccount.name}`,
        last_four_digits: lastFour,
        card_network: 'Visa',
        credit_limit: mockAccount.limit || 5000,
        current_balance: Math.abs(mockAccount.balance),
        available_credit: (mockAccount.limit || 5000) - Math.abs(mockAccount.balance),
        interest_rate: 18.99,
        statement_due_date: format(addDays(new Date(), 15), 'yyyy-MM-dd'),
        minimum_payment_due: Math.abs(mockAccount.balance) * 0.02,
        is_active: true,
        plaid_account_id: `mock_cc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        plaid_item_id: mockItemId,
      };

      const { data, error } = await supabase
        .from('credit_cards')
        .insert(accountData)
        .select()
        .single();

      if (error) {
        console.error('Error creating credit card:', error);
        throw error;
      }

      accounts.push({
        ...data,
        type: 'credit_card',
        institution,
        mockAccount,
      });
    } else {
      accountData = {
        user_id: userId,
        account_name: `${institution.name} ${mockAccount.name}`,
        account_type: mockAccount.type === 'checking' ? 'Checking' : 'Savings',
        account_number: accountNumber,
        routing_number: institution.routing_number,
        current_balance: mockAccount.balance,
        available_balance: mockAccount.balance,
        institution_name: institution.name,
        is_primary: mockAccount.type === 'checking',
        plaid_account_id: `mock_${mockAccount.type}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        plaid_item_id: mockItemId,
      };

      const { data, error } = await supabase
        .from('accounts')
        .insert(accountData)
        .select()
        .single();

      if (error) {
        console.error('Error creating account:', error);
        throw error;
      }

      accounts.push({
        ...data,
        type: mockAccount.type,
        institution,
        mockAccount,
      });
    }
  }

  return { accounts, serviceConnection: connectionData };
}

export async function generateMockTransactions(accounts, startDate, goLiveDate, userId) {
  const allTransactions = [];
  const today = new Date();
  const totalDays = differenceInDays(today, startDate);

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId);

  const categoryMap = {};
  if (categories) {
    categories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });
  }

  const getCategoryId = (categoryName) => {
    const exactMatch = categoryMap[categoryName];
    if (exactMatch) return exactMatch;

    const similarKey = Object.keys(categoryMap).find(key =>
      key.toLowerCase().includes(categoryName.toLowerCase()) ||
      categoryName.toLowerCase().includes(key.toLowerCase())
    );
    return similarKey ? categoryMap[similarKey] : null;
  };

  for (const account of accounts) {
    const isCredit = account.type === 'credit_card';
    let runningBalance = account.mockAccount.balance;
    const transactions = [];

    const recurringTransactions = [];
    Object.entries(MERCHANT_CATEGORIES).forEach(([categoryName, merchants]) => {
      merchants.forEach(merchant => {
        if (merchant.frequency === 'monthly' || merchant.frequency === 'biweekly') {
          recurringTransactions.push({
            merchant,
            categoryName,
            frequency: merchant.frequency,
            lastDate: null,
          });
        }
      });
    });

    for (let day = 0; day <= totalDays; day++) {
      const currentDate = addDays(startDate, day);
      const isPosted = currentDate < goLiveDate;

      recurringTransactions.forEach(recurring => {
        const { merchant, categoryName, frequency } = recurring;

        let shouldGenerate = false;
        if (!recurring.lastDate) {
          shouldGenerate = day === 0;
        } else if (frequency === 'monthly') {
          const daysSince = differenceInDays(currentDate, recurring.lastDate);
          shouldGenerate = daysSince >= 28;
        } else if (frequency === 'biweekly') {
          const daysSince = differenceInDays(currentDate, recurring.lastDate);
          shouldGenerate = daysSince >= 14;
        }

        if (shouldGenerate) {
          const amount = randomAmount(merchant.range[0], merchant.range[1]);
          const isIncome = categoryName === 'Income';

          transactions.push({
            transaction_date: format(currentDate, 'yyyy-MM-dd'),
            merchant_name: merchant.name,
            amount: isIncome ? amount : -amount,
            category_id: getCategoryId(categoryName),
            status: isPosted ? 'posted' : 'pending',
            original_type: isIncome ? 'income' : 'expense',
          });

          recurring.lastDate = currentDate;
        }
      });

      if (Math.random() < 0.3) {
        const allCategories = Object.entries(MERCHANT_CATEGORIES).filter(
          ([name]) => name !== 'Income' && name !== 'Utilities & Services'
        );
        const [categoryName, merchants] = allCategories[
          Math.floor(Math.random() * allCategories.length)
        ];
        const merchant = merchants[Math.floor(Math.random() * merchants.length)];
        const amount = randomAmount(merchant.range[0], merchant.range[1]);

        transactions.push({
          transaction_date: format(currentDate, 'yyyy-MM-dd'),
          merchant_name: merchant.name,
          amount: -amount,
          category_id: getCategoryId(categoryName),
          status: isPosted ? 'posted' : 'pending',
          original_type: 'expense',
        });
      }
    }

    transactions.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

    const transactionsWithAccounts = transactions.map(txn => ({
      ...txn,
      user_id: userId,
      account_id: isCredit ? null : account.id,
      credit_card_id: isCredit ? account.id : null,
      description: txn.merchant_name,
      payment_method: isCredit ? 'credit_card' : 'bank_transfer',
      is_pending: txn.status === 'pending',
    }));

    allTransactions.push(...transactionsWithAccounts);
  }

  const { data: insertedTransactions, error } = await supabase
    .from('transactions')
    .insert(allTransactions)
    .select();

  if (error) {
    console.error('Error creating transactions:', error);
    throw error;
  }

  return insertedTransactions;
}
