import { supabase } from './supabaseClient';

export async function createPropertyAsset(propertyData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const accountData = {
    user_id: user.id,
    profile_id: profileId,
    display_name: propertyData.name,
    class: 'asset',
    account_detail: 'fixed_asset_property',
    current_balance: propertyData.estimatedValue || 0,
    purchase_price: propertyData.purchasePrice || null,
    purchase_date: propertyData.purchaseDate || null,
    notes: JSON.stringify({
      address: propertyData.address,
      city: propertyData.city,
      state: propertyData.state,
      zip: propertyData.zip,
      propertyType: propertyData.propertyType,
      squareFeet: propertyData.squareFeet,
      bedrooms: propertyData.bedrooms,
      bathrooms: propertyData.bathrooms,
    }),
    is_active: true,
    is_user_created: true,
  };

  const availableAccountNumber = 1700 + Math.floor(Math.random() * 100);
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

export async function createMortgage(mortgageData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const accountData = {
    user_id: user.id,
    profile_id: profileId,
    display_name: mortgageData.name || `${mortgageData.lenderName} Mortgage`,
    class: 'liability',
    account_detail: 'mortgage',
    current_balance: mortgageData.currentBalance || 0,
    interest_rate: mortgageData.interestRate || null,
    original_amount: mortgageData.originalAmount || mortgageData.currentBalance,
    start_date: mortgageData.startDate || null,
    monthly_payment: mortgageData.monthlyPayment || null,
    payment_due_date: mortgageData.paymentDueDate || null,
    institution_name: mortgageData.lenderName || null,
    is_active: true,
    is_user_created: true,
  };

  const availableAccountNumber = 2400 + Math.floor(Math.random() * 100);
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

export async function createPropertyWithMortgage(propertyData, mortgageData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  try {
    const property = await createPropertyAsset(propertyData, profileId);
    const mortgage = await createMortgage(mortgageData, profileId);

    return { property, mortgage };
  } catch (error) {
    throw error;
  }
}

export async function getPropertyWithMortgage(propertyId, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data: property, error: propertyError } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('id', propertyId)
    .eq('profile_id', profileId)
    .eq('account_detail', 'fixed_asset_property')
    .single();

  if (propertyError) throw propertyError;

  return {
    ...property,
    linkedMortgages: [],
  };
}

export async function getUnlinkedProperties(profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('account_detail', 'fixed_asset_property');

  if (error) throw error;
  return data || [];
}

export async function getUnlinkedMortgages(profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data, error } = await supabase
    .from('user_chart_of_accounts')
    .select('*')
    .eq('profile_id', profileId)
    .eq('account_detail', 'mortgage');

  if (error) throw error;
  return data || [];
}
