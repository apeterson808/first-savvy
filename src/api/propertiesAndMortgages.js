import { supabase } from './supabaseClient';

export async function createPropertyAsset(propertyData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const assetRecord = {
    user_id: user.id,
    profile_id: profileId,
    name: propertyData.name,
    type: 'Asset',
    detail_type: 'property',
    current_balance: propertyData.estimatedValue,
    property_address: propertyData.address || null,
    property_city: propertyData.city || null,
    property_state: propertyData.state || null,
    property_zip: propertyData.zip || null,
    property_type: propertyData.propertyType || null,
    property_square_feet: propertyData.squareFeet ? parseInt(propertyData.squareFeet) : null,
    property_bedrooms: propertyData.bedrooms ? parseFloat(propertyData.bedrooms) : null,
    property_bathrooms: propertyData.bathrooms ? parseFloat(propertyData.bathrooms) : null,
    property_purchase_price: propertyData.purchasePrice || null,
    property_purchase_date: propertyData.purchaseDate || null,
  };

  const { data, error } = await supabase
    .from('assets')
    .insert([assetRecord])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createMortgage(mortgageData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const liabilityRecord = {
    user_id: user.id,
    profile_id: profileId,
    name: mortgageData.name || `${mortgageData.lenderName} Mortgage`,
    type: 'Liability',
    detail_type: 'mortgage',
    current_balance: mortgageData.currentBalance,
    interest_rate: mortgageData.interestRate || null,
    original_loan_amount: mortgageData.originalAmount || mortgageData.currentBalance,
    loan_start_date: mortgageData.startDate || null,
    monthly_payment: mortgageData.monthlyPayment || null,
    payment_due_date: mortgageData.paymentDueDate || null,
    linked_asset_id: mortgageData.linkedAssetId || null,
    institution: mortgageData.lenderName || null,
  };

  const { data, error } = await supabase
    .from('liabilities')
    .insert([liabilityRecord])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createPropertyWithMortgage(propertyData, mortgageData, profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  try {
    const property = await createPropertyAsset(propertyData, profileId);

    const mortgage = await createMortgage({
      ...mortgageData,
      linkedAssetId: property.id,
    }, profileId);

    const { createAssetLiabilityLink } = await import('./vehiclesAndLoans');
    await createAssetLiabilityLink(property.id, mortgage.id, profileId);

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
    .from('assets')
    .select('*')
    .eq('id', propertyId)
    .eq('profile_id', profileId)
    .eq('detail_type', 'property')
    .single();

  if (propertyError) throw propertyError;

  const { data: links, error: linksError } = await supabase
    .from('asset_liability_links')
    .select(`
      *,
      liability:liabilities(*)
    `)
    .eq('asset_id', propertyId)
    .eq('profile_id', profileId);

  if (linksError) throw linksError;

  return {
    ...property,
    linkedMortgages: links || [],
  };
}

export async function getUnlinkedProperties(profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data: allProperties, error: propertiesError } = await supabase
    .from('assets')
    .select('*')
    .eq('profile_id', profileId)
    .eq('detail_type', 'property');

  if (propertiesError) throw propertiesError;

  const { data: linkedAssetIds, error: linksError } = await supabase
    .from('asset_liability_links')
    .select('asset_id')
    .eq('profile_id', profileId);

  if (linksError) throw linksError;

  const linkedIds = new Set(linkedAssetIds.map(link => link.asset_id));
  return allProperties.filter(property => !linkedIds.has(property.id));
}

export async function getUnlinkedMortgages(profileId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  if (!profileId) throw new Error('Profile ID is required');

  const { data, error } = await supabase
    .from('liabilities')
    .select('*')
    .eq('profile_id', profileId)
    .eq('detail_type', 'mortgage')
    .is('linked_asset_id', null);

  if (error) throw error;
  return data;
}
