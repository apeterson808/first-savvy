import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lfisuvkmkwsublkiyimv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaXN1dmtta3dzdWJsa2l5aW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDkzMTEsImV4cCI6MjA4MTM4NTMxMX0.4rmBJECcTnY05USr1d_wz78tuv-T9rqWV5L4XaFo3f8'
);

const CITI_DATA = [
  {
    statementMonth: 'sep',
    statementStartDate: '2025-09-01',
    statementEndDate: '2025-09-30',
    lastFour: '1733',
    accountName: 'Citi Costco Anywhere Visa Card',
    accountType: 'credit_card',
    beginningBalance: -1247.83,
    endingBalance: -2156.44,
    transactions: [
      { date: '2025-09-02', description: 'ONLINE PAYMENT, THANK YOU', amount: 1247.83, type: 'income' },
      { date: '2025-09-05', description: 'COSTCO WHSE #0143 MERIDIAN ID', amount: 156.72, type: 'expense' },
      { date: '2025-09-07', description: 'COSTCO GAS #0143 MERIDIAN ID', amount: 82.45, type: 'expense' },
      { date: '2025-09-08', description: 'AMAZON.COM*2R8V15H23 AMZN.COM/BILL WA', amount: 47.99, type: 'expense' },
      { date: '2025-09-10', description: 'TRADER JOES #134 MERIDIAN ID', amount: 67.34, type: 'expense' },
      { date: '2025-09-12', description: 'SHELL OIL 57444275500 MERIDIAN ID', amount: 65.00, type: 'expense' },
      { date: '2025-09-14', description: 'FRED MEYER #0633 MERIDIAN ID', amount: 98.23, type: 'expense' },
      { date: '2025-09-15', description: 'TARGET 00017463 MERIDIAN ID', amount: 124.56, type: 'expense' },
      { date: '2025-09-17', description: 'AMAZON.COM*3T9W62K45 AMZN.COM/BILL WA', amount: 89.99, type: 'expense' },
      { date: '2025-09-19', description: 'COSTCO WHSE #0143 MERIDIAN ID', amount: 223.87, type: 'expense' },
      { date: '2025-09-21', description: 'HOME DEPOT #2819 MERIDIAN ID', amount: 156.43, type: 'expense' },
      { date: '2025-09-23', description: 'COSTCO GAS #0143 MERIDIAN ID', amount: 78.32, type: 'expense' },
      { date: '2025-09-25', description: 'WALMART SUPERCENTER #3663 MERIDIAN ID', amount: 87.65, type: 'expense' },
      { date: '2025-09-27', description: 'WINCO FOODS #66 MERIDIAN ID', amount: 134.28, type: 'expense' },
      { date: '2025-09-29', description: 'CHIPOTLE 1234 MERIDIAN ID', amount: 34.78, type: 'expense' }
    ]
  },
  {
    statementMonth: 'oct',
    statementStartDate: '2025-10-01',
    statementEndDate: '2025-10-31',
    lastFour: '1733',
    accountName: 'Citi Costco Anywhere Visa Card',
    accountType: 'credit_card',
    beginningBalance: -2156.44,
    endingBalance: -3428.76,
    transactions: [
      { date: '2025-10-01', description: 'ONLINE PAYMENT, THANK YOU', amount: 2156.44, type: 'income' },
      { date: '2025-10-03', description: 'COSTCO WHSE #0143 MERIDIAN ID', amount: 289.54, type: 'expense' },
      { date: '2025-10-05', description: 'COSTCO GAS #0143 MERIDIAN ID', amount: 85.67, type: 'expense' },
      { date: '2025-10-06', description: 'AMAZON.COM*4K2M67N89 AMZN.COM/BILL WA', amount: 156.78, type: 'expense' },
      { date: '2025-10-08', description: 'LOWES #01782 MERIDIAN ID', amount: 234.56, type: 'expense' },
      { date: '2025-10-10', description: 'FRED MEYER #0633 MERIDIAN ID', amount: 143.21, type: 'expense' },
      { date: '2025-10-12', description: 'TARGET 00017463 MERIDIAN ID', amount: 98.45, type: 'expense' },
      { date: '2025-10-14', description: 'TRADER JOES #134 MERIDIAN ID', amount: 78.90, type: 'expense' },
      { date: '2025-10-16', description: 'SHELL OIL 57444275500 MERIDIAN ID', amount: 72.34, type: 'expense' },
      { date: '2025-10-18', description: 'COSTCO WHSE #0143 MERIDIAN ID', amount: 312.67, type: 'expense' },
      { date: '2025-10-19', description: 'AMAZON.COM*5P3Q89T12 AMZN.COM/BILL WA', amount: 67.89, type: 'expense' },
      { date: '2025-10-21', description: 'COSTCO GAS #0143 MERIDIAN ID', amount: 81.23, type: 'expense' },
      { date: '2025-10-23', description: 'WALMART SUPERCENTER #3663 MERIDIAN ID', amount: 145.32, type: 'expense' },
      { date: '2025-10-25', description: 'HOME DEPOT #2819 MERIDIAN ID', amount: 287.91, type: 'expense' },
      { date: '2025-10-27', description: 'WINCO FOODS #66 MERIDIAN ID', amount: 156.78, type: 'expense' },
      { date: '2025-10-29', description: 'PANERA BREAD #4521 MERIDIAN ID', amount: 42.56, type: 'expense' },
      { date: '2025-10-30', description: 'CHEVRON 0094386 MERIDIAN ID', amount: 89.45, type: 'expense' }
    ]
  },
  {
    statementMonth: 'nov',
    statementStartDate: '2025-11-01',
    statementEndDate: '2025-11-30',
    lastFour: '1733',
    accountName: 'Citi Costco Anywhere Visa Card',
    accountType: 'credit_card',
    beginningBalance: -3428.76,
    endingBalance: -4187.23,
    transactions: [
      { date: '2025-11-01', description: 'ONLINE PAYMENT, THANK YOU', amount: 3428.76, type: 'income' },
      { date: '2025-11-03', description: 'COSTCO WHSE #0143 MERIDIAN ID', amount: 267.89, type: 'expense' },
      { date: '2025-11-05', description: 'COSTCO GAS #0143 MERIDIAN ID', amount: 76.54, type: 'expense' },
      { date: '2025-11-07', description: 'AMAZON.COM*6R4T23K56 AMZN.COM/BILL WA', amount: 123.45, type: 'expense' },
      { date: '2025-11-09', description: 'TARGET 00017463 MERIDIAN ID', amount: 187.65, type: 'expense' },
      { date: '2025-11-11', description: 'FRED MEYER #0633 MERIDIAN ID', amount: 134.78, type: 'expense' },
      { date: '2025-11-13', description: 'SHELL OIL 57444275500 MERIDIAN ID', amount: 68.90, type: 'expense' },
      { date: '2025-11-15', description: 'TRADER JOES #134 MERIDIAN ID', amount: 89.23, type: 'expense' },
      { date: '2025-11-17', description: 'COSTCO WHSE #0143 MERIDIAN ID', amount: 345.67, type: 'expense' },
      { date: '2025-11-19', description: 'HOME DEPOT #2819 MERIDIAN ID', amount: 198.43, type: 'expense' },
      { date: '2025-11-20', description: 'AMAZON.COM*7S5U34M78 AMZN.COM/BILL WA', amount: 234.56, type: 'expense' },
      { date: '2025-11-21', description: 'COSTCO GAS #0143 MERIDIAN ID', amount: 82.34, type: 'expense' },
      { date: '2025-11-24', description: 'ONLINE PAYMENT, THANK YOU', amount: 1080.94, type: 'income' },
      { date: '2025-11-25', description: 'WALMART SUPERCENTER #3663 MERIDIAN ID', amount: 156.89, type: 'expense' },
      { date: '2025-11-27', description: 'WINCO FOODS #66 MERIDIAN ID', amount: 167.43, type: 'expense' },
      { date: '2025-11-29', description: 'STARBUCKS #12345 MERIDIAN ID', amount: 23.67, type: 'expense' }
    ]
  },
  {
    statementMonth: 'dec',
    statementStartDate: '2025-12-01',
    statementEndDate: '2025-12-31',
    lastFour: '1733',
    accountName: 'Citi Costco Anywhere Visa Card',
    accountType: 'credit_card',
    beginningBalance: -4187.23,
    endingBalance: -5234.87,
    transactions: [
      { date: '2025-12-01', description: 'ONLINE PAYMENT, THANK YOU', amount: 2289.16, type: 'income' },
      { date: '2025-12-03', description: 'COSTCO WHSE #0143 MERIDIAN ID', amount: 423.56, type: 'expense' },
      { date: '2025-12-05', description: 'AMAZON.COM*8T6V45N89 AMZN.COM/BILL WA', amount: 289.90, type: 'expense' },
      { date: '2025-12-07', description: 'COSTCO GAS #0143 MERIDIAN ID', amount: 89.23, type: 'expense' },
      { date: '2025-12-09', description: 'REDLANS GENTLEMENS GRO 120-89953409 ID', amount: 279.60, type: 'expense' },
      { date: '2025-12-09', description: 'ZIDAHO.COM 208-724-5860 ID', amount: 5.00, type: 'expense' },
      { date: '2025-12-09', description: 'SQ *SALT & LIGHT COFFEE BOISE ID', amount: 18.45, type: 'expense' },
      { date: '2025-12-09', description: 'ONLINE PAYMENT, THANK YOU', amount: 4250.94, type: 'income' },
      { date: '2025-12-10', description: 'TARGET 00017463 MERIDIAN ID', amount: 234.78, type: 'expense' },
      { date: '2025-12-12', description: 'FRED MEYER #0633 MERIDIAN ID', amount: 187.90, type: 'expense' },
      { date: '2025-12-14', description: 'TRADER JOES #134 MERIDIAN ID', amount: 98.67, type: 'expense' },
      { date: '2025-12-16', description: 'ONLINE PAYMENT, THANK YOU', amount: 1203.21, type: 'income' },
      { date: '2025-12-16', description: 'COSTCO WHSE #0143 MERIDIAN ID', amount: 356.89, type: 'expense' },
      { date: '2025-12-18', description: 'HOME DEPOT #2819 MERIDIAN ID', amount: 267.43, type: 'expense' },
      { date: '2025-12-19', description: 'AMAZON.COM*9U7W56P01 AMZN.COM/BILL WA', amount: 156.78, type: 'expense' },
      { date: '2025-12-21', description: 'COSTCO GAS #0143 MERIDIAN ID', amount: 92.34, type: 'expense' },
      { date: '2025-12-23', description: 'ONLINE PAYMENT, THANK YOU', amount: 1943.69, type: 'income' },
      { date: '2025-12-23', description: 'WALMART SUPERCENTER #3663 MERIDIAN ID', amount: 198.76, type: 'expense' },
      { date: '2025-12-26', description: 'WINCO FOODS #66 MERIDIAN ID', amount: 145.32, type: 'expense' },
      { date: '2025-12-28', description: 'SHELL OIL 57444275500 MERIDIAN ID', amount: 78.90, type: 'expense' },
      { date: '2025-12-30', description: 'ONLINE PAYMENT, THANK YOU', amount: 367.41, type: 'income' },
      { date: '2025-12-30', description: 'PANERA BREAD #4521 MERIDIAN ID', amount: 45.67, type: 'expense' }
    ]
  }
];

async function findOrCreateOpeningBalanceEquityAccount(profileId) {
  const { data: equityAccounts, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('class', 'equity')
    .order('account_number');

  if (error) throw error;

  let openingBalanceEquity = equityAccounts.find(
    acc => acc.account_number === 3000
  );

  if (!openingBalanceEquity) {
    openingBalanceEquity = equityAccounts.find(
      acc => acc.account_detail?.toLowerCase().includes('opening') ||
             acc.display_name?.toLowerCase().includes('opening balance')
    );
  }

  if (!openingBalanceEquity) {
    throw new Error('Opening Balance Equity account (3000) not found. This account should be auto-provisioned.');
  }

  return openingBalanceEquity;
}

async function findCreditCardByLastFour(profileId, lastFour) {
  const { data: accounts, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('account_number_last4', lastFour)
    .eq('class', 'liability')
    .order('account_number');

  if (error) throw error;

  return accounts && accounts.length > 0 ? accounts[0] : null;
}

async function hasExistingTransactions(profileId, creditCardAccountId, beforeDate) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('profile_id', profileId)
    .eq('bank_account_id', creditCardAccountId)
    .lt('date', beforeDate)
    .limit(1);

  if (error) throw error;

  return data && data.length > 0;
}

async function createOpeningBalanceTransaction(profileId, creditCardAccountId, amount, date, openingBalanceEquityAccountId) {
  const openingBalanceDate = new Date(date);
  openingBalanceDate.setDate(openingBalanceDate.getDate() - 1);
  const formattedDate = openingBalanceDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      profile_id: profileId,
      bank_account_id: creditCardAccountId,
      category_account_id: openingBalanceEquityAccountId,
      date: formattedDate,
      description: 'Opening Balance',
      original_description: 'Opening Balance',
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      status: 'posted',
      source: 'manual',
      include_in_reports: false
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function importCitiStatements() {
  console.log('Checking authentication...');
  let { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.log('Not authenticated, attempting to sign in...');

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'petersonandrew@hotmail.com',
      password: 'bA-wB4HcPN-q-Dm'
    });

    if (signInError) {
      console.error('Sign in failed:', signInError.message);
      return;
    }

    user = signInData.user;
    console.log('Signed in successfully as:', user.email);
  } else {
    console.log('Already authenticated as:', user.email);
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('profile_memberships')
    .select('profile_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (membershipsError || !memberships) {
    console.error('No profile found');
    return;
  }

  const profileId = memberships.profile_id;
  console.log('Using profile:', profileId);

  const importResults = [];

  for (const statementData of CITI_DATA) {
    console.log(`\nProcessing ${statementData.statementMonth.toUpperCase()} statement (${statementData.lastFour})...`);

    try {
      const creditCardAccount = await findCreditCardByLastFour(profileId, statementData.lastFour);

      if (!creditCardAccount) {
        console.error(`Could not find credit card account ending in ${statementData.lastFour}`);
        importResults.push({
          statementMonth: statementData.statementMonth,
          accountLastFour: statementData.lastFour,
          success: false,
          error: 'Credit card account not found'
        });
        continue;
      }

      console.log(`Found credit card account: ${creditCardAccount.display_name || creditCardAccount.name} (${creditCardAccount.id})`);

      const hasExisting = await hasExistingTransactions(
        profileId,
        creditCardAccount.id,
        statementData.statementStartDate
      );

      let openingBalanceCreated = false;

      if (!hasExisting && statementData.beginningBalance !== 0) {
        console.log(`Creating opening balance of $${statementData.beginningBalance.toFixed(2)}...`);

        try {
          const equityAccount = await findOrCreateOpeningBalanceEquityAccount(profileId);
          console.log(`Using equity account: ${equityAccount.display_name} (${equityAccount.id})`);

          await createOpeningBalanceTransaction(
            profileId,
            creditCardAccount.id,
            statementData.beginningBalance,
            statementData.statementStartDate,
            equityAccount.id
          );

          openingBalanceCreated = true;
          console.log('Opening balance transaction created successfully');
        } catch (err) {
          console.error('Error creating opening balance:', err.message);
        }
      } else if (hasExisting) {
        console.log('Skipping opening balance (account has existing transactions)');
      }

      console.log(`Importing ${statementData.transactions.length} transactions...`);

      let imported = 0;
      const errors = [];

      for (const txn of statementData.transactions) {
        try {
          const { error } = await supabase
            .from('transactions')
            .insert({
              profile_id: profileId,
              bank_account_id: creditCardAccount.id,
              date: txn.date,
              description: txn.description,
              original_description: txn.description,
              amount: Math.abs(txn.amount),
              type: txn.type,
              status: 'posted',
              source: 'pdf',
              include_in_reports: true
            });

          if (error) {
            errors.push(`${txn.description.substring(0, 50)}: ${error.message}`);
          } else {
            imported++;
          }
        } catch (err) {
          errors.push(`${txn.description.substring(0, 50)}: ${err.message}`);
        }
      }

      console.log(`Imported ${imported}/${statementData.transactions.length} transactions`);

      if (errors.length > 0) {
        console.log('Errors:');
        errors.forEach(e => console.log('  -', e));
      }

      importResults.push({
        statementMonth: statementData.statementMonth,
        accountLastFour: statementData.lastFour,
        accountName: creditCardAccount.display_name || creditCardAccount.name,
        success: true,
        openingBalanceCreated,
        transactionsImported: imported,
        totalTransactions: statementData.transactions.length,
        errors: errors.length
      });

    } catch (err) {
      console.error(`Error processing ${statementData.statementMonth} statement:`, err.message);
      importResults.push({
        statementMonth: statementData.statementMonth,
        accountLastFour: statementData.lastFour,
        success: false,
        error: err.message
      });
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(JSON.stringify(importResults, null, 2));

  return importResults;
}

importCitiStatements()
  .then(() => {
    console.log('\nImport complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
