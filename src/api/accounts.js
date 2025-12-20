import { createSupabaseClient } from './supabaseClient';

const supabase = createSupabaseClient();

/**
 * Get all accounts for the current user
 */
export async function getAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single account by ID
 */
export async function getAccount(id) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get accounts by type
 */
export async function getAccountsByType(accountType) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_type', accountType)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new account
 */
export async function createAccount(accountData) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('accounts')
    .insert([{
      user_id: user.id,
      ...accountData
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing account
 */
export async function updateAccount(id, updates) {
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an account
 */
export async function deleteAccount(id) {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get total balance for all accounts
 */
export async function getTotalBalance() {
  const accounts = await getAccounts();
  return accounts.reduce((total, account) => {
    if (account.account_type === 'credit') {
      return total - parseFloat(account.balance || 0);
    }
    return total + parseFloat(account.balance || 0);
  }, 0);
}

/**
 * Get balance by account type
 */
export async function getBalanceByType(accountType) {
  const accounts = await getAccountsByType(accountType);
  return accounts.reduce((total, account) => {
    return total + parseFloat(account.balance || 0);
  }, 0);
}
