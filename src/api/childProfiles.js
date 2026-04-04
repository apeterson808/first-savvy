import { supabase } from './supabaseClient';

export const childProfilesAPI = {
  async getChildProfiles(profileId) {
    const { data, error } = await supabase
      .from('child_profiles')
      .select('*')
      .or(`parent_profile_id.eq.${profileId},owned_by_profile_id.eq.${profileId}`)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getOwnedChildProfiles(profileId) {
    const { data, error } = await supabase
      .from('child_profiles')
      .select('*')
      .eq('owned_by_profile_id', profileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getSharedChildProfiles(profileId) {
    const { data, error } = await supabase
      .from('profile_shares')
      .select(`
        *,
        child_profile:child_profiles(*)
      `)
      .eq('shared_with_profile_id', profileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data?.map(share => ({
      ...share.child_profile,
      share_permission_level: share.permission_level,
      shared_access: true
    })) || [];
  },

  async getChildProfileById(childId) {
    const { data, error } = await supabase
      .from('child_profiles')
      .select('*')
      .eq('id', childId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createChildProfile(profileId, childData) {
    let avatarUrl = null;

    if (childData.avatar) {
      if (childData.avatar.type === 'upload' && childData.avatar.file) {
        const fileExt = childData.avatar.file.name.split('.').pop();
        const fileName = `${profileId}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('child-avatars')
          .upload(fileName, childData.avatar.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('child-avatars')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      } else if (childData.avatar.type === 'preset') {
        avatarUrl = `preset:${childData.avatar.value}`;
      }
    }

    const { data, error } = await supabase
      .from('child_profiles')
      .insert({
        parent_profile_id: profileId,
        owned_by_profile_id: profileId,
        first_name: childData.first_name,
        last_name: childData.last_name,
        child_name: childData.child_name,
        date_of_birth: childData.date_of_birth,
        sex: childData.sex,
        avatar_url: avatarUrl,
        current_permission_level: 1,
        points_balance: 0,
        cash_balance: 0,
        daily_spending_limit: childData.daily_spending_limit,
        weekly_spending_limit: childData.weekly_spending_limit,
        monthly_spending_limit: childData.monthly_spending_limit,
        notes: childData.notes,
        username: childData.username,
        email: childData.email || null,
        login_enabled: childData.login_enabled || false,
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
      .delete()
      .eq('id', childId);

    if (error) throw error;
  },

  async checkUsernameAvailability(username) {
    if (!username || username.length < 3) {
      return { available: false, message: 'Username must be at least 3 characters' };
    }

    const { data, error } = await supabase
      .from('child_profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (error) throw error;

    return {
      available: !data,
      message: data ? 'Username is already taken' : 'Username is available'
    };
  },

  async authenticateChild(usernameOrEmail, pin) {
    if (!usernameOrEmail || !pin) {
      throw new Error('Username/Email and PIN are required');
    }

    const { data: child, error: fetchError } = await supabase
      .from('child_profiles')
      .select('*')
      .or(`username.ilike.${usernameOrEmail},email.ilike.${usernameOrEmail}`)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!child) {
      await this.logLoginAttempt(null, false, 'Username/Email not found');
      throw new Error('Invalid credentials');
    }

    if (!child.login_enabled) {
      await this.logLoginAttempt(child.id, false, 'Login not enabled');
      throw new Error('Login is not enabled for this account');
    }

    if (child.account_locked) {
      await this.logLoginAttempt(child.id, false, 'Account locked');
      throw new Error('Account is locked. Please contact your parent.');
    }

    if (!child.pin_hash) {
      await this.logLoginAttempt(child.id, false, 'No PIN set');
      throw new Error('No PIN has been set for this account');
    }

    const pinMatches = await this.verifyPin(pin, child.pin_hash);

    if (!pinMatches) {
      const newFailedAttempts = child.failed_login_attempts + 1;
      const shouldLock = newFailedAttempts >= 5;

      await supabase
        .from('child_profiles')
        .update({
          failed_login_attempts: newFailedAttempts,
          account_locked: shouldLock
        })
        .eq('id', child.id);

      await this.logLoginAttempt(child.id, false, `Invalid PIN (attempt ${newFailedAttempts})`);

      if (shouldLock) {
        throw new Error('Account has been locked due to too many failed attempts. Please contact your parent.');
      }

      throw new Error('Invalid credentials');
    }

    await supabase
      .from('child_profiles')
      .update({
        failed_login_attempts: 0,
        last_login_at: new Date().toISOString()
      })
      .eq('id', child.id);

    await this.logLoginAttempt(child.id, true, null);

    return child;
  },

  async verifyPin(pin, pinHash) {
    try {
      const response = await supabase.functions.invoke('verify-child-pin', {
        body: { pin, pinHash }
      });

      if (response.error) throw response.error;
      return response.data.matches;
    } catch (error) {
      console.error('PIN verification error:', error);
      return false;
    }
  },

  async hashPin(pin) {
    try {
      const response = await supabase.functions.invoke('hash-child-pin', {
        body: { pin }
      });

      if (response.error) throw response.error;
      return response.data.hash;
    } catch (error) {
      console.error('PIN hashing error:', error);
      throw new Error('Failed to hash PIN');
    }
  },

  async setChildPin(childId, pin) {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new Error('PIN must be exactly 4 digits');
    }

    const pinHash = await this.hashPin(pin);

    const { data, error } = await supabase
      .from('child_profiles')
      .update({
        pin_hash: pinHash,
        pin_last_changed: new Date().toISOString()
      })
      .eq('id', childId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async unlockChildAccount(childId) {
    const { data, error } = await supabase
      .from('child_profiles')
      .update({
        account_locked: false,
        failed_login_attempts: 0
      })
      .eq('id', childId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async logLoginAttempt(childId, success, failureReason = null) {
    try {
      await supabase
        .from('child_login_audit_log')
        .insert({
          child_profile_id: childId,
          success,
          failure_reason: failureReason,
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }
  },

  async getLoginHistory(childId, limit = 20) {
    const { data, error } = await supabase
      .from('child_login_audit_log')
      .select('*')
      .eq('child_profile_id', childId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async resetFailedAttempts(childId) {
    const { data, error } = await supabase
      .from('child_profiles')
      .update({ failed_login_attempts: 0 })
      .eq('id', childId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
