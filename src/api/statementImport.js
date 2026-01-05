import { supabase } from './supabaseClient.js';
import { getUserChartOfAccounts } from './chartOfAccounts.js';
import { createOpeningBalanceJournalEntry } from './journalEntries.js';

export const findOrCreateOpeningBalanceEquityAccount = async (profileId) => {
  const equityAccounts = await getUserChartOfAccounts(profileId, { class: 'equity' });

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
};

export const findBankAccountByLastFour = async (profileId, lastFour, institutionName = null) => {
  let query = supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .or('class.eq.asset,class.eq.liability')
    .order('account_number');

  const { data: accounts, error } = await query;

  if (error) throw error;

  const matchingAccounts = accounts.filter(acc => {
    const lastFourMatch = acc.account_number_last4 === lastFour;
    const displayNameMatch = acc.display_name?.includes(lastFour);

    return lastFourMatch || displayNameMatch;
  });

  if (matchingAccounts.length === 0) return null;
  if (matchingAccounts.length === 1) return matchingAccounts[0];

  if (institutionName) {
    const institutionMatch = matchingAccounts.find(acc =>
      acc.institution_name?.toLowerCase().includes(institutionName.toLowerCase())
    );
    if (institutionMatch) return institutionMatch;
  }

  return matchingAccounts[0];
};

export const hasExistingTransactions = async (profileId, bankAccountId, beforeDate) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('profile_id', profileId)
    .eq('bank_account_id', bankAccountId)
    .lt('date', beforeDate)
    .limit(1);

  if (error) throw error;

  return data && data.length > 0;
};

export const createOpeningBalanceTransaction = async (profileId, userId, bankAccount, amount, date) => {
  const openingBalanceDate = new Date(date);
  openingBalanceDate.setDate(openingBalanceDate.getDate() - 1);
  const formattedDate = openingBalanceDate.toISOString().split('T')[0];

  const journalEntry = await createOpeningBalanceJournalEntry({
    profileId: profileId,
    userId: userId,
    accountId: bankAccount.id,
    openingBalance: amount,
    openingDate: formattedDate,
    accountName: bankAccount.display_name || bankAccount.account_name,
    accountClass: bankAccount.account_class
  });

  return journalEntry;
};

export const importStatementWithBeginningBalance = async (
  profileId,
  userId,
  accountLastFour,
  institutionName,
  beginningBalance,
  statementStartDate,
  transactions
) => {
  const bankAccount = await findBankAccountByLastFour(profileId, accountLastFour, institutionName);

  if (!bankAccount) {
    throw new Error(`Could not find bank account ending in ${accountLastFour}. Please create the account first.`);
  }

  const hasExisting = await hasExistingTransactions(profileId, bankAccount.id, statementStartDate);

  const results = {
    bankAccountId: bankAccount.id,
    bankAccountName: bankAccount.display_name || bankAccount.account_name,
    openingBalanceCreated: false,
    openingBalanceJournalEntry: null,
    transactionsImported: 0,
    errors: []
  };

  if (!hasExisting && beginningBalance !== 0 && beginningBalance !== null) {
    try {
      const journalEntry = await createOpeningBalanceTransaction(
        profileId,
        userId,
        bankAccount,
        beginningBalance,
        statementStartDate
      );

      results.openingBalanceCreated = true;
      results.openingBalanceJournalEntry = journalEntry;
    } catch (err) {
      console.error('Error creating opening balance journal entry:', err);
      results.errors.push(`Failed to create opening balance: ${err.message}`);
    }
  }

  const transactionsToImport = transactions.filter(txn => {
    const desc = txn.description?.toLowerCase() || '';
    return !desc.includes('beginning balance') && txn.amount > 0;
  });

  for (const txn of transactionsToImport) {
    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          profile_id: profileId,
          bank_account_id: bankAccount.id,
          date: txn.date,
          description: txn.description || 'Unknown Transaction',
          original_description: txn.original_description || txn.description || 'Unknown Transaction',
          amount: Math.abs(txn.amount),
          type: txn.type || 'expense',
          status: 'posted',
          source: 'pdf',
          include_in_reports: true
        });

      if (error) {
        results.errors.push(`Failed to import transaction: ${txn.description} - ${error.message}`);
      } else {
        results.transactionsImported++;
      }
    } catch (err) {
      results.errors.push(`Error importing transaction: ${txn.description} - ${err.message}`);
    }
  }

  return results;
};
