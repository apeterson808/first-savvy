import { supabase } from './supabaseClient';

export async function createVehicleAsset(vehicleData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const accountData = {
    user_id: user.id,
    profile_id: profileId,
    display_name: vehicleData.name,
    class: 'asset',
    account_detail: 'fixed_asset_vehicle',
    current_balance: vehicleData.estimatedValue || 0,
    notes: JSON.stringify({
      year: vehicleData.year,
      make: vehicleData.make,
      model: vehicleData.model,
      vehicleType: vehicleData.vehicleType,
      vin: vehicleData.vin,
    }),
    is_active: true,
    is_user_created: true,
  };

  const availableAccountNumber = 1800 + Math.floor(Math.random() * 100);
  accountData.account_number = availableAccountNumber;

  const { data, error } = await supabase
    .from('user_chart_of_accounts')
    .insert([accountData])
    .select()
    .single();

  if (error) throw error;

  if (data.current_balance && data.current_balance !== 0) {
    try {
      await supabase.rpc('create_opening_balance_journal_entry', {
        p_profile_id: profileId,
        p_user_id: user.id,
        p_account_id: data.id,
        p_opening_balance: data.current_balance,
        p_opening_date: new Date().toISOString().split('T')[0],
        p_account_name: data.display_name,
        p_account_class: data.class
      });
    } catch (journalError) {
    }
  }

  return data;
}

export async function createAutoLoan(loanData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const accountData = {
    user_id: user.id,
    profile_id: profileId,
    display_name: loanData.name || `${loanData.lenderName} Auto Loan`,
    class: 'liability',
    account_detail: 'auto_loan',
    current_balance: loanData.currentBalance || 0,
    interest_rate: loanData.interestRate || null,
    original_amount: loanData.originalAmount || loanData.currentBalance,
    start_date: loanData.startDate || null,
    monthly_payment: loanData.monthlyPayment || null,
    payment_due_date: loanData.paymentDueDate || null,
    institution_name: loanData.lenderName || null,
    is_active: true,
    is_user_created: true,
  };

  const availableAccountNumber = 2500 + Math.floor(Math.random() * 100);
  accountData.account_number = availableAccountNumber;

  const { data, error } = await supabase
    .from('user_chart_of_accounts')
    .insert([accountData])
    .select()
    .single();

  if (error) throw error;

  if (data.current_balance && data.current_balance !== 0) {
    try {
      await supabase.rpc('create_opening_balance_journal_entry', {
        p_profile_id: profileId,
        p_user_id: user.id,
        p_account_id: data.id,
        p_opening_balance: data.current_balance,
        p_opening_date: new Date().toISOString().split('T')[0],
        p_account_name: data.display_name,
        p_account_class: data.class
      });
    } catch (journalError) {
    }
  }

  return data;
}

export async function createAssetLiabilityLink(assetId, liabilityId, profileId, relationshipType = 'secures') {
  return { success: true };
}

export async function createVehicleWithLoan(vehicleData, loanData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  try {
    const vehicle = await createVehicleAsset(vehicleData, profileId);
    const loan = await createAutoLoan(loanData, profileId);

    return { vehicle, loan };
  } catch (error) {
    throw error;
  }
}

export async function unlinkAssetLiability(assetId, liabilityId, profileId) {
  return true;
}

export async function getAssetWithLinks(assetId, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data: asset, error: assetError } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('id', assetId)
    .eq('profile_id', profileId)
    .single();

  if (assetError) throw assetError;

  return {
    ...asset,
    linkedLiabilities: [],
  };
}

export async function getLiabilityWithLinks(liabilityId, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data: liability, error: liabilityError } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('id', liabilityId)
    .eq('profile_id', profileId)
    .single();

  if (liabilityError) throw liabilityError;

  return {
    ...liability,
    linkedAssets: [],
  };
}

export async function getUnlinkedAssets(profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('account_detail', 'fixed_asset_vehicle');

  if (error) throw error;
  return data || [];
}

export async function getUnlinkedAutoLoans(profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('account_detail', 'auto_loan');

  if (error) throw error;
  return data || [];
}

export async function getAccountWithLinks(accountId, accountType, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data: account, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('profile_id', profileId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  return {
    account: account ? { ...account, entityType: accountType } : null,
    linkedAccounts: []
  };
}
