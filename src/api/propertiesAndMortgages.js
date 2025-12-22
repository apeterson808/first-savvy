import { supabase } from './supabaseClient';

export async function createPropertyAsset(propertyData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const assetRecord = {
    user_id: user.id,
    name: propertyData.name,
    type: 'Property',
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

export async function createMortgage(mortgageData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const liabilityRecord = {
    user_id: user.id,
    name: mortgageData.name || `${mortgageData.lenderName} Mortgage`,
    type: 'Mortgage',
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

export async function createPropertyWithMortgage(propertyData, mortgageData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    const property = await createPropertyAsset(propertyData);

    const mortgage = await createMortgage({
      ...mortgageData,
      linkedAssetId: property.id,
    });

    const { createAssetLiabilityLink } = await import('./vehiclesAndLoans');
    await createAssetLiabilityLink(property.id, mortgage.id);

    return { property, mortgage };
  } catch (error) {
    throw error;
  }
}

export async function getPropertyWithMortgage(propertyId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: property, error: propertyError } = await supabase
    .from('assets')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .eq('type', 'Property')
    .single();

  if (propertyError) throw propertyError;

  const { data: links, error: linksError } = await supabase
    .from('asset_liability_links')
    .select(`
      *,
      liability:liabilities(*)
    `)
    .eq('asset_id', propertyId)
    .eq('user_id', user.id);

  if (linksError) throw linksError;

  return {
    ...property,
    linkedMortgages: links || [],
  };
}

export async function getUnlinkedProperties() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: allProperties, error: propertiesError } = await supabase
    .from('assets')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'Property');

  if (propertiesError) throw propertiesError;

  const { data: linkedAssetIds, error: linksError } = await supabase
    .from('asset_liability_links')
    .select('asset_id')
    .eq('user_id', user.id);

  if (linksError) throw linksError;

  const linkedIds = new Set(linkedAssetIds.map(link => link.asset_id));
  return allProperties.filter(property => !linkedIds.has(property.id));
}

export async function getUnlinkedMortgages() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('liabilities')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'Mortgage')
    .is('linked_asset_id', null);

  if (error) throw error;
  return data;
}
