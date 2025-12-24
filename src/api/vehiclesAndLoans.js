import { supabase } from './supabaseClient';

export async function createVehicleAsset(vehicleData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const assetRecord = {
    user_id: user.id,
    profile_id: profileId,
    name: vehicleData.name,
    type: 'Asset',
    detail_type: 'vehicle',
    current_balance: vehicleData.estimatedValue,
    vehicle_year: vehicleData.year,
    vehicle_make: vehicleData.make,
    vehicle_model: vehicleData.model,
    vehicle_type: vehicleData.vehicleType,
    vin: vehicleData.vin || null,
  };

  const { data, error } = await supabase
    .from('assets')
    .insert([assetRecord])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createAutoLoan(loanData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const liabilityRecord = {
    user_id: user.id,
    profile_id: profileId,
    name: loanData.name || `${loanData.lenderName} Auto Loan`,
    type: 'Liability',
    detail_type: 'auto_loan',
    current_balance: loanData.currentBalance,
    interest_rate: loanData.interestRate || null,
    original_loan_amount: loanData.originalAmount || loanData.currentBalance,
    loan_start_date: loanData.startDate || null,
    monthly_payment: loanData.monthlyPayment || null,
    payment_due_date: loanData.paymentDueDate || null,
    linked_asset_id: loanData.linkedAssetId || null,
    institution: loanData.lenderName || null,
  };

  const { data, error } = await supabase
    .from('liabilities')
    .insert([liabilityRecord])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createAssetLiabilityLink(assetId, liabilityId, profileId, relationshipType = 'secures') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const linkRecord = {
    user_id: user.id,
    profile_id: profileId,
    asset_id: assetId,
    liability_id: liabilityId,
    relationship_type: relationshipType,
  };

  const { data, error } = await supabase
    .from('asset_liability_links')
    .insert([linkRecord])
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('liabilities')
    .update({ linked_asset_id: assetId })
    .eq('id', liabilityId)
    .eq('profile_id', profileId);

  return data;
}

export async function createVehicleWithLoan(vehicleData, loanData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  try {
    const vehicle = await createVehicleAsset(vehicleData, profileId);

    const loan = await createAutoLoan({
      ...loanData,
      linkedAssetId: vehicle.id,
    }, profileId);

    await createAssetLiabilityLink(vehicle.id, loan.id, profileId);

    return { vehicle, loan };
  } catch (error) {
    throw error;
  }
}

export async function unlinkAssetLiability(assetId, liabilityId, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { error: linkError } = await supabase
    .from('asset_liability_links')
    .delete()
    .match({ asset_id: assetId, liability_id: liabilityId, profile_id: profileId });

  if (linkError) throw linkError;

  const { error: liabilityError } = await supabase
    .from('liabilities')
    .update({ linked_asset_id: null })
    .eq('id', liabilityId)
    .eq('profile_id', profileId);

  if (liabilityError) throw liabilityError;

  return true;
}

export async function getAssetWithLinks(assetId, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('*')
    .eq('id', assetId)
    .eq('profile_id', profileId)
    .single();

  if (assetError) throw assetError;

  const { data: links, error: linksError } = await supabase
    .from('asset_liability_links')
    .select(`
      *,
      liability:liabilities(*)
    `)
    .eq('asset_id', assetId)
    .eq('profile_id', profileId);

  if (linksError) throw linksError;

  return {
    ...asset,
    linkedLiabilities: links || [],
  };
}

export async function getLiabilityWithLinks(liabilityId, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data: liability, error: liabilityError } = await supabase
    .from('liabilities')
    .select('*')
    .eq('id', liabilityId)
    .eq('profile_id', profileId)
    .single();

  if (liabilityError) throw liabilityError;

  const { data: links, error: linksError } = await supabase
    .from('asset_liability_links')
    .select(`
      *,
      asset:assets(*)
    `)
    .eq('liability_id', liabilityId)
    .eq('profile_id', profileId);

  if (linksError) throw linksError;

  return {
    ...liability,
    linkedAssets: links || [],
  };
}

export async function getUnlinkedAssets(profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data: allAssets, error: assetsError } = await supabase
    .from('assets')
    .select('*')
    .eq('profile_id', profileId)
    .eq('detail_type', 'vehicle');

  if (assetsError) throw assetsError;

  const { data: linkedAssetIds, error: linksError } = await supabase
    .from('asset_liability_links')
    .select('asset_id')
    .eq('profile_id', profileId);

  if (linksError) throw linksError;

  const linkedIds = new Set(linkedAssetIds.map(link => link.asset_id));
  return allAssets.filter(asset => !linkedIds.has(asset.id));
}

export async function getUnlinkedAutoLoans(profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data, error } = await supabase
    .from('liabilities')
    .select('*')
    .eq('profile_id', profileId)
    .eq('detail_type', 'auto_loan')
    .is('linked_asset_id', null);

  if (error) throw error;
  return data;
}

export async function getAccountWithLinks(accountId, accountType, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  let account = null;
  let linkedAccounts = [];

  if (accountType === 'Asset') {
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', accountId)
      .eq('profile_id', profileId)
      .single();

    if (assetError && assetError.code !== 'PGRST116') throw assetError;
    if (asset) {
      account = { ...asset, entityType: 'Asset' };

      const { data: links, error: linksError } = await supabase
        .from('asset_liability_links')
        .select(`
          *,
          liability:liabilities(*)
        `)
        .eq('asset_id', accountId)
        .eq('profile_id', profileId);

      if (linksError) throw linksError;
      linkedAccounts = (links || []).map(link => ({
        ...link.liability,
        entityType: 'Liability',
        linkType: link.relationship_type,
        linkId: link.id
      }));
    }
  } else if (accountType === 'Liability') {
    const { data: liability, error: liabilityError } = await supabase
      .from('liabilities')
      .select('*')
      .eq('id', accountId)
      .eq('profile_id', profileId)
      .single();

    if (liabilityError && liabilityError.code !== 'PGRST116') throw liabilityError;
    if (liability) {
      account = { ...liability, entityType: 'Liability' };

      const { data: links, error: linksError } = await supabase
        .from('asset_liability_links')
        .select(`
          *,
          asset:assets(*)
        `)
        .eq('liability_id', accountId)
        .eq('profile_id', profileId);

      if (linksError) throw linksError;
      linkedAccounts = (links || []).map(link => ({
        ...link.asset,
        entityType: 'Asset',
        linkType: link.relationship_type,
        linkId: link.id
      }));
    }
  } else if (accountType === 'Equity') {
    const { data: equity, error: equityError } = await supabase
      .from('equity')
      .select('*')
      .eq('id', accountId)
      .eq('profile_id', profileId)
      .single();

    if (equityError && equityError.code !== 'PGRST116') throw equityError;
    if (equity) {
      account = { ...equity, entityType: 'Equity' };
    }
  }

  return {
    account,
    linkedAccounts
  };
}
