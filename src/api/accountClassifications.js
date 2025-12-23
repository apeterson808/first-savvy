import { supabase } from './supabaseClient';

export const accountClassifications = {
  async getAll() {
    const { data, error } = await supabase
      .from('account_classifications')
      .select('*')
      .eq('is_active', true)
      .order('class')
      .order('type')
      .order('category');

    if (error) throw error;
    return data || [];
  },

  async getByClass(classType) {
    const { data, error } = await supabase
      .from('account_classifications')
      .select('*')
      .eq('class', classType)
      .eq('is_active', true)
      .order('type')
      .order('category');

    if (error) throw error;
    return data || [];
  },

  async getByType(type) {
    const { data, error } = await supabase
      .from('account_classifications')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .order('category');

    if (error) throw error;
    return data || [];
  },

  async getByClassAndType(classType, type) {
    const { data, error } = await supabase
      .from('account_classifications')
      .select('*')
      .eq('class', classType)
      .eq('type', type)
      .eq('is_active', true)
      .order('category');

    if (error) throw error;
    return data || [];
  },

  async getTypes(classType = null) {
    let query = supabase
      .from('account_classifications')
      .select('type')
      .eq('is_active', true);

    if (classType) {
      query = query.eq('class', classType);
    }

    const { data, error } = await query;
    if (error) throw error;

    const uniqueTypes = [...new Set(data.map(item => item.type))];
    return uniqueTypes.sort();
  },

  async updateDisplayName(id, displayName) {
    const { data, error } = await supabase
      .from('account_classifications')
      .update({ display_name: displayName })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createCustom(classification) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { data: existing } = await supabase
      .from('account_classifications')
      .select('id')
      .eq('user_id', userId)
      .eq('class', classification.class)
      .eq('type', classification.type)
      .eq('category', classification.category)
      .maybeSingle();

    if (existing) {
      throw new Error('A classification with this class, type, and category already exists');
    }

    const { data, error } = await supabase
      .from('account_classifications')
      .insert({
        user_id: userId,
        class: classification.class,
        type: classification.type,
        category: classification.category,
        display_name: classification.display_name || null,
        is_custom: true,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async toggleActive(id, isActive) {
    const { data, error } = await supabase
      .from('account_classifications')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCustom(id) {
    const { data: classification } = await supabase
      .from('account_classifications')
      .select('is_custom')
      .eq('id', id)
      .single();

    if (!classification || !classification.is_custom) {
      throw new Error('Can only delete custom classifications');
    }

    const { error } = await supabase
      .from('account_classifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  },

  getDisplayName(classification) {
    return classification.display_name || classification.category;
  },

  isSystemDefined(classification) {
    return !classification.is_custom;
  },

  async getClassificationForAccount(accountType, detailType = null) {
    const typeMap = {
      'checking': { class: 'asset', type: 'bank accounts', category: 'checking' },
      'savings': { class: 'asset', type: 'bank accounts', category: 'savings' },
      'credit_card': { class: 'liability', type: 'credit card', category: 'personal credit card' },
      'investment': { class: 'asset', type: 'investments', category: 'brokerage' },
      'cash': { class: 'asset', type: 'cash', category: 'physical cash' },
      'loan': { class: 'liability', type: 'loans & debt', category: 'personal loan' }
    };

    const mapping = typeMap[accountType];
    if (!mapping) return null;

    const { data, error } = await supabase
      .from('account_classifications')
      .select('*')
      .eq('class', mapping.class)
      .eq('type', mapping.type)
      .eq('category', mapping.category)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
};
