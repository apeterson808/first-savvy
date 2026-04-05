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

    if (filters.recurring !== undefined) {
      query = query.eq('is_recurring', filters.recurring);
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
    };

    if (taskData.star_reward !== undefined) {
      insertData.star_reward = taskData.star_reward;
    }

    if (taskData.frequency !== undefined) {
      insertData.frequency = taskData.frequency;
    }

    if (taskData.repeatable !== undefined) {
      insertData.repeatable = taskData.repeatable;
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

    if (taskData.recurrence_pattern !== undefined) {
      insertData.recurrence_pattern = taskData.recurrence_pattern;
    } else if (!taskData.frequency) {
      insertData.recurrence_pattern = 'once';
    }

    if (taskData.is_recurring !== undefined) {
      insertData.is_recurring = taskData.is_recurring;
    } else {
      insertData.is_recurring = false;
    }

    if (taskData.next_recurrence_date !== undefined) {
      insertData.next_recurrence_date = taskData.next_recurrence_date;
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

    const isRepeatable = task.repeatable || task.frequency === 'always_available';
    const newStatus = isRepeatable ? 'in_progress' : 'approved';

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

    if (task.is_recurring && task.next_recurrence_date) {
      await this.createRecurringTaskInstance(task, profileId, userId);
    }

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

  async createRecurringTaskInstance(originalTask, profileId, userId) {
    const nextDate = this.calculateNextRecurrence(
      originalTask.next_recurrence_date,
      originalTask.recurrence_pattern
    );

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        profile_id: profileId,
        assigned_to_child_id: originalTask.assigned_to_child_id,
        title: originalTask.title,
        description: originalTask.description,
        points_value: originalTask.points_value,
        status: 'in_progress',
        due_date: nextDate,
        recurrence_pattern: originalTask.recurrence_pattern,
        is_recurring: true,
        next_recurrence_date: this.calculateNextRecurrence(nextDate, originalTask.recurrence_pattern),
        created_by_user_id: userId,
        icon: originalTask.icon,
        color: originalTask.color,
        metadata: originalTask.metadata,
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
