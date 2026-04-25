import { supabase } from './supabaseClient';

export const tasksAPI = {
  async getTasks(profileId, filters = {}) {
    let query = supabase
      .from('tasks')
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

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getTasksByChild(childId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to_child_id', childId)
      .eq('is_active', true)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data;
  },

  async createTask(profileId, taskData) {
    const insertData = {
      profile_id: profileId,
      assigned_to_child_id: taskData.assigned_to_child_id,
      title: taskData.title,
      description: taskData.description,
      created_by_user_id: taskData.created_by_user_id,
      status: 'in_progress',
      icon: taskData.icon,
      color: taskData.color,
      metadata: taskData.metadata,
      source: taskData.source || 'web',
      created_by_profile_id: taskData.created_by_profile_id || null,
      reset_mode: taskData.reset_mode || 'instant',
      repeatable: taskData.repeatable !== undefined ? taskData.repeatable : true,
      frequency: taskData.frequency || 'always_available',
    };

    if (taskData.star_reward !== undefined) {
      insertData.star_reward = taskData.star_reward;
    }

    if (taskData.requires_approval !== undefined) {
      insertData.requires_approval = taskData.requires_approval;
    }

    if (taskData.points_value !== undefined) {
      insertData.points_value = taskData.points_value;
    } else {
      insertData.points_value = 0;
    }

    if (taskData.due_date !== undefined) {
      insertData.due_date = taskData.due_date;
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTask(taskId, updates) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async completeTask(taskId, userId) {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)
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

  async markTaskComplete(taskId, userId) {
    return this.completeTask(taskId, userId);
  },

  async approveTask(taskId, userId, profileId) {
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*, child_profiles(*)')
      .eq('id', taskId)
      .single();

    if (fetchError) throw fetchError;

    const pointsToAward = Math.round(task.points_value * (task.bonus_multiplier || 1.0));

    const { data: updatedChild, error: balanceError } = await supabase
      .from('child_profiles')
      .update({
        points_balance: task.child_profiles.points_balance + pointsToAward,
      })
      .eq('id', task.assigned_to_child_id)
      .select()
      .single();

    if (balanceError) throw balanceError;

    const { error: txError } = await supabase
      .from('child_transactions')
      .insert({
        child_profile_id: task.assigned_to_child_id,
        transaction_type: 'chore_payment',
        amount: pointsToAward,
        currency_type: 'points',
        description: `Completed: ${task.title}`,
        status: 'completed',
        approved_by_user_id: userId,
        approved_at: new Date().toISOString(),
        related_chore_id: taskId,
        balance_after: updatedChild.points_balance,
      });

    if (txError) throw txError;

    const shouldReset = task.reset_mode === 'instant' || task.repeatable === true || task.frequency === 'always_available';
    const newStatus = shouldReset ? 'in_progress' : 'approved';

    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        approved_by_user_id: userId,
        approved_at: new Date().toISOString(),
        completed_at: null,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  async rejectTask(taskId, userId, reason) {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'rejected',
        approved_by_user_id: userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTask(taskId) {
    const { error } = await supabase
      .from('tasks')
      .update({ is_active: false })
      .eq('id', taskId);

    if (error) throw error;
  },

  async getTaskTemplates(profileId = null) {
    let query = supabase
      .from('task_templates')
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

  async createTaskFromTemplate(profileId, templateId, childId, userId) {
    const { data: template, error: templateError } = await supabase
      .from('task_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    await supabase
      .from('task_templates')
      .update({ times_used: template.times_used + 1 })
      .eq('id', templateId);

    return await this.createTask(profileId, {
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
