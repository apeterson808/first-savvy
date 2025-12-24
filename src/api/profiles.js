import { supabase } from './supabaseClient';

export const getUserProfiles = async (userId) => {
  const { data, error } = await supabase
    .from('profile_memberships')
    .select(`
      role,
      profile:profiles (
        id,
        profile_type,
        display_name,
        is_deleted,
        created_at
      )
    `)
    .eq('user_id', userId);

  if (error) throw error;

  return data
    .filter(m => m.profile && !m.profile.is_deleted)
    .map(m => ({
      ...m.profile,
      role: m.role
    }));
};

export const getProfileById = async (profileId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const ensureDefaultProfile = async () => {
  const { data, error } = await supabase.rpc('ensure_default_profile');

  if (error) throw error;
  return data;
};

export const createProfile = async (profileType, displayName) => {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      profile_type: profileType,
      display_name: displayName
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateProfile = async (profileId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const softDeleteProfile = async (profileId) => {
  const { error } = await supabase
    .from('profiles')
    .update({ is_deleted: true })
    .eq('id', profileId);

  if (error) throw error;
};

export const getProfileMemberships = async (profileId) => {
  const { data, error } = await supabase
    .from('profile_memberships')
    .select('*')
    .eq('profile_id', profileId);

  if (error) throw error;
  return data;
};

export const addProfileMember = async (profileId, userId, role = 'member') => {
  const { data, error } = await supabase
    .from('profile_memberships')
    .insert({
      profile_id: profileId,
      user_id: userId,
      role
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateProfileMemberRole = async (membershipId, newRole) => {
  const { error } = await supabase
    .from('profile_memberships')
    .update({ role: newRole })
    .eq('id', membershipId);

  if (error) throw error;
};

export const removeProfileMember = async (membershipId) => {
  const { error } = await supabase
    .from('profile_memberships')
    .delete()
    .eq('id', membershipId);

  if (error) throw error;
};
