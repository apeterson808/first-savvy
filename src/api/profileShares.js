import { supabase } from './supabaseClient';

export const profileSharesAPI = {
  async getSharesByChildProfile(childProfileId) {
    const { data, error } = await supabase
      .from('profile_shares')
      .select(`
        *,
        shared_with_profile:profiles!profile_shares_shared_with_profile_id_fkey(
          id,
          profile_name,
          avatar_url,
          user:user_id(email)
        ),
        granted_by_profile:profiles!profile_shares_granted_by_profile_id_fkey(
          id,
          profile_name
        )
      `)
      .eq('child_profile_id', childProfileId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getSharesForProfile(profileId) {
    const { data, error } = await supabase
      .from('profile_shares')
      .select(`
        *,
        child_profile:child_profiles(
          id,
          child_name,
          avatar_url,
          current_permission_level,
          owned_by_profile_id
        )
      `)
      .eq('shared_with_profile_id', profileId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createShare(childProfileId, sharedWithProfileId, permissionLevel, grantedByProfileId) {
    const { data: existingShares } = await supabase
      .from('profile_shares')
      .select('id')
      .eq('child_profile_id', childProfileId)
      .eq('is_active', true);

    if (existingShares && existingShares.length >= 3) {
      throw new Error('Maximum of 4 adults (1 owner + 3 shared) allowed per child profile');
    }

    const { data, error } = await supabase
      .from('profile_shares')
      .insert({
        child_profile_id: childProfileId,
        shared_with_profile_id: sharedWithProfileId,
        permission_level: permissionLevel,
        granted_by_profile_id: grantedByProfileId,
        is_active: true
      })
      .select(`
        *,
        shared_with_profile:profiles!profile_shares_shared_with_profile_id_fkey(
          id,
          profile_name,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async updateSharePermission(shareId, permissionLevel) {
    const { data, error } = await supabase
      .from('profile_shares')
      .update({ permission_level: permissionLevel })
      .eq('id', shareId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async revokeShare(shareId) {
    const { data, error } = await supabase
      .from('profile_shares')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString()
      })
      .eq('id', shareId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getProfilesByEmail(email) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, profile_name, avatar_url, user_id')
      .eq('user_id', (
        await supabase.auth.admin.getUserByEmail(email)
      )?.data?.user?.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async checkUserAccess(childProfileId, userId) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId);

    if (!profiles || profiles.length === 0) {
      return { hasAccess: false, accessType: null, permissionLevel: null };
    }

    const profileIds = profiles.map(p => p.id);

    const { data: childProfile } = await supabase
      .from('child_profiles')
      .select('owned_by_profile_id, user_id')
      .eq('id', childProfileId)
      .single();

    if (childProfile?.user_id === userId) {
      return { hasAccess: true, accessType: 'owner', permissionLevel: 'full' };
    }

    if (profileIds.includes(childProfile?.owned_by_profile_id)) {
      return { hasAccess: true, accessType: 'parent_owner', permissionLevel: 'full' };
    }

    const { data: share } = await supabase
      .from('profile_shares')
      .select('permission_level')
      .eq('child_profile_id', childProfileId)
      .in('shared_with_profile_id', profileIds)
      .eq('is_active', true)
      .maybeSingle();

    if (share) {
      return {
        hasAccess: true,
        accessType: 'shared',
        permissionLevel: share.permission_level
      };
    }

    return { hasAccess: false, accessType: null, permissionLevel: null };
  }
};
