import { supabase } from './supabaseClient';

export const profileInvitationsAPI = {
  async getInvitationsByChildProfile(childProfileId) {
    const { data, error } = await supabase
      .from('profile_invitations')
      .select('*')
      .eq('child_profile_id', childProfileId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getActiveInvitation(childProfileId) {
    const { data, error } = await supabase
      .from('profile_invitations')
      .select('*')
      .eq('child_profile_id', childProfileId)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getInvitationByToken(token) {
    const { data, error } = await supabase
      .from('profile_invitations')
      .select(`
        *,
        child_profile:child_profiles(
          id,
          child_name,
          date_of_birth,
          avatar_url,
          current_permission_level
        ),
        invited_by:profiles!profile_invitations_invited_by_profile_id_fkey(
          id,
          profile_name
        )
      `)
      .eq('invitation_token', token)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createInvitation(childProfileId, invitedEmail, invitedByProfileId) {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from('profile_invitations')
      .insert({
        child_profile_id: childProfileId,
        invited_email: invitedEmail,
        invitation_token: token,
        invitation_expires_at: expiresAt.toISOString(),
        invited_by_profile_id: invitedByProfileId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async resendInvitation(invitationId, invitedByProfileId) {
    const newToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from('profile_invitations')
      .update({
        invitation_token: newToken,
        invitation_expires_at: expiresAt.toISOString(),
        status: 'pending',
        invited_by_profile_id: invitedByProfileId
      })
      .eq('id', invitationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async revokeInvitation(invitationId) {
    const { data, error } = await supabase
      .from('profile_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async acceptInvitation(token, userId) {
    const { data, error } = await supabase.rpc('accept_invitation', {
      p_token: token,
      p_user_id: userId
    });

    if (error) throw error;
    return data;
  },

  async expireOldInvitations() {
    const { error } = await supabase.rpc('expire_old_invitations');
    if (error) throw error;
  }
};
