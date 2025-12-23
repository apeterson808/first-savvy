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

  async getIncomeClassifications() {
    const { data, error } = await supabase
      .from('account_classifications')
      .select('*')
      .eq('class', 'income')
      .eq('is_active', true)
      .order('type')
      .order('category');

    if (error) throw error;
    return data || [];
  },

  async getExpenseClassifications() {
    const { data, error } = await supabase
      .from('account_classifications')
      .select('*')
      .eq('class', 'expense')
      .eq('is_active', true)
      .order('type')
      .order('category');

    if (error) throw error;
    return data || [];
  },

  async getAssetClassifications() {
    const { data, error } = await supabase
      .from('account_classifications')
      .select('*')
      .eq('class', 'asset')
      .eq('is_active', true)
      .order('type')
      .order('category');

    if (error) throw error;
    return data || [];
  },

  async getLiabilityClassifications() {
    const { data, error } = await supabase
      .from('account_classifications')
      .select('*')
      .eq('class', 'liability')
      .eq('is_active', true)
      .order('type')
      .order('category');

    if (error) throw error;
    return data || [];
  },

  groupByType(classifications) {
    const grouped = {};
    classifications.forEach(classification => {
      const type = classification.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(classification);
    });
    return grouped;
  },

  groupByClass(classifications) {
    const grouped = {};
    classifications.forEach(classification => {
      const classType = classification.class;
      if (!grouped[classType]) {
        grouped[classType] = [];
      }
      grouped[classType].push(classification);
    });
    return grouped;
  },

  getClassBadgeColor(classType) {
    const colors = {
      asset: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      liability: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      income: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
      expense: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
      equity: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' }
    };
    return colors[classType] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
  },

  getClassLabel(classType) {
    const labels = {
      asset: 'Asset',
      liability: 'Liability',
      income: 'Income',
      expense: 'Expense',
      equity: 'Equity'
    };
    return labels[classType] || classType;
  },

  formatClassificationPath(classification) {
    const displayName = this.getDisplayName(classification);
    return `${classification.type} › ${displayName}`;
  },

  async updateColorAndIcon(id, { color, icon }) {
    const updates = {};
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;

    const { data, error } = await supabase
      .from('account_classifications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
