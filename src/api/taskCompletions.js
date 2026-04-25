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
        note: submissionNotes,
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

    const { data: childData } = await supabase
      .from('child_profiles')
      .select('stars_pending')
      .eq('id', childProfileId)
      .single();

    await supabase
      .from('child_profiles')
      .update({
        stars_pending: (childData?.stars_pending || 0) + task.star_reward,
      })
      .eq('id', childProfileId);

    return data;
  },

  async approveCompletion(completionId, reviewNotes = null) {
    const { data, error } = await supabase.rpc('approve_task_completion', {
      p_completion_id: completionId,
      p_review_notes: reviewNotes,
    });

    if (error) throw error;
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

  async awardStarsDirectly(childProfileId, stars, note = null, taskId = null) {
    const { data: childData, error: fetchError } = await supabase
      .from('child_profiles')
      .select('stars_balance')
      .eq('id', childProfileId)
      .single();

    if (fetchError) throw fetchError;

    const newBalance = (childData.stars_balance || 0) + stars;

    const { error: updateError } = await supabase
      .from('child_profiles')
      .update({ stars_balance: newBalance })
      .eq('id', childProfileId);

    if (updateError) throw updateError;

    if (taskId) {
      const { data: task } = await supabase
        .from('tasks')
        .select('reset_mode, repeatable, frequency')
        .eq('id', taskId)
        .maybeSingle();

      const shouldReset = task?.reset_mode === 'instant' || task?.repeatable === true || task?.frequency === 'always_available';

      await supabase
        .from('tasks')
        .update({
          status: shouldReset ? 'in_progress' : 'approved',
          approved_at: new Date().toISOString(),
          completed_at: null,
        })
        .eq('id', taskId);
    }

    return { stars_balance: newBalance, stars_awarded: stars };
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
