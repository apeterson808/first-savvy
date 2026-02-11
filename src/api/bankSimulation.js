import { supabase } from './supabaseClient';

export async function getAvailableInstitutions() {
  const { data, error } = await supabase
    .from('financial_institutions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('Error fetching institutions:', error);
    throw error;
  }

  return data || [];
}

export async function getInstitutionById(institutionId) {
  const { data, error } = await supabase
    .from('financial_institutions')
    .select('*')
    .eq('id', institutionId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching institution:', error);
    throw error;
  }

  return data;
}

export async function simulateConnection(institutionId, profileId = null) {
  return {
    success: false,
    error: 'Bank simulation is no longer available. Please use CSV import instead.'
  };
}

export async function getInstitutionAccounts(institutionId, profileId = null) {
  return [];
}

export async function getAccountTransactions(accountId, institutionId) {
  return [];
}

export async function getAccountSummary(accountId, institutionId) {
  throw new Error('Bank simulation is no longer available');
}
