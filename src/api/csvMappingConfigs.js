import { firstsavvy } from './firstsavvyClient';

export const saveCsvMappingConfig = async (profileId, institutionName, mappingData) => {
  try {
    const { data: existing, error: fetchError } = await firstsavvy
      .from('csv_column_mapping_configs')
      .select('*')
      .eq('profile_id', profileId)
      .ilike('institution_name', institutionName)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      const { data, error } = await firstsavvy
        .from('csv_column_mapping_configs')
        .update({
          column_mappings: mappingData.columnMappings,
          date_format: mappingData.dateFormat,
          amount_type: mappingData.amountType,
          debit_column: mappingData.debitColumn || '',
          credit_column: mappingData.creditColumn || '',
          balance_column: mappingData.balanceColumn || '',
          use_count: existing.use_count + 1,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } else {
      const { data, error } = await firstsavvy
        .from('csv_column_mapping_configs')
        .insert({
          profile_id: profileId,
          institution_name: institutionName,
          column_mappings: mappingData.columnMappings,
          date_format: mappingData.dateFormat,
          amount_type: mappingData.amountType,
          debit_column: mappingData.debitColumn || '',
          credit_column: mappingData.creditColumn || '',
          balance_column: mappingData.balanceColumn || '',
          use_count: 1,
          last_used_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    }
  } catch (error) {
    return { data: null, error };
  }
};

export const getCsvMappingConfig = async (profileId, institutionName) => {
  try {
    if (!institutionName || institutionName.trim() === '') {
      return { data: null, error: null };
    }

    const { data, error } = await firstsavvy
      .from('csv_column_mapping_configs')
      .select('*')
      .eq('profile_id', profileId)
      .ilike('institution_name', institutionName)
      .order('use_count', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAllCsvMappingConfigs = async (profileId) => {
  try {
    const { data, error } = await firstsavvy
      .from('csv_column_mapping_configs')
      .select('*')
      .eq('profile_id', profileId)
      .order('use_count', { ascending: false })
      .order('last_used_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteCsvMappingConfig = async (configId) => {
  try {
    const { error } = await firstsavvy
      .from('csv_column_mapping_configs')
      .delete()
      .eq('id', configId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
};
