import { supabase } from './supabaseClient';

export const getRetirementSettings = async (userId) => {
  const { data, error } = await supabase
    .from('retirement_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const upsertRetirementSettings = async (userId, settings) => {
  const { data, error } = await supabase
    .from('retirement_settings')
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
};
