import { supabase } from './supabaseClient';

export const rewardsAPI = {
  async getRewards(profileId, filters = {}) {
    let query = supabase
      .from('rewards')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_active', true);

    query = query.order('star_cost', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getRewardsByChild(childId) {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('assigned_to_child_id', childId)
      .eq('is_active', true)
      .order('star_cost', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getRewardById(rewardId) {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (error) throw error;
    return data;
  },

  async createReward(profileId, rewardData) {
    const { data, error } = await supabase
      .from('rewards')
      .insert({
        profile_id: profileId,
        title: rewardData.title,
        description: rewardData.description,
        star_cost: rewardData.star_cost || 1,
        icon: rewardData.icon,
        color: rewardData.color,
        image_url: rewardData.image_url,
        stock_quantity: rewardData.stock_quantity,
        expires_at: rewardData.expires_at,
        created_by_user_id: rewardData.created_by_user_id,
        assigned_to_child_id: rewardData.assigned_to_child_id,
        status: rewardData.status || 'available',
        metadata: rewardData.metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateReward(rewardId, updates) {
    const { data, error } = await supabase
      .from('rewards')
      .update(updates)
      .eq('id', rewardId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteReward(rewardId) {
    const { error } = await supabase
      .from('rewards')
      .update({ is_active: false })
      .eq('id', rewardId);

    if (error) throw error;
  },

  async redeemReward(childId, rewardId) {
    const { data: child, error: childError } = await supabase
      .from('child_profiles')
      .select('stars_balance')
      .eq('id', childId)
      .single();

    if (childError) throw childError;

    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError) throw rewardError;

    if (reward.stock_quantity !== null && reward.stock_quantity <= 0) {
      throw new Error('This reward is out of stock');
    }

    if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
      throw new Error('This reward has expired');
    }

    if ((child.stars_balance || 0) < reward.star_cost) {
      throw new Error('Not enough stars');
    }

    const newBalance = (child.stars_balance || 0) - reward.star_cost;

    const { error: balanceError } = await supabase
      .from('child_profiles')
      .update({ stars_balance: newBalance })
      .eq('id', childId);

    if (balanceError) throw balanceError;

    const { error: redemptionError } = await supabase
      .from('reward_redemptions')
      .insert({
        child_profile_id: childId,
        reward_id: rewardId,
        status: 'fulfilled',
        requested_at: new Date().toISOString(),
        fulfilled_at: new Date().toISOString(),
      });

    if (redemptionError) throw redemptionError;

    await supabase
      .from('rewards')
      .update({
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        redeemed_by_child_id: childId,
        times_redeemed: (reward.times_redeemed || 0) + 1,
      })
      .eq('id', rewardId);

    return {
      reward_title: reward.title,
      stars_spent: reward.star_cost,
      new_balance: newBalance,
    };
  },

  async getRedemptions(childId, filters = {}) {
    let query = supabase
      .from('reward_redemptions')
      .select(`
        *,
        rewards (
          title,
          description,
          icon,
          color
        )
      `)
      .eq('child_profile_id', childId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('requested_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async approveRedemption(redemptionId, userId) {
    const { data, error } = await supabase
      .from('reward_redemptions')
      .update({
        status: 'approved',
        approved_by_user_id: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', redemptionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async rejectRedemption(redemptionId, userId, reason) {
    const { data, error } = await supabase
      .from('reward_redemptions')
      .update({
        status: 'rejected',
        approved_by_user_id: userId,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', redemptionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async fulfillRedemption(redemptionId, userId, notes) {
    const { data, error } = await supabase
      .from('reward_redemptions')
      .update({
        status: 'fulfilled',
        fulfilled_by_user_id: userId,
        fulfilled_at: new Date().toISOString(),
        notes: notes,
      })
      .eq('id', redemptionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getPendingRedemptions(profileId) {
    const { data, error } = await supabase
      .from('reward_redemptions')
      .select(`
        *,
        child_profiles (
          id,
          child_name,
          avatar_url,
          parent_profile_id
        ),
        rewards (
          title,
          description,
          icon,
          color
        )
      `)
      .eq('child_profiles.parent_profile_id', profileId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (error) throw error;
    return data;
  },
};
