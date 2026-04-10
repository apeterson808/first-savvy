import { supabase } from './supabaseClient';

export const rewardsAPI = {
  async getRewards(profileId, filters = {}) {
    let query = supabase
      .from('rewards')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_active', true);

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.maxPoints) {
      query = query.lte('points_cost', filters.maxPoints);
    }

    if (filters.maxCash) {
      query = query.lte('cash_cost', filters.maxCash);
    }

    query = query.order('points_cost', { ascending: true });

    const { data, error } = await query;
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
        star_cost: rewardData.star_cost || 0,
        points_cost: rewardData.points_cost || 0,
        cash_cost: rewardData.cash_cost || 0,
        category: rewardData.category,
        icon: rewardData.icon,
        color: rewardData.color,
        image_url: rewardData.image_url,
        requires_approval_threshold: rewardData.requires_approval_threshold || 100,
        stock_quantity: rewardData.stock_quantity,
        expires_at: rewardData.expires_at,
        age_restriction: rewardData.age_restriction,
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
      .select('*, permission_levels(*)')
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

    if (reward.points_cost > 0 && child.points_balance < reward.points_cost) {
      throw new Error('Insufficient points balance');
    }

    if (reward.cash_cost > 0 && parseFloat(child.cash_balance) < parseFloat(reward.cash_cost)) {
      throw new Error('Insufficient cash balance');
    }

    const requiresApproval = this.checkApprovalRequired(child, reward);

    const { data: redemption, error: redemptionError } = await supabase
      .from('reward_redemptions')
      .insert({
        child_profile_id: childId,
        reward_id: rewardId,
        points_spent: reward.points_cost,
        cash_spent: reward.cash_cost,
        status: requiresApproval ? 'pending' : 'approved',
      })
      .select()
      .single();

    if (redemptionError) throw redemptionError;

    if (!requiresApproval) {
      await this.processRedemption(childId, rewardId, redemption.id);
    }

    return redemption;
  },

  checkApprovalRequired(child, reward) {
    const level = child.current_permission_level;

    if (level === 1) return true;

    if (level === 2) {
      return reward.points_cost >= 100 || reward.cash_cost > 0;
    }

    if (level === 3) {
      return reward.points_cost >= 500;
    }

    return false;
  },

  async processRedemption(childId, rewardId, redemptionId) {
    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError) throw rewardError;

    const { data: child, error: childError } = await supabase
      .from('child_profiles')
      .select('points_balance, cash_balance')
      .eq('id', childId)
      .single();

    if (childError) throw childError;

    const updates = {};
    if (reward.points_cost > 0) {
      updates.points_balance = child.points_balance - reward.points_cost;
    }
    if (reward.cash_cost > 0) {
      updates.cash_balance = parseFloat(child.cash_balance) - parseFloat(reward.cash_cost);
    }

    const { data: updatedChild, error: updateError } = await supabase
      .from('child_profiles')
      .update(updates)
      .eq('id', childId)
      .select()
      .single();

    if (updateError) throw updateError;

    if (reward.points_cost > 0) {
      await supabase
        .from('child_transactions')
        .insert({
          child_profile_id: childId,
          transaction_type: 'reward_redemption',
          amount: -reward.points_cost,
          currency_type: 'points',
          description: `Redeemed: ${reward.title}`,
          status: 'completed',
          related_reward_id: rewardId,
          balance_after: updatedChild.points_balance,
        });
    }

    if (reward.cash_cost > 0) {
      await supabase
        .from('child_transactions')
        .insert({
          child_profile_id: childId,
          transaction_type: 'reward_redemption',
          amount: -reward.cash_cost,
          currency_type: 'cash',
          description: `Redeemed: ${reward.title}`,
          status: 'completed',
          related_reward_id: rewardId,
          balance_after: updatedChild.cash_balance,
        });
    }

    if (reward.stock_quantity !== null) {
      await supabase
        .from('rewards')
        .update({
          stock_quantity: reward.stock_quantity - 1,
          times_redeemed: reward.times_redeemed + 1,
        })
        .eq('id', rewardId);
    }

    return updatedChild;
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
          color,
          category
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
    const { data: redemption, error: fetchError } = await supabase
      .from('reward_redemptions')
      .select('*')
      .eq('id', redemptionId)
      .single();

    if (fetchError) throw fetchError;

    await this.processRedemption(
      redemption.child_profile_id,
      redemption.reward_id,
      redemptionId
    );

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
