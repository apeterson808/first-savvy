import { supabase } from './supabaseClient';

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const createUserProfile = async (userId, profileData) => {
  const { data, error } = await supabase
    .from('user_settings')
    .insert({
      id: userId,
      ...profileData
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('user_settings')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const upsertUserProfile = async (userId, profileData) => {
  const { data, error} = await supabase
    .from('user_settings')
    .upsert({
      id: userId,
      ...profileData
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const uploadAvatar = async (userId, file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Math.random()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return publicUrl;
};

export const deleteAvatar = async (avatarUrl) => {
  if (!avatarUrl) return;

  const path = avatarUrl.split('/avatars/')[1];
  if (!path) return;

  const { error } = await supabase.storage
    .from('avatars')
    .remove([`avatars/${path}`]);

  if (error) throw error;
};

export const updatePassword = async (newPassword) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
  return data;
};

export const updateEmail = async (newEmail) => {
  const { data, error } = await supabase.auth.updateUser({
    email: newEmail
  });

  if (error) throw error;
  return data;
};
