import { supabase } from './supabaseClient';

export async function createVehicleAsset(vehicleData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const assetRecord = {
    user_id: user.id,
    name: vehicleData.name,
    type: 'Vehicle',
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

export async function createAutoLoan(loanData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const liabilityRecord = {
    user_id: user.id,
    name: loanData.name || `${loanData.lenderName} Auto Loan`,
    type: 'Auto Loan',
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

export async function createAssetLiabilityLink(assetId, liabilityId, relationshipType = 'secures') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const linkRecord = {
    user_id: user.id,
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
    .eq('id', liabilityId);

  return data;
}

export async function createVehicleWithLoan(vehicleData, loanData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    const vehicle = await createVehicleAsset(vehicleData);

    const loan = await createAutoLoan({
      ...loanData,
      linkedAssetId: vehicle.id,
    });

    await createAssetLiabilityLink(vehicle.id, loan.id);

    return { vehicle, loan };
  } catch (error) {
    throw error;
  }
}

export async function unlinkAssetLiability(assetId, liabilityId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error: linkError } = await supabase
    .from('asset_liability_links')
    .delete()
    .match({ asset_id: assetId, liability_id: liabilityId, user_id: user.id });

  if (linkError) throw linkError;

  const { error: liabilityError } = await supabase
    .from('liabilities')
    .update({ linked_asset_id: null })
    .eq('id', liabilityId);

  if (liabilityError) throw liabilityError;

  return true;
}

export async function getAssetWithLinks(assetId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('*')
    .eq('id', assetId)
    .eq('user_id', user.id)
    .single();

  if (assetError) throw assetError;

  const { data: links, error: linksError } = await supabase
    .from('asset_liability_links')
    .select(`
      *,
      liability:liabilities(*)
    `)
    .eq('asset_id', assetId)
    .eq('user_id', user.id);

  if (linksError) throw linksError;

  return {
    ...asset,
    linkedLiabilities: links || [],
  };
}

export async function getLiabilityWithLinks(liabilityId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: liability, error: liabilityError } = await supabase
    .from('liabilities')
    .select('*')
    .eq('id', liabilityId)
    .eq('user_id', user.id)
    .single();

  if (liabilityError) throw liabilityError;

  const { data: links, error: linksError } = await supabase
    .from('asset_liability_links')
    .select(`
      *,
      asset:assets(*)
    `)
    .eq('liability_id', liabilityId)
    .eq('user_id', user.id);

  if (linksError) throw linksError;

  return {
    ...liability,
    linkedAssets: links || [],
  };
}

export async function getUnlinkedAssets() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: allAssets, error: assetsError } = await supabase
    .from('assets')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'Vehicle');

  if (assetsError) throw assetsError;

  const { data: linkedAssetIds, error: linksError } = await supabase
    .from('asset_liability_links')
    .select('asset_id')
    .eq('user_id', user.id);

  if (linksError) throw linksError;

  const linkedIds = new Set(linkedAssetIds.map(link => link.asset_id));
  return allAssets.filter(asset => !linkedIds.has(asset.id));
}

export async function getUnlinkedAutoLoans() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('liabilities')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'Auto Loan')
    .is('linked_asset_id', null);

  if (error) throw error;
  return data;
}
