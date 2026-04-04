import { supabase } from './supabaseClient';

export const taskCompletionsAPI = {
  async getCompletions(childProfileId, filters = {}) {
    let query = supabase
      .from('task_completions')
      .select(`
        *,
        tasks (
          id,
          title,
          description,
          icon,
          color,
          star_reward
        )
      `)
      .eq('child_profile_id', childProfileId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('submitted_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async submitCompletion(taskId, childProfileId, submissionNotes = null) {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('star_reward')
      .eq('id', taskId)
      .single();

    if (taskError) throw taskError;

    const { data, error } = await supabase
      .from('task_completions')
      .insert({
        task_id: taskId,
        child_profile_id: childProfileId,
        stars_earned: task.star_reward,
        submission_notes: submissionNotes,
        status: 'pending',
      })
      .select(`
        *,
        tasks (
          id,
          title,
          description,
          icon,
          color,
          star_reward
        )
      `)
      .single();

    if (error) throw error;

    await supabase
      .from('child_profiles')
      .update({
        stars_pending: supabase.raw(`stars_pending + ${task.star_reward}`),
      })
      .eq('id', childProfileId);

    await supabase
      .from('tasks')
      .update({
        status: 'pending_approval',
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    return data;
  },

  async approveCompletion(completionId, reviewNotes = null) {
    const { data, error } = await supabase.rpc('approve_task_completion', {
      p_completion_id: completionId,
      p_review_notes: reviewNotes,
    });

    if (error) throw error;

    const { data: completion } = await supabase
      .from('task_completions')
      .select('task_id')
      .eq('id', completionId)
      .single();

    if (completion?.task_id) {
      await supabase
        .from('tasks')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', completion.task_id);
    }

    return data;
  },

  async rejectCompletion(completionId, reviewNotes = null) {
    const { data, error } = await supabase.rpc('reject_task_completion', {
      p_completion_id: completionId,
      p_review_notes: reviewNotes,
    });

    if (error) throw error;

    const { data: completion } = await supabase
      .from('task_completions')
      .select('task_id')
      .eq('id', completionId)
      .single();

    if (completion?.task_id) {
      await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          completed_at: null,
        })
        .eq('id', completion.task_id);
    }

    return data;
  },

  async getChildStarBalance(childProfileId) {
    const { data, error } = await supabase
      .from('child_profiles')
      .select('stars_balance, stars_pending')
      .eq('id', childProfileId)
      .single();

    if (error) throw error;
    return data;
  },

  async redeemReward(rewardId, childProfileId) {
    const { data, error } = await supabase.rpc('redeem_reward', {
      p_reward_id: rewardId,
      p_child_profile_id: childProfileId,
    });

    if (error) throw error;
    return data;
  },

  async getPendingCompletionsCount(childProfileId) {
    const { count, error } = await supabase
      .from('task_completions')
      .select('*', { count: 'exact', head: true })
      .eq('child_profile_id', childProfileId)
      .eq('status', 'pending');

    if (error) throw error;
    return count || 0;
  },
};
