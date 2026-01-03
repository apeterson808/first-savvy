import { supabase } from './supabaseClient';

export async function getAvailableInstitutions() {
  const { data, error } = await supabase
    .from('financial_institutions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('Error fetching institutions:', error);
    throw error;
  }

  return data;
}

export async function getInstitutionById(institutionId) {
  const { data, error } = await supabase
    .from('financial_institutions')
    .select('*')
    .eq('id', institutionId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching institution:', error);
    throw error;
  }

  return data;
}

export async function getStatementCache(institutionName, accountType = null) {
  let query = supabase
    .from('statement_cache')
    .select('*')
    .eq('institution_name', institutionName)
    .order('statement_year', { ascending: false })
    .order('statement_month', { ascending: false });

  if (accountType) {
    query = query.eq('account_type', accountType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching statement cache:', error);
    throw error;
  }

  return data;
}

export async function getAccountsForInstitution(institutionName) {
  const { data, error } = await supabase
    .from('statement_cache')
    .select('account_type, account_number_last4, institution_name')
    .eq('institution_name', institutionName);

  if (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }

  const uniqueAccounts = Array.from(
    new Map(
      data.map(item => [
        `${item.account_type}-${item.account_number_last4}`,
        item
      ])
    ).values()
  );

  return uniqueAccounts.map(account => ({
    accountType: account.account_type,
    accountNumberLast4: account.account_number_last4,
    institutionName: account.institution_name,
    displayName: `${account.institution_name} ${account.account_type === 'credit' ? 'Credit Card' : account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} ****${account.account_number_last4}`
  }));
}

export async function simulateBankConnection(institutionId, accountType = null) {
  const institution = await getInstitutionById(institutionId);

  if (!institution) {
    throw new Error('Institution not found');
  }

  const accounts = await getAccountsForInstitution(institution.name);

  if (accountType) {
    return accounts.filter(acc => acc.accountType === accountType);
  }

  return accounts;
}

export async function getTransactionsForAccount(institutionName, accountType, accountNumberLast4) {
  const { data, error } = await supabase
    .from('statement_cache')
    .select('*')
    .eq('institution_name', institutionName)
    .eq('account_type', accountType)
    .eq('account_number_last4', accountNumberLast4)
    .order('statement_year', { ascending: true })
    .order('statement_month', { ascending: true });

  if (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }

  const allTransactions = [];

  data.forEach(statement => {
    const transactions = statement.transactions_data || [];
    allTransactions.push(...transactions);
  });

  allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    transactions: allTransactions,
    statements: data,
    totalTransactions: allTransactions.length
  };
}

export async function cacheStatementData(statementData) {
  const { institution_id, institution_name, account_type, account_number_last4,
          statement_month, statement_year, transactions_data, file_name } = statementData;

  const totalDebits = transactions_data
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

  const totalCredits = transactions_data
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

  const { data, error } = await supabase
    .from('statement_cache')
    .upsert({
      institution_id,
      institution_name,
      account_type,
      account_number_last4,
      statement_month,
      statement_year,
      transactions_data,
      transaction_count: transactions_data.length,
      total_debits: totalDebits,
      total_credits: totalCredits,
      file_name,
      parsed_at: new Date().toISOString()
    }, {
      onConflict: 'file_name',
      ignoreDuplicates: false
    })
    .select();

  if (error) {
    console.error('Error caching statement data:', error);
    throw error;
  }

  return data;
}
