import { supabase } from './supabaseClient';

export const mealPlanEntriesAPI = {
  async getEntriesForRange(profileId, startDate, endDate) {
    const { data, error } = await supabase
      .from('meal_plan_entries')
      .select(`
        *,
        meal_recipes (
          id,
          name,
          description,
          category,
          prep_time_minutes,
          ingredients,
          tags
        )
      `)
      .eq('profile_id', profileId)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })
      .order('meal_type', { ascending: true });

    if (error) throw error;
    return data;
  },

  async createEntry(profileId, entryData) {
    const { data, error } = await supabase
      .from('meal_plan_entries')
      .insert({
        profile_id: profileId,
        recipe_id: entryData.recipe_id || null,
        custom_meal_name: entryData.custom_meal_name || '',
        scheduled_date: entryData.scheduled_date,
        meal_type: entryData.meal_type || 'dinner',
        serves: entryData.serves || 4,
        notes: entryData.notes || '',
      })
      .select(`
        *,
        meal_recipes (
          id,
          name,
          description,
          category,
          prep_time_minutes,
          ingredients,
          tags
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async updateEntry(entryId, updates) {
    const { data, error } = await supabase
      .from('meal_plan_entries')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', entryId)
      .select(`
        *,
        meal_recipes (
          id,
          name,
          description,
          category,
          prep_time_minutes,
          ingredients,
          tags
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteEntry(entryId) {
    const { error } = await supabase
      .from('meal_plan_entries')
      .delete()
      .eq('id', entryId);

    if (error) throw error;
  },
};
