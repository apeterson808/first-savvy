import { supabase } from './supabaseClient';

export const childProfilesAPI = {
  async getChildProfiles(profileId) {
    const { data, error } = await supabase
      .from('child_profiles')
      .select(`
        *,
        permission_levels (
          level_number,
          level_name,
          level_description
        )
      `)
      .eq('parent_profile_id', profileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getChildProfileById(childId) {
    const { data, error } = await supabase
      .from('child_profiles')
      .select(`
        *,
        permission_levels (
          level_number,
          level_name,
          level_description
        )
      `)
      .eq('id', childId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createChildProfile(profileId, childData) {
    const { data, error } = await supabase
      .from('child_profiles')
      .insert({
        parent_profile_id: profileId,
        child_name: childData.child_name,
        date_of_birth: childData.date_of_birth,
        avatar_url: childData.avatar_url,
        current_permission_level: childData.current_permission_level || 1,
        points_balance: 0,
        cash_balance: 0,
        daily_spending_limit: childData.daily_spending_limit,
        weekly_spending_limit: childData.weekly_spending_limit,
        monthly_spending_limit: childData.monthly_spending_limit,
        notes: childData.notes,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateChildProfile(childId, updates) {
    const { data, error } = await supabase
      .from('child_profiles')
      .update(updates)
      .eq('id', childId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateChildLevel(childId, newLevel, userId, reason) {
    const { data: childData, error: childError } = await supabase
      .from('child_profiles')
      .select('current_permission_level')
      .eq('id', childId)
      .single();

    if (childError) throw childError;

    const { error: transitionError } = await supabase
      .from('level_transition_history')
      .insert({
        child_profile_id: childId,
        from_level: childData.current_permission_level,
        to_level: newLevel,
        changed_by_user_id: userId,
        reason_note: reason,
      });

    if (transitionError) throw transitionError;

    const { data, error } = await supabase
      .from('child_profiles')
      .update({ current_permission_level: newLevel })
      .eq('id', childId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getLevelTransitionHistory(childId) {
    const { data, error } = await supabase
      .from('level_transition_history')
      .select('*')
      .eq('child_profile_id', childId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getPermissionLevels() {
    const { data, error } = await supabase
      .from('permission_levels')
      .select('*')
      .order('level_number');

    if (error) throw error;
    return data;
  },

  async getPermissionLevelFeatures(levelNumber) {
    const { data, error } = await supabase
      .from('permission_level_features')
      .select('*')
      .eq('level_number', levelNumber)
      .eq('is_enabled', true);

    if (error) throw error;
    return data;
  },

  async updatePointsBalance(childId, amount, operation = 'add') {
    const { data: child, error: fetchError } = await supabase
      .from('child_profiles')
      .select('points_balance')
      .eq('id', childId)
      .single();

    if (fetchError) throw fetchError;

    const newBalance = operation === 'add'
      ? child.points_balance + amount
      : child.points_balance - amount;

    if (newBalance < 0) {
      throw new Error('Insufficient points balance');
    }

    const { data, error } = await supabase
      .from('child_profiles')
      .update({ points_balance: newBalance })
      .eq('id', childId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCashBalance(childId, amount, operation = 'add') {
    const { data: child, error: fetchError } = await supabase
      .from('child_profiles')
      .select('cash_balance')
      .eq('id', childId)
      .single();

    if (fetchError) throw fetchError;

    const newBalance = operation === 'add'
      ? parseFloat(child.cash_balance) + parseFloat(amount)
      : parseFloat(child.cash_balance) - parseFloat(amount);

    if (newBalance < 0) {
      throw new Error('Insufficient cash balance');
    }

    const { data, error } = await supabase
      .from('child_profiles')
      .update({ cash_balance: newBalance })
      .eq('id', childId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getChildAchievements(childId) {
    const { data, error } = await supabase
      .from('child_achievements')
      .select('*')
      .eq('child_profile_id', childId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createAchievement(childId, achievementData) {
    const { data, error } = await supabase
      .from('child_achievements')
      .insert({
        child_profile_id: childId,
        achievement_type: achievementData.achievement_type,
        achievement_name: achievementData.achievement_name,
        achievement_description: achievementData.achievement_description,
        icon: achievementData.icon,
        color: achievementData.color,
        points_awarded: achievementData.points_awarded || 0,
        metadata: achievementData.metadata,
      })
      .select()
      .single();

    if (error) throw error;

    if (achievementData.points_awarded > 0) {
      await this.updatePointsBalance(childId, achievementData.points_awarded, 'add');
    }

    return data;
  },

  async deleteChildProfile(childId) {
    const { error } = await supabase
      .from('child_profiles')
      .update({ is_active: false })
      .eq('id', childId);

    if (error) throw error;
  },
};
