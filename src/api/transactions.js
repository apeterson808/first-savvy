import { createSupabaseClient } from './supabaseClient';

const supabase = createSupabaseClient();

/**
 * Get all transactions for the current user
 */
export async function getTransactions(filters = {}) {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      account:accounts(id, account_name, institution, account_type),
      category:categories(id, name, color, icon, type)
    `)
    .order('date', { ascending: false });

  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId);
  }

  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  if (filters.transactionType) {
    query = query.eq('transaction_type', filters.transactionType);
  }

  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }

  if (filters.searchTerm) {
    query = query.or(`description.ilike.%${filters.searchTerm}%,notes.ilike.%${filters.searchTerm}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get a single transaction by ID
 */
export async function getTransaction(id) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      account:accounts(id, account_name, institution, account_type),
      category:categories(id, name, color, icon, type)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Create a new transaction
 */
export async function createTransaction(transactionData) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('transactions')
    .insert([{
      user_id: user.id,
      ...transactionData
    }])
    .select(`
      *,
      account:accounts(id, account_name, institution, account_type),
      category:categories(id, name, color, icon, type)
    `)
    .single();

  if (error) throw error;

  // Update account balance
  if (data) {
    await updateAccountBalance(data.account_id);
  }

  return data;
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(id, updates) {
  const oldTransaction = await getTransaction(id);

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      account:accounts(id, account_name, institution, account_type),
      category:categories(id, name, color, icon, type)
    `)
    .single();

  if (error) throw error;

  // Update account balance if account or amount changed
  if (data && (oldTransaction.account_id !== data.account_id || oldTransaction.amount !== data.amount || oldTransaction.transaction_type !== data.transaction_type)) {
    await updateAccountBalance(data.account_id);
    if (oldTransaction.account_id !== data.account_id) {
      await updateAccountBalance(oldTransaction.account_id);
    }
  }

  return data;
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(id) {
  const transaction = await getTransaction(id);

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Update account balance
  if (transaction) {
    await updateAccountBalance(transaction.account_id);
  }
}

/**
 * Update account balance based on transactions
 */
async function updateAccountBalance(accountId) {
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, transaction_type')
    .eq('account_id', accountId);

  if (txError) throw txError;

  const balance = transactions.reduce((total, tx) => {
    if (tx.transaction_type === 'income') {
      return total + parseFloat(tx.amount || 0);
    } else {
      return total - parseFloat(tx.amount || 0);
    }
  }, 0);

  const { error: updateError } = await supabase
    .from('accounts')
    .update({ balance })
    .eq('id', accountId);

  if (updateError) throw updateError;
}

/**
 * Get transactions summary by category
 */
export async function getTransactionsSummary(filters = {}) {
  const transactions = await getTransactions(filters);

  const summary = {
    totalIncome: 0,
    totalExpense: 0,
    byCategory: {},
    count: transactions.length
  };

  transactions.forEach(tx => {
    const amount = parseFloat(tx.amount || 0);

    if (tx.transaction_type === 'income') {
      summary.totalIncome += amount;
    } else {
      summary.totalExpense += amount;
    }

    if (tx.category) {
      if (!summary.byCategory[tx.category.name]) {
        summary.byCategory[tx.category.name] = {
          category: tx.category,
          total: 0,
          count: 0
        };
      }
      summary.byCategory[tx.category.name].total += amount;
      summary.byCategory[tx.category.name].count += 1;
    }
  });

  return summary;
}

/**
 * Bulk import transactions
 */
export async function bulkImportTransactions(transactions) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const transactionsWithUser = transactions.map(tx => ({
    user_id: user.id,
    ...tx
  }));

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactionsWithUser)
    .select();

  if (error) throw error;

  // Update all affected account balances
  const affectedAccounts = [...new Set(transactions.map(tx => tx.account_id))];
  await Promise.all(affectedAccounts.map(accountId => updateAccountBalance(accountId)));

  return data;
}
