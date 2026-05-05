import { supabase } from './supabaseClient';

export const tasksAPI = {
  // All task definitions for a parent profile, with their assigned children
  async getTasks(profileId) {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_assignments!inner (
          id,
          child_profile_id,
          is_active,
          child_profiles (
            id,
            child_name,
            avatar_url,
            current_permission_level
          )
        )
      `)
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .eq('task_assignments.is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // All task definitions for a parent profile (without requiring an assignment)
  async getAllTasks(profileId) {
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (tasksError) throw tasksError;

    if (!tasks || tasks.length === 0) return [];

    const taskIds = tasks.map(t => t.id);
    const { data: assignments, error: assignError } = await supabase
      .from('task_assignments')
      .select(`
        task_id,
        child_profile_id,
        child_profiles (
          id,
          child_name,
          avatar_url,
          current_permission_level
        )
      `)
      .in('task_id', taskIds)
      .eq('is_active', true);

    if (assignError) throw assignError;

    return tasks.map(task => ({
      ...task,
      assignments: (assignments || []).filter(a => a.task_id === task.id),
    }));
  },

  // Tasks assigned to a specific child (child-facing view)
  async getTasksByChild(childId) {
    const { data, error } = await supabase
      .from('task_assignments')
      .select(`
        task_id,
        tasks (
          id,
          profile_id,
          title,
          description,
          icon,
          color,
          star_reward,
          requires_approval,
          reset_mode,
          repeatable,
          frequency,
          is_active,
          created_at,
          updated_at
        )
      `)
      .eq('child_profile_id', childId)
      .eq('is_active', true)
      .eq('tasks.is_active', true);

    if (error) throw error;

    return (data || [])
      .filter(row => row.tasks)
      .map(row => row.tasks);
  },

  async createTask(profileId, taskData) {
    const { childIds, ...rest } = taskData;

    const insertData = {
      profile_id: profileId,
      title: rest.title,
      description: rest.description || null,
      created_by_user_id: rest.created_by_user_id,
      status: 'in_progress',
      icon: rest.icon,
      color: rest.color,
      metadata: rest.metadata || null,
      reset_mode: rest.reset_mode || 'instant',
      repeatable: rest.repeatable !== undefined ? rest.repeatable : true,
      frequency: rest.frequency || 'always_available',
      star_reward: rest.star_reward !== undefined ? rest.star_reward : 1,
      requires_approval: rest.requires_approval !== undefined ? rest.requires_approval : true,
    };

    if (rest.due_date !== undefined) {
      insertData.due_date = rest.due_date;
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    const assignTo = childIds && childIds.length > 0
      ? childIds
      : rest.assigned_to_child_id
      ? [rest.assigned_to_child_id]
      : [];

    if (assignTo.length > 0) {
      const { error: assignError } = await supabase
        .from('task_assignments')
        .insert(assignTo.map(childId => ({
          task_id: task.id,
          child_profile_id: childId,
          is_active: true,
        })));
      if (assignError) throw assignError;
    }

    return task;
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

  async assignTaskToChild(taskId, childId) {
    const { error } = await supabase
      .from('task_assignments')
      .upsert({
        task_id: taskId,
        child_profile_id: childId,
        is_active: true,
      }, { onConflict: 'task_id,child_profile_id' });

    if (error) throw error;
  },

  async unassignTaskFromChild(taskId, childId) {
    const { error } = await supabase
      .from('task_assignments')
      .update({ is_active: false })
      .eq('task_id', taskId)
      .eq('child_profile_id', childId);

    if (error) throw error;
  },

  async setTaskAssignments(taskId, childIds) {
    const { data: existing } = await supabase
      .from('task_assignments')
      .select('child_profile_id, is_active')
      .eq('task_id', taskId);

    const currentlyActive = new Set(
      (existing || []).filter(a => a.is_active).map(a => a.child_profile_id)
    );
    const desired = new Set(childIds);

    const toActivate = childIds.filter(id => !currentlyActive.has(id));
    const toDeactivate = [...currentlyActive].filter(id => !desired.has(id));

    if (toActivate.length > 0) {
      await supabase
        .from('task_assignments')
        .upsert(
          toActivate.map(childId => ({
            task_id: taskId,
            child_profile_id: childId,
            is_active: true,
          })),
          { onConflict: 'task_id,child_profile_id' }
        );
    }

    if (toDeactivate.length > 0) {
      await supabase
        .from('task_assignments')
        .update({ is_active: false })
        .eq('task_id', taskId)
        .in('child_profile_id', toDeactivate);
    }
  },

  async deleteTask(taskId) {
    const { error } = await supabase
      .from('tasks')
      .update({ is_active: false })
      .eq('id', taskId);

    if (error) throw error;
  },

  // Legacy: kept for backward compat with ChildDashboard / ParentView queries
  async completeTask(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async approveTask(taskId, userId) {
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('star_reward, bonus_multiplier, reset_mode, repeatable, frequency')
      .eq('id', taskId)
      .single();

    if (fetchError) throw fetchError;

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
};
