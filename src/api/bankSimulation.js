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

export async function importFromStatementCache(importData) {
  let accountsCreated = 0;
  let transactionsImported = 0;
  let duplicatesSkipped = 0;
  const errors = [];

  try {
    for (const accountImport of importData) {
      const {
        institutionName,
        accountType,
        accountNumberLast4,
        action,
        existingAccountId,
        newAccountName,
        openingBalance,
        statements
      } = accountImport;

      let accountId = existingAccountId;

      if (action === 'create_new') {
        try {
          const mappedAccountType = accountType === 'credit' ? 'credit_card' : accountType;

          const { data: user } = await supabase.auth.getUser();
          if (!user?.user?.id) {
            throw new Error('User not authenticated');
          }

          const { data: profiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user.user.id)
            .eq('is_primary', true)
            .maybeSingle();

          if (!profiles) {
            throw new Error('No primary profile found');
          }

          const { data: chartAccounts } = await supabase
            .from('user_chart_of_accounts')
            .select('id')
            .eq('profile_id', profiles.id)
            .eq('account_class', 'asset')
            .eq('is_active', true)
            .limit(1);

          let chartAccountId = null;
          if (chartAccounts && chartAccounts.length > 0) {
            chartAccountId = chartAccounts[0].id;
          }

          const accountData = {
            profile_id: profiles.id,
            account_name: newAccountName,
            account_type: mappedAccountType,
            institution_name: institutionName,
            account_number_last4: accountNumberLast4,
            current_balance: openingBalance,
            is_active: true,
            source: 'manual'
          };

          if (chartAccountId) {
            accountData.chart_account_id = chartAccountId;
          }

          const { data: newAccount, error: accountError } = await supabase
            .from('accounts')
            .insert(accountData)
            .select()
            .single();

          if (accountError) throw accountError;

          accountId = newAccount.id;
          accountsCreated++;
        } catch (error) {
          console.error('Error creating account:', error);
          errors.push(`Failed to create account ${newAccountName}: ${error.message}`);
          continue;
        }
      }

      if (!accountId) {
        errors.push(`No account ID available for ${institutionName} ${accountType}`);
        continue;
      }

      const { data: existingTransactions } = await supabase
        .from('transactions')
        .select('date, amount, description')
        .eq('account_id', accountId);

      const existingSet = new Set(
        (existingTransactions || []).map(tx =>
          `${tx.date}|${tx.amount}|${tx.description}`
        )
      );

      const transactionsToInsert = [];

      for (const statement of statements) {
        const transactions = statement.transactions_data || [];

        for (const tx of transactions) {
          const key = `${tx.date}|${tx.amount}|${tx.description}`;

          if (existingSet.has(key)) {
            duplicatesSkipped++;
            continue;
          }

          transactionsToInsert.push({
            account_id: accountId,
            date: tx.date,
            description: tx.description,
            amount: parseFloat(tx.amount),
            transaction_type: tx.type === 'income' ? 'income' : 'expense',
            status: 'posted',
            source: 'statement_cache'
          });
        }
      }

      if (transactionsToInsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < transactionsToInsert.length; i += batchSize) {
          const batch = transactionsToInsert.slice(i, i + batchSize);

          const { error: insertError } = await supabase
            .from('transactions')
            .insert(batch);

          if (insertError) {
            console.error('Error inserting transactions batch:', insertError);
            errors.push(`Failed to insert some transactions for account ${accountId}: ${insertError.message}`);
          } else {
            transactionsImported += batch.length;
          }
        }
      }
    }

    return {
      success: true,
      accountsCreated,
      transactionsImported,
      duplicatesSkipped,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('Import failed:', error);
    throw new Error(`Import failed: ${error.message}`);
  }
}
