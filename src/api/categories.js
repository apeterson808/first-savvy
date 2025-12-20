import { createSupabaseClient } from './supabaseClient';

const supabase = createSupabaseClient();

/**
 * Default system categories to seed for new users
 */
const DEFAULT_CATEGORIES = [
  // Income categories
  { name: 'Salary', type: 'income', color: '#10B981', icon: 'Briefcase', is_system: true },
  { name: 'Freelance', type: 'income', color: '#3B82F6', icon: 'Laptop', is_system: true },
  { name: 'Investment', type: 'income', color: '#8B5CF6', icon: 'TrendingUp', is_system: true },
  { name: 'Other Income', type: 'income', color: '#6B7280', icon: 'DollarSign', is_system: true },

  // Expense categories
  { name: 'Groceries', type: 'expense', color: '#F59E0B', icon: 'ShoppingCart', is_system: true },
  { name: 'Dining Out', type: 'expense', color: '#EF4444', icon: 'Utensils', is_system: true },
  { name: 'Transportation', type: 'expense', color: '#3B82F6', icon: 'Car', is_system: true },
  { name: 'Housing', type: 'expense', color: '#8B5CF6', icon: 'Home', is_system: true },
  { name: 'Utilities', type: 'expense', color: '#10B981', icon: 'Zap', is_system: true },
  { name: 'Entertainment', type: 'expense', color: '#EC4899', icon: 'Film', is_system: true },
  { name: 'Shopping', type: 'expense', color: '#F59E0B', icon: 'ShoppingBag', is_system: true },
  { name: 'Healthcare', type: 'expense', color: '#EF4444', icon: 'Heart', is_system: true },
  { name: 'Insurance', type: 'expense', color: '#3B82F6', icon: 'Shield', is_system: true },
  { name: 'Education', type: 'expense', color: '#8B5CF6', icon: 'BookOpen', is_system: true },
  { name: 'Other Expense', type: 'expense', color: '#6B7280', icon: 'DollarSign', is_system: true }
];

/**
 * Get all categories for the current user
 */
export async function getCategories(type = null) {
  let query = supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get a single category by ID
 */
export async function getCategory(id) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Create a new category
 */
export async function createCategory(categoryData) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('categories')
    .insert([{
      user_id: user.id,
      is_system: false,
      ...categoryData
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing category
 */
export async function updateCategory(id, updates) {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a category
 */
export async function deleteCategory(id) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Initialize default categories for a new user
 */
export async function initializeDefaultCategories() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  // Check if user already has categories
  const existingCategories = await getCategories();
  if (existingCategories.length > 0) {
    return existingCategories;
  }

  // Create default categories
  const categoriesToCreate = DEFAULT_CATEGORIES.map(cat => ({
    ...cat,
    user_id: user.id
  }));

  const { data, error } = await supabase
    .from('categories')
    .insert(categoriesToCreate)
    .select();

  if (error) throw error;
  return data || [];
}

/**
 * Get income categories
 */
export async function getIncomeCategories() {
  return getCategories('income');
}

/**
 * Get expense categories
 */
export async function getExpenseCategories() {
  return getCategories('expense');
}
