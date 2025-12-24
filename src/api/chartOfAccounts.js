import { supabase } from './supabaseClient';

export const getChartOfAccountsTemplates = async () => {
  const { data, error } = await supabase
    .from('chart_of_accounts_templates')
    .select('*')
    .order('account_type, sort_order, account_number');

  if (error) throw error;
  return data;
};

export const getUserChartOfAccounts = async (profileId, filters = {}) => {
  let query = supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId);

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

export const getUserChartOfAccountsHierarchy = async (profileId, accountType = null) => {
  const filters = accountType ? { accountType } : {};
  const accounts = await getUserChartOfAccounts(profileId, filters);

  const accountMap = {};
  const rootAccounts = [];

  accounts.forEach(account => {
    const displayName = account.custom_display_name || account.category || account.account_detail || account.display_name_default;
    accountMap[account.account_number] = {
      ...account,
      displayName,
      children: []
    };
  });

  accounts.forEach(account => {
    if (account.parent_account_number && accountMap[account.parent_account_number]) {
      accountMap[account.parent_account_number].children.push(accountMap[account.account_number]);
    } else if (account.level === 1) {
      rootAccounts.push(accountMap[account.account_number]);
    }
  });

  return rootAccounts;
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
  return getUserChartOfAccounts(profileId, { accountType: 'income', isActive: true });
};

export const getExpenseAccounts = async (profileId) => {
  return getUserChartOfAccounts(profileId, { accountType: 'expense', isActive: true });
};

export const getAssetAccounts = async (profileId) => {
  return getUserChartOfAccounts(profileId, { accountType: 'asset', isActive: true });
};

export const getLiabilityAccounts = async (profileId) => {
  return getUserChartOfAccounts(profileId, { accountType: 'liability', isActive: true });
};

export const getEquityAccounts = async (profileId) => {
  return getUserChartOfAccounts(profileId, { accountType: 'equity', isActive: true });
};

export const getAccountNumberRanges = async (accountType) => {
  const { data, error } = await supabase
    .from('chart_of_accounts_templates')
    .select('number_range_start, number_range_end')
    .eq('account_type', accountType)
    .eq('level', 1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getDisplayName = (account) => {
  return account.custom_display_name ||
         account.category ||
         account.account_detail ||
         account.display_name_default ||
         'Unnamed Account';
};

export const getFullDisplayName = (account) => {
  const displayName = getDisplayName(account);
  return `${account.account_number} - ${displayName}`;
};
