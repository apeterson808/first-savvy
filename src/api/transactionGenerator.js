import { supabase } from './supabaseClient';

const MERCHANT_TEMPLATES = {
  groceries: {
    merchants: [
      'WHOLE FOODS MARKET', 'TRADER JOES', 'SAFEWAY', 'KROGER', 'PUBLIX',
      'WALMART GROCERY', 'TARGET GROCERY', 'SPROUTS', 'ALDI', 'COSTCO',
      'SAMS CLUB', 'WEGMANS', 'HARRIS TEETER', 'GIANT FOOD', 'FOOD LION'
    ],
    amountRange: [20, 150],
    accountNumber: 5030,
    frequency: 8
  },
  dining: {
    merchants: [
      'STARBUCKS', 'CHIPOTLE', 'PANERA BREAD', 'SUBWAY', 'MCDONALDS',
      'CHICK-FIL-A', 'OLIVE GARDEN', 'RED LOBSTER', 'APPLEBEES', 'CHILIS',
      'TEXAS ROADHOUSE', 'OUTBACK STEAKHOUSE', 'PANDA EXPRESS', 'TACO BELL',
      'FIVE GUYS', 'IN-N-OUT BURGER', 'SHAKE SHACK', 'WENDYS', 'DUNKIN'
    ],
    amountRange: [8, 75],
    accountNumber: 5031,
    frequency: 10
  },
  gas: {
    merchants: [
      'SHELL', 'CHEVRON', 'BP', 'EXXON', 'MOBIL', 'ARCO',
      '76 GAS STATION', 'MARATHON', 'CIRCLE K', 'WAWA', 'SPEEDWAY'
    ],
    amountRange: [30, 80],
    accountNumber: 5041,
    frequency: 4
  },
  utilities: {
    merchants: [
      'PG&E ELECTRIC', 'DUKE ENERGY', 'SOUTHERN CO GAS', 'WATER DEPT',
      'CITY WATER SERVICES', 'WASTE MANAGEMENT', 'REPUBLIC SERVICES'
    ],
    amountRange: [60, 250],
    accountNumber: 5020,
    frequency: 1,
    recurring: true,
    day: 15
  },
  internet: {
    merchants: ['COMCAST XFINITY', 'AT&T INTERNET', 'VERIZON FIOS', 'SPECTRUM', 'COX INTERNET'],
    amountRange: [60, 120],
    accountNumber: 5021,
    frequency: 1,
    recurring: true,
    day: 10
  },
  phone: {
    merchants: ['VERIZON WIRELESS', 'AT&T MOBILITY', 'T-MOBILE', 'SPRINT'],
    amountRange: [50, 150],
    accountNumber: 5022,
    frequency: 1,
    recurring: true,
    day: 5
  },
  subscriptions: {
    merchants: [
      'NETFLIX', 'HULU', 'DISNEY PLUS', 'HBO MAX', 'AMAZON PRIME',
      'SPOTIFY', 'APPLE MUSIC', 'YOUTUBE PREMIUM', 'PELOTON',
      'PLANET FITNESS', 'LA FITNESS', 'ADOBE CREATIVE', 'DROPBOX'
    ],
    amountRange: [10, 50],
    accountNumber: 5090,
    frequency: 1,
    recurring: true,
    day: 1
  },
  shopping: {
    merchants: [
      'AMAZON.COM', 'TARGET', 'WALMART', 'BEST BUY', 'HOME DEPOT',
      'LOWES', 'KOHLS', 'NORDSTROM', 'MACYS', 'BED BATH BEYOND',
      'IKEA', 'WAYFAIR', 'ETSY', 'EBAY'
    ],
    amountRange: [25, 300],
    accountNumber: 5091,
    frequency: 5
  },
  entertainment: {
    merchants: [
      'AMC THEATRES', 'REGAL CINEMAS', 'TICKETMASTER', 'STUBHUB',
      'DAVE & BUSTERS', 'TOP GOLF', 'BOWLING ALLEY', 'MINI GOLF'
    ],
    amountRange: [25, 150],
    accountNumber: 5094,
    frequency: 2
  },
  healthcare: {
    merchants: [
      'CVS PHARMACY', 'WALGREENS', 'RITE AID', 'KAISER PERMANENTE',
      'URGENT CARE', 'DENTAL OFFICE', 'VISION CENTER', 'QUEST DIAGNOSTICS'
    ],
    amountRange: [15, 200],
    accountNumber: 5061,
    frequency: 2
  },
  insurance: {
    merchants: [
      'STATE FARM INSURANCE', 'GEICO', 'ALLSTATE', 'PROGRESSIVE',
      'USAA INSURANCE', 'HEALTH INSURANCE CO'
    ],
    amountRange: [100, 400],
    accountNumber: 5050,
    frequency: 1,
    recurring: true,
    day: 1
  },
  homeMaintenance: {
    merchants: [
      'HOME DEPOT', 'LOWES', 'ACE HARDWARE', 'LAWN SERVICE',
      'PEST CONTROL', 'HVAC REPAIR', 'PLUMBER', 'ELECTRICIAN'
    ],
    amountRange: [50, 500],
    accountNumber: 5012,
    frequency: 1
  },
  vehicle: {
    merchants: [
      'JIFFY LUBE', 'PEP BOYS', 'AUTOZONE', 'OREILLY AUTO',
      'CAR WASH', 'TIRE CENTER', 'OIL CHANGE'
    ],
    amountRange: [30, 200],
    accountNumber: 5042,
    frequency: 1
  },
  travel: {
    merchants: [
      'SOUTHWEST AIRLINES', 'UNITED AIRLINES', 'DELTA AIRLINES',
      'MARRIOTT HOTELS', 'HILTON HOTELS', 'AIRBNB', 'EXPEDIA',
      'UBER', 'LYFT', 'RENTAL CAR'
    ],
    amountRange: [50, 800],
    accountNumber: 5092,
    frequency: 1
  },
  pets: {
    merchants: ['PETSMART', 'PETCO', 'CHEWY.COM', 'VET CLINIC', 'PET GROOMING'],
    amountRange: [30, 150],
    accountNumber: 5095,
    frequency: 2
  }
};

const INCOME_TEMPLATES = {
  salary: {
    description: 'PAYROLL DEPOSIT',
    amountRange: [2000, 5000],
    accountNumber: 4011,
    recurring: true,
    daysOfMonth: [1, 15]
  },
  interest: {
    description: 'INTEREST PAYMENT',
    amountRange: [5, 50],
    accountNumber: 4051,
    recurring: true,
    daysOfMonth: [1]
  }
};

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomAmount(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function setDayOfMonth(date, day) {
  const result = new Date(date);
  result.setDate(day);
  return result;
}

async function fetchContacts(profileId) {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, type')
    .eq('profile_id', profileId)
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }

  return data || [];
}

function matchContactToDescription(description, contacts) {
  const normalizedDescription = description.toUpperCase();

  for (const contact of contacts) {
    const normalizedContactName = contact.name.toUpperCase();

    if (normalizedDescription.includes(normalizedContactName)) {
      return contact.id;
    }

    const words = normalizedContactName.split(' ');
    for (const word of words) {
      if (word.length > 3 && normalizedDescription.includes(word)) {
        return contact.id;
      }
    }
  }

  return null;
}

export function calculateTransactionCounts(startDate, goLiveDate) {
  const start = new Date(startDate);
  const today = new Date();
  const goLive = goLiveDate ? new Date(goLiveDate) : today;

  const monthsDiff = Math.ceil((today - start) / (1000 * 60 * 60 * 24 * 30));
  const totalTransactions = Math.max(monthsDiff * 15, 15);

  const postedTransactions = Math.ceil((goLive - start) / (1000 * 60 * 60 * 24 * 30)) * 15;
  const pendingTransactions = totalTransactions - postedTransactions;

  return {
    total: totalTransactions,
    posted: Math.max(postedTransactions, 0),
    pending: Math.max(pendingTransactions, 0)
  };
}

export async function generateTransactionsForAccount(accountData, userId, profileId, startDate, goLiveDate) {
  const transactions = [];
  const start = new Date(startDate);
  const today = new Date();
  const goLive = goLiveDate ? new Date(goLiveDate) : today;

  const monthsDiff = Math.ceil((today - start) / (1000 * 60 * 60 * 24 * 30));
  const transactionsPerMonth = 15;
  const totalTransactions = Math.max(monthsDiff * transactionsPerMonth, 15);

  const chartOfAccounts = await fetchChartOfAccounts(profileId);
  const contacts = await fetchContacts(profileId);

  for (let i = 0; i < totalTransactions; i++) {
    const daysFromStart = Math.floor(Math.random() * Math.ceil((today - start) / (1000 * 60 * 60 * 24)));
    const transactionDate = addDays(start, daysFromStart);

    if (transactionDate > today) continue;

    const status = transactionDate <= goLive ? 'posted' : 'pending';

    const isIncome = Math.random() < 0.15;

    if (isIncome && accountData.type !== 'credit') {
      const incomeTemplate = getRandomElement(Object.values(INCOME_TEMPLATES));
      const amount = getRandomAmount(incomeTemplate.amountRange[0], incomeTemplate.amountRange[1]);
      const chartAccount = chartOfAccounts.find(ca => ca.account_number === incomeTemplate.accountNumber);
      const contactId = matchContactToDescription(incomeTemplate.description, contacts.filter(c => c.type === 'customer'));

      transactions.push({
        account_id: accountData.id,
        user_id: userId,
        profile_id: profileId,
        date: transactionDate.toISOString().split('T')[0],
        amount: amount,
        description: incomeTemplate.description,
        transaction_type: 'income',
        status: status,
        chart_account_id: chartAccount?.id || null,
        contact_id: contactId
      });
    } else {
      const shouldCategorize = Math.random() > 0.15;

      if (shouldCategorize) {
        const categoryKey = weightedRandomCategory();
        const template = MERCHANT_TEMPLATES[categoryKey];
        const merchant = getRandomElement(template.merchants);
        const amount = getRandomAmount(template.amountRange[0], template.amountRange[1]);
        const chartAccount = chartOfAccounts.find(ca => ca.account_number === template.accountNumber);
        const contactId = matchContactToDescription(merchant, contacts.filter(c => c.type === 'vendor'));

        transactions.push({
          account_id: accountData.id,
          user_id: userId,
          profile_id: profileId,
          date: transactionDate.toISOString().split('T')[0],
          amount: accountData.type === 'credit' ? amount : -amount,
          description: merchant,
          transaction_type: 'expense',
          status: status,
          chart_account_id: chartAccount?.id || null,
          contact_id: contactId
        });
      } else {
        const categoryKey = getRandomElement(Object.keys(MERCHANT_TEMPLATES));
        const template = MERCHANT_TEMPLATES[categoryKey];
        const merchant = getRandomElement(template.merchants);
        const amount = getRandomAmount(template.amountRange[0], template.amountRange[1]);
        const contactId = matchContactToDescription(merchant, contacts.filter(c => c.type === 'vendor'));

        transactions.push({
          account_id: accountData.id,
          user_id: userId,
          profile_id: profileId,
          date: transactionDate.toISOString().split('T')[0],
          amount: accountData.type === 'credit' ? amount : -amount,
          description: merchant,
          transaction_type: 'expense',
          status: status,
          chart_account_id: null,
          contact_id: contactId
        });
      }
    }
  }

  return transactions;
}

function weightedRandomCategory() {
  const categories = Object.keys(MERCHANT_TEMPLATES);
  const weights = categories.map(key => MERCHANT_TEMPLATES[key].frequency);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  let random = Math.random() * totalWeight;

  for (let i = 0; i < categories.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return categories[i];
    }
  }

  return categories[0];
}

async function fetchChartOfAccounts(profileId) {
  const { data, error } = await supabase
    .from('user_chart_of_accounts')
    .select('id, account_number, display_name, account_type, account_detail')
    .eq('profile_id', profileId);

  if (error) {
    console.error('Error fetching chart of accounts:', error);
    return [];
  }

  return data || [];
}

export async function generateCreditCardPayments(accountData, userId, profileId, startDate, goLiveDate, existingAccounts) {
  const payments = [];
  const registryEntries = [];
  const start = new Date(startDate);
  const today = new Date();
  const goLive = goLiveDate ? new Date(goLiveDate) : today;

  const checkingOrSavingsAccounts = existingAccounts.filter(acc =>
    acc.type === 'checking' || acc.type === 'savings'
  );

  if (checkingOrSavingsAccounts.length === 0) return { payments: [], registryEntries: [] };

  const paymentDays = [1, 15];
  const currentMonth = new Date(start);
  currentMonth.setDate(1);

  while (currentMonth <= today) {
    for (const day of paymentDays) {
      const paymentDate = new Date(currentMonth);
      paymentDate.setDate(day);

      if (paymentDate >= start && paymentDate <= today) {
        const status = paymentDate <= goLive ? 'posted' : 'pending';
        const amount = getRandomAmount(300, 2000);
        const sourceAccount = getRandomElement(checkingOrSavingsAccounts);

        const paymentTransaction = {
          account_id: sourceAccount.id,
          user_id: userId,
          profile_id: profileId,
          date: paymentDate.toISOString().split('T')[0],
          amount: -amount,
          description: `CREDIT CARD PAYMENT - ${accountData.name || 'Credit Card'}`,
          transaction_type: 'transfer',
          status: status,
          chart_account_id: null,
          transfer_pair_id: null
        };

        payments.push(paymentTransaction);

        registryEntries.push({
          user_id: userId,
          profile_id: profileId,
          amount: amount,
          transaction_date: paymentDate.toISOString().split('T')[0],
          source_account_id: sourceAccount.id,
          source_account_type: sourceAccount.type,
          target_account_type: 'credit',
          description_pattern: `CREDIT CARD PAYMENT - ${accountData.name || 'Credit Card'}`,
          is_matched: false
        });
      }
    }

    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  return { payments, registryEntries };
}

export async function generateSavingsTransfers(userId, profileId, startDate, goLiveDate, existingAccounts) {
  const transfers = [];
  const registryEntries = [];
  const start = new Date(startDate);
  const today = new Date();
  const goLive = goLiveDate ? new Date(goLiveDate) : today;

  const checkingAccounts = existingAccounts.filter(acc => acc.type === 'checking');
  const savingsAccounts = existingAccounts.filter(acc => acc.type === 'savings');

  if (checkingAccounts.length === 0 || savingsAccounts.length === 0) {
    return { transfers: [], registryEntries: [] };
  }

  const transferDays = [5, 20];
  const currentMonth = new Date(start);
  currentMonth.setDate(1);

  while (currentMonth <= today) {
    for (const day of transferDays) {
      const transferDate = new Date(currentMonth);
      transferDate.setDate(day);

      if (transferDate >= start && transferDate <= today) {
        const status = transferDate <= goLive ? 'posted' : 'pending';
        const amount = getRandomAmount(200, 1000);
        const sourceAccount = getRandomElement(checkingAccounts);
        const targetAccount = getRandomElement(savingsAccounts);

        const transferOutTransaction = {
          account_id: sourceAccount.id,
          user_id: userId,
          profile_id: profileId,
          date: transferDate.toISOString().split('T')[0],
          amount: -amount,
          description: `TRANSFER TO ${targetAccount.name || 'Savings'}`,
          transaction_type: 'transfer',
          status: status,
          chart_account_id: null,
          transfer_pair_id: null
        };

        transfers.push(transferOutTransaction);

        registryEntries.push({
          user_id: userId,
          profile_id: profileId,
          amount: amount,
          transaction_date: transferDate.toISOString().split('T')[0],
          source_account_id: sourceAccount.id,
          source_account_type: sourceAccount.type,
          target_account_id: targetAccount.id,
          target_account_type: targetAccount.type,
          description_pattern: `TRANSFER TO ${targetAccount.name || 'Savings'}`,
          is_matched: false
        });
      }
    }

    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  return { transfers, registryEntries };
}

export async function checkForMatchingTransfers(accountData, userId, profileId) {
  const { data: registryEntries, error } = await supabase
    .from('transfer_registry')
    .select('*')
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .eq('target_account_type', accountData.type)
    .eq('is_matched', false);

  if (error) {
    console.error('Error checking transfer registry:', error);
    return [];
  }

  return registryEntries || [];
}

export async function createMatchedTransferTransactions(accountData, matchingEntries, userId, profileId) {
  const matchedTransactions = [];
  const registryUpdates = [];

  for (const entry of matchingEntries) {
    const receivedTransaction = {
      account_id: accountData.id,
      user_id: userId,
      profile_id: profileId,
      date: entry.transaction_date,
      amount: accountData.type === 'credit' ? -entry.amount : entry.amount,
      description: `PAYMENT RECEIVED - ${entry.description_pattern}`,
      transaction_type: 'transfer',
      status: 'posted',
      chart_account_id: null,
      transfer_pair_id: null
    };

    matchedTransactions.push(receivedTransaction);

    registryUpdates.push({
      id: entry.id,
      is_matched: true,
      matched_at: new Date().toISOString()
    });
  }

  return { matchedTransactions, registryUpdates };
}

export async function insertTransactionsAndRegistry(transactions, registryEntries) {
  if (transactions.length > 0) {
    const { error: txError } = await supabase
      .from('transactions')
      .insert(transactions);

    if (txError) {
      console.error('Error inserting transactions:', txError);
      throw txError;
    }
  }

  if (registryEntries.length > 0) {
    const { error: regError } = await supabase
      .from('transfer_registry')
      .insert(registryEntries);

    if (regError) {
      console.error('Error inserting registry entries:', regError);
      throw regError;
    }
  }
}

export async function updateTransferRegistry(registryUpdates) {
  for (const update of registryUpdates) {
    const { error } = await supabase
      .from('transfer_registry')
      .update({ is_matched: update.is_matched, matched_at: update.matched_at })
      .eq('id', update.id);

    if (error) {
      console.error('Error updating registry entry:', error);
    }
  }
}

export async function linkTransferPairs(sourceTransactionId, targetTransactionId) {
  const transferPairId = crypto.randomUUID();

  await supabase
    .from('transactions')
    .update({ transfer_pair_id: transferPairId })
    .eq('id', sourceTransactionId);

  await supabase
    .from('transactions')
    .update({ transfer_pair_id: transferPairId })
    .eq('id', targetTransactionId);
}
