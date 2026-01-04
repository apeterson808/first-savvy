import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lfisuvkmkwsublkiyimv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaXN1dmtta3dzdWJsa2l5aW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDkzMTEsImV4cCI6MjA4MTM4NTMxMX0.4rmBJECcTnY05USr1d_wz78tuv-T9rqWV5L4XaFo3f8'
);

const ICCU_DEC_DATA = {
  statementStartDate: '2025-12-01',
  statementEndDate: '2025-12-31',
  accounts: [
    {
      lastFour: '1812',
      accountName: 'Share Savings - Personal Savings',
      accountType: 'savings',
      beginningBalance: 4272.64,
      endingBalance: 6249.11,
      transactions: [
        { date: '2025-12-01', description: 'ACH Withdrawal Wealthfront EDI - EDI PYMNTS', amount: 250.00, type: 'expense' },
        { date: '2025-12-02', description: 'ACH Withdrawal CITI CARD ONLINE - PAYMENT', amount: 263.34, type: 'expense' },
        { date: '2025-12-03', description: 'ACH Withdrawal COINBASE INC. - D3A5FF22', amount: 29.99, type: 'expense' },
        { date: '2025-12-05', description: 'Withdrawal #96638469# Ext Xfer To ******8930 Grandma', amount: 200.00, type: 'expense' },
        { date: '2025-12-09', description: 'Deposit #121608034# Transfer From *****1927 reimbusement capet clean', amount: 469.80, type: 'income' },
        { date: '2025-12-30', description: 'ACH Withdrawal Wealthfront EDI - EDI PYMNTS', amount: 250.00, type: 'expense' },
        { date: '2025-12-31', description: 'Deposit #122655731# Transfer From *****0685 Distribution', amount: 5000.00, type: 'income' },
        { date: '2025-12-31', description: 'Withdrawal #122655755# Transfer To *****1927 Contribution', amount: 2500.00, type: 'expense' }
      ]
    },
    {
      lastFour: '9817',
      accountName: 'Central Checking - Main Checking',
      accountType: 'checking',
      beginningBalance: 6783.19,
      endingBalance: 3774.75,
      transactions: [
        { date: '2025-12-01', description: 'Deposit #121182566# Transfer From *****0685 distribution', amount: 10000.00, type: 'income' },
        { date: '2025-12-01', description: 'Deposit #119802286# Transfer From *****0685 ditribution', amount: 6000.00, type: 'income' },
        { date: '2025-12-02', description: 'Deposit #121254980# Transfer From *****0685 christmas cards', amount: 78.00, type: 'income' },
        { date: '2025-12-02', description: 'Deposit #121255496# Transfer From *****9529 pbc reimbursement', amount: 240.00, type: 'income' },
        { date: '2025-12-02', description: 'ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT', amount: 3180.31, type: 'expense' },
        { date: '2025-12-02', description: 'ACH Withdrawal CITI CARD ONLINE - PAYMENT', amount: 2289.16, type: 'expense' },
        { date: '2025-12-02', description: 'ACH Withdrawal PSN*DRY CREEK WA TER CO. LLC - WATER PAYM', amount: 57.84, type: 'expense' },
        { date: '2025-12-02', description: 'ACH Withdrawal PSN*DRY CREEK SE WER CO LLC - SEWER PAYM', amount: 92.25, type: 'expense' },
        { date: '2025-12-02', description: 'Point Of Sale Withdrawal 554402050098706 EVOLUTION INTEGRATIVE M208-917-2928 IDUS', amount: 549.00, type: 'expense' },
        { date: '2025-12-03', description: 'ACH Withdrawal CHRISTIAN HEALTH - CHMINISTRI', amount: 861.00, type: 'expense' },
        { date: '2025-12-09', description: 'ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT', amount: 4287.77, type: 'expense' },
        { date: '2025-12-09', description: 'ACH Withdrawal CITI CARD ONLINE - PAYMENT', amount: 4250.94, type: 'expense' },
        { date: '2025-12-10', description: 'Point Of Sale Withdrawal 295618 CASH APP*DAYNELIS HERNAOakland CAUS', amount: 160.00, type: 'expense' },
        { date: '2025-12-12', description: 'ACH Withdrawal INTERMOUNTAIN GA - PAYMENTS', amount: 61.12, type: 'expense' },
        { date: '2025-12-16', description: 'ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT', amount: 2292.53, type: 'expense' },
        { date: '2025-12-16', description: 'ACH Withdrawal CITI CARD ONLINE - PAYMENT', amount: 1203.21, type: 'expense' },
        { date: '2025-12-22', description: 'Deposit #122262597# Transfer From *****0685 distribution', amount: 5000.00, type: 'income' },
        { date: '2025-12-23', description: 'ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT', amount: 1255.76, type: 'expense' },
        { date: '2025-12-23', description: 'ACH Withdrawal CITI CARD ONLINE - PAYMENT', amount: 1943.69, type: 'expense' },
        { date: '2025-12-24', description: 'Check 90', amount: 240.00, type: 'expense' },
        { date: '2025-12-29', description: 'ACH Withdrawal IDAHO POWER CO. 800-488-6151 - POWER BILL', amount: 87.60, type: 'expense' },
        { date: '2025-12-29', description: 'Withdrawal #122520033# Ext Xfer To ******3277 Transfer', amount: 100.00, type: 'expense' },
        { date: '2025-12-30', description: 'ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT', amount: 886.85, type: 'expense' },
        { date: '2025-12-30', description: 'ACH Withdrawal CITI CARD ONLINE - PAYMENT', amount: 367.41, type: 'expense' },
        { date: '2025-12-30', description: 'Point Of Sale Withdrawal 295618 CASH APP*DAYNELIS HERNAOakland CAUS', amount: 160.00, type: 'expense' }
      ]
    }
  ]
};

async function findOrCreateOpeningBalanceEquityAccount(profileId) {
  const { data: equityAccounts, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('class', 'equity')
    .order('account_number');

  if (error) throw error;

  let openingBalanceEquity = equityAccounts.find(
    acc => acc.account_detail?.toLowerCase().includes('opening') ||
           acc.display_name?.toLowerCase().includes('opening balance')
  );

  if (!openingBalanceEquity) {
    openingBalanceEquity = equityAccounts.find(
      acc => acc.account_number >= 3900 && acc.account_number < 4000
    );
  }

  if (!openingBalanceEquity) {
    const { data, error: insertError } = await supabase
      .from('user_chart_of_accounts')
      .insert({
        profile_id: profileId,
        class: 'equity',
        account_type: 'equity',
        account_detail: 'opening_balance_equity',
        display_name: 'Opening Balance Equity',
        account_number: 3900,
        is_active: true,
        is_user_created: true
      })
      .select()
      .single();

    if (insertError) throw insertError;
    openingBalanceEquity = data;
  }

  return openingBalanceEquity;
}

async function findBankAccountByLastFour(profileId, lastFour) {
  const { data: accounts, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('account_number_last4', lastFour)
    .order('account_number');

  if (error) throw error;

  return accounts && accounts.length > 0 ? accounts[0] : null;
}

async function hasExistingTransactions(profileId, bankAccountId, beforeDate) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('profile_id', profileId)
    .eq('bank_account_id', bankAccountId)
    .lt('date', beforeDate)
    .limit(1);

  if (error) throw error;

  return data && data.length > 0;
}

async function createOpeningBalanceTransaction(profileId, bankAccountId, amount, date, openingBalanceEquityAccountId) {
  const openingBalanceDate = new Date(date);
  openingBalanceDate.setDate(openingBalanceDate.getDate() - 1);
  const formattedDate = openingBalanceDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      profile_id: profileId,
      bank_account_id: bankAccountId,
      category_account_id: openingBalanceEquityAccountId,
      date: formattedDate,
      description: 'Opening Balance',
      original_description: 'Opening Balance',
      amount: Math.abs(amount),
      type: 'income',
      status: 'posted',
      source: 'manual',
      include_in_reports: false
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function importIccuDecStatement() {
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

  for (const accountData of ICCU_DEC_DATA.accounts) {
    console.log(`\nProcessing account ending in ${accountData.lastFour}...`);

    try {
      const bankAccount = await findBankAccountByLastFour(profileId, accountData.lastFour);

      if (!bankAccount) {
        console.error(`Could not find bank account ending in ${accountData.lastFour}`);
        importResults.push({
          accountLastFour: accountData.lastFour,
          success: false,
          error: 'Bank account not found'
        });
        continue;
      }

      console.log(`Found bank account: ${bankAccount.display_name || bankAccount.name} (${bankAccount.id})`);

      const hasExisting = await hasExistingTransactions(
        profileId,
        bankAccount.id,
        ICCU_DEC_DATA.statementStartDate
      );

      let openingBalanceCreated = false;

      if (!hasExisting && accountData.beginningBalance > 0) {
        console.log(`Creating opening balance of $${accountData.beginningBalance.toFixed(2)}...`);

        try {
          const equityAccount = await findOrCreateOpeningBalanceEquityAccount(profileId);
          console.log(`Using equity account: ${equityAccount.display_name} (${equityAccount.id})`);

          await createOpeningBalanceTransaction(
            profileId,
            bankAccount.id,
            accountData.beginningBalance,
            ICCU_DEC_DATA.statementStartDate,
            equityAccount.id
          );

          openingBalanceCreated = true;
          console.log('Opening balance transaction created successfully');
        } catch (err) {
          console.error('Error creating opening balance:', err.message);
        }
      } else {
        console.log('Skipping opening balance (account has existing transactions)');
      }

      console.log(`Importing ${accountData.transactions.length} transactions...`);

      let imported = 0;
      const errors = [];

      for (const txn of accountData.transactions) {
        try {
          const { error } = await supabase
            .from('transactions')
            .insert({
              profile_id: profileId,
              bank_account_id: bankAccount.id,
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

      console.log(`Imported ${imported}/${accountData.transactions.length} transactions`);

      if (errors.length > 0) {
        console.log('Errors:');
        errors.forEach(e => console.log('  -', e));
      }

      importResults.push({
        accountLastFour: accountData.lastFour,
        accountName: bankAccount.display_name || bankAccount.name,
        success: true,
        openingBalanceCreated,
        transactionsImported: imported,
        totalTransactions: accountData.transactions.length,
        errors: errors.length
      });

    } catch (err) {
      console.error(`Error processing account ${accountData.lastFour}:`, err.message);
      importResults.push({
        accountLastFour: accountData.lastFour,
        success: false,
        error: err.message
      });
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(JSON.stringify(importResults, null, 2));

  return importResults;
}

importIccuDecStatement()
  .then(() => {
    console.log('\nImport complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
