import { supabase } from './supabaseClient';

export const getChartOfAccountsTemplates = async () => {
  const { data, error } = await supabase
    .from('chart_of_accounts_templates')
    .select('*')
    .order('class, sort_order, account_number');

  if (error) throw error;
  return data;
};

export const getUserChartOfAccounts = async (profileId, filters = {}) => {
  let query = supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId);

  if (filters.class) {
    query = query.eq('class', filters.class);
  }

  if (filters.accountType) {
    query = query.eq('account_type', filters.accountType);
  }

  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }

  if (filters.isUserCreated !== undefined) {
    query = query.eq('is_user_created', filters.isUserCreated);
  }

  query = query.order('account_number');

  const { data, error } = await query;

  if (error) throw error;
  return data;
};

export const getUserChartOfAccountsHierarchy = async (profileId, classFilter = null) => {
  const filters = classFilter ? { class: classFilter } : {};
  const accounts = await getUserChartOfAccounts(profileId, filters);

  const grouped = {};

  accounts.forEach(account => {
    const classKey = account.class || 'other';
    const typeKey = account.account_type || 'uncategorized';

    if (!grouped[classKey]) {
      grouped[classKey] = {};
    }

    if (!grouped[classKey][typeKey]) {
      grouped[classKey][typeKey] = [];
    }

    grouped[classKey][typeKey].push({
      ...account,
      displayName: account.display_name || account.account_detail || 'Unnamed Account'
    });
  });

  return grouped;
};

export const getChartAccountById = async (accountId) => {
  const { data, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getChartAccountByNumber = async (profileId, accountNumber) => {
  const { data, error} = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('account_number', accountNumber)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const createUserIncomeCategory = async (profileId, categoryData) => {
  const { data, error } = await supabase.rpc('add_user_income_category', {
    p_profile_id: profileId,
    p_category_name: categoryData.name,
    p_account_number: categoryData.accountNumber || null,
    p_icon: categoryData.icon || null,
    p_color: categoryData.color || null
  });

  if (error) throw error;
  return data;
};

export const createUserExpenseCategory = async (profileId, categoryData) => {
  const { data, error } = await supabase.rpc('add_user_expense_category', {
    p_profile_id: profileId,
    p_category_name: categoryData.name,
    p_account_number: categoryData.accountNumber || null,
    p_icon: categoryData.icon || null,
    p_color: categoryData.color || null
  });

  if (error) throw error;
  return data;
};

export const updateAccountDisplayName = async (accountId, newDisplayName) => {
  const { error } = await supabase.rpc('update_account_display_name', {
    p_account_id: accountId,
    p_new_display_name: newDisplayName
  });

  if (error) throw error;
};

export const updateAccountNumber = async (accountId, newAccountNumber) => {
  const { error } = await supabase.rpc('update_account_number', {
    p_account_id: accountId,
    p_new_account_number: newAccountNumber
  });

  if (error) throw error;
};

export const getNextAvailableAccountNumber = async (profileId, accountType) => {
  const { data, error } = await supabase.rpc('get_next_available_account_number', {
    p_profile_id: profileId,
    p_account_type: accountType
  });

  if (error) throw error;
  return data;
};

export const toggleAccountActive = async (accountId, isActive) => {
  const { error } = await supabase
    .from('user_chart_of_accounts')
    .update({ is_active: isActive })
    .eq('id', accountId);

  if (error) throw error;
};

export const deleteUserCreatedAccount = async (accountId) => {
  const account = await getChartAccountById(accountId);

  if (!account.is_user_created) {
    throw new Error('Only user-created accounts can be deleted');
  }

  const { error } = await supabase
    .from('user_chart_of_accounts')
    .delete()
    .eq('id', accountId);

  if (error) throw error;
};

export const updateAccountIconColor = async (accountId, icon, color) => {
  const { error } = await supabase
    .from('user_chart_of_accounts')
    .update({
      icon: icon || null,
      color: color || null
    })
    .eq('id', accountId);

  if (error) throw error;
};

export const getIncomeAccounts = async (profileId) => {
  return getUserChartOfAccounts(profileId, { class: 'income', isActive: true });
};

export const getExpenseAccounts = async (profileId) => {
  return getUserChartOfAccounts(profileId, { class: 'expense', isActive: true });
};

export const getAssetAccounts = async (profileId) => {
  return getUserChartOfAccounts(profileId, { class: 'asset', isActive: true });
};

export const getLiabilityAccounts = async (profileId) => {
  return getUserChartOfAccounts(profileId, { class: 'liability', isActive: true });
};

export const getEquityAccounts = async (profileId) => {
  return getUserChartOfAccounts(profileId, { class: 'equity', isActive: true });
};

export const getAccountNumberRanges = async (classValue) => {
  const accounts = await supabase
    .from('chart_of_accounts_templates')
    .select('account_number')
    .eq('class', classValue)
    .order('account_number');

  if (accounts.error) throw accounts.error;

  if (!accounts.data || accounts.data.length === 0) {
    return { start: null, end: null };
  }

  const numbers = accounts.data.map(a => a.account_number);
  return {
    start: Math.min(...numbers),
    end: Math.max(...numbers)
  };
};

export const getDisplayName = (account) => {
  return account.display_name ||
         account.account_detail ||
         'Unnamed Account';
};

export const getFullDisplayName = (account) => {
  const displayName = getDisplayName(account);
  return `${account.account_number} - ${displayName}`;
};
