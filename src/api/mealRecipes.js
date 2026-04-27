import { supabase } from './supabaseClient';

export const mealRecipesAPI = {
  async getRecipes(profileId, filters = {}) {
    let query = supabase
      .from('meal_recipes')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_active', true);

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createRecipe(profileId, recipeData) {
    const { data, error } = await supabase
      .from('meal_recipes')
      .insert({
        profile_id: profileId,
        name: recipeData.name,
        description: recipeData.description || '',
        category: recipeData.category || 'dinner',
        prep_time_minutes: recipeData.prep_time_minutes || 0,
        tags: recipeData.tags || [],
        ingredients: recipeData.ingredients || [],
        image_url: recipeData.image_url || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateRecipe(recipeId, updates) {
    const { data, error } = await supabase
      .from('meal_recipes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', recipeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteRecipe(recipeId) {
    const { error } = await supabase
      .from('meal_recipes')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', recipeId);

    if (error) throw error;
  },
};
