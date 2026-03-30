import { supabase } from './supabaseClient';

export const choresAPI = {
  async getChores(profileId, filters = {}) {
    let query = supabase
      .from('chores')
      .select(`
        *,
        child_profiles (
          id,
          child_name,
          avatar_url,
          current_permission_level
        )
      `)
      .eq('profile_id', profileId)
      .eq('is_active', true);

    if (filters.childId) {
      query = query.eq('assigned_to_child_id', filters.childId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.recurring !== undefined) {
      query = query.eq('is_recurring', filters.recurring);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getChoresByChild(childId) {
    const { data, error } = await supabase
      .from('chores')
      .select('*')
      .eq('assigned_to_child_id', childId)
      .eq('is_active', true)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data;
  },

  async createChore(profileId, choreData) {
    const { data, error } = await supabase
      .from('chores')
      .insert({
        profile_id: profileId,
        assigned_to_child_id: choreData.assigned_to_child_id,
        title: choreData.title,
        description: choreData.description,
        points_value: choreData.points_value || 0,
        due_date: choreData.due_date,
        recurrence_pattern: choreData.recurrence_pattern || 'once',
        is_recurring: choreData.is_recurring || false,
        next_recurrence_date: choreData.next_recurrence_date,
        created_by_user_id: choreData.created_by_user_id,
        icon: choreData.icon,
        color: choreData.color,
        metadata: choreData.metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateChore(choreId, updates) {
    const { data, error } = await supabase
      .from('chores')
      .update(updates)
      .eq('id', choreId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async completeChore(choreId, userId) {
    const { data, error } = await supabase
      .from('chores')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', choreId)
      .select(`
        *,
        child_profiles (
          id,
          child_name,
          current_permission_level
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async approveChore(choreId, userId, profileId) {
    const { data: chore, error: fetchError } = await supabase
      .from('chores')
      .select('*, child_profiles(*)')
      .eq('id', choreId)
      .single();

    if (fetchError) throw fetchError;

    const pointsToAward = Math.round(chore.points_value * (chore.bonus_multiplier || 1.0));

    const { data: updatedChild, error: balanceError } = await supabase
      .from('child_profiles')
      .update({
        points_balance: chore.child_profiles.points_balance + pointsToAward,
      })
      .eq('id', chore.assigned_to_child_id)
      .select()
      .single();

    if (balanceError) throw balanceError;

    const { error: txError } = await supabase
      .from('child_transactions')
      .insert({
        child_profile_id: chore.assigned_to_child_id,
        transaction_type: 'chore_payment',
        amount: pointsToAward,
        currency_type: 'points',
        description: `Completed: ${chore.title}`,
        status: 'completed',
        approved_by_user_id: userId,
        approved_at: new Date().toISOString(),
        related_chore_id: choreId,
        balance_after: updatedChild.points_balance,
      });

    if (txError) throw txError;

    const { data, error } = await supabase
      .from('chores')
      .update({
        status: 'approved',
        approved_by_user_id: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', choreId)
      .select()
      .single();

    if (error) throw error;

    if (chore.is_recurring && chore.next_recurrence_date) {
      await this.createRecurringChoreInstance(chore, profileId, userId);
    }

    return data;
  },

  async rejectChore(choreId, userId, reason) {
    const { data, error } = await supabase
      .from('chores')
      .update({
        status: 'rejected',
        approved_by_user_id: userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', choreId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createRecurringChoreInstance(originalChore, profileId, userId) {
    const nextDate = this.calculateNextRecurrence(
      originalChore.next_recurrence_date,
      originalChore.recurrence_pattern
    );

    const { data, error } = await supabase
      .from('chores')
      .insert({
        profile_id: profileId,
        assigned_to_child_id: originalChore.assigned_to_child_id,
        title: originalChore.title,
        description: originalChore.description,
        points_value: originalChore.points_value,
        due_date: nextDate,
        recurrence_pattern: originalChore.recurrence_pattern,
        is_recurring: true,
        next_recurrence_date: this.calculateNextRecurrence(nextDate, originalChore.recurrence_pattern),
        created_by_user_id: userId,
        icon: originalChore.icon,
        color: originalChore.color,
        metadata: originalChore.metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  calculateNextRecurrence(fromDate, pattern) {
    const date = new Date(fromDate);

    switch (pattern) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      default:
        return null;
    }

    return date.toISOString();
  },

  async deleteChore(choreId) {
    const { error } = await supabase
      .from('chores')
      .update({ is_active: false })
      .eq('id', choreId);

    if (error) throw error;
  },

  async getChoreTemplates(profileId = null) {
    let query = supabase
      .from('chore_templates')
      .select('*');

    if (profileId) {
      query = query.or(`profile_id.eq.${profileId},is_public.eq.true`);
    } else {
      query = query.eq('is_public', true);
    }

    query = query.order('times_used', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createChoreFromTemplate(profileId, templateId, childId, userId) {
    const { data: template, error: templateError } = await supabase
      .from('chore_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    await supabase
      .from('chore_templates')
      .update({ times_used: template.times_used + 1 })
      .eq('id', templateId);

    return await this.createChore(profileId, {
      assigned_to_child_id: childId,
      title: template.title,
      description: template.description,
      points_value: template.suggested_points,
      icon: template.icon,
      color: template.color,
      created_by_user_id: userId,
    });
  },
};
