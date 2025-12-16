import { supabase } from './supabaseClient';

export const collaborationAPI = {
  async createHousehold(name, groupType = 'family') {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data: household, error: householdError } = await supabase
      .from('household_groups')
      .insert({
        name,
        group_type: groupType,
        created_by_user_id: userId
      })
      .select()
      .single();

    if (householdError) throw householdError;

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({
        household_id: household.id,
        user_id: userId,
        role: 'admin'
      });

    if (memberError) throw memberError;

    return household;
  },

  async getMyHouseholds() {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('household_members')
      .select(`
        *,
        household:household_groups(*)
      `)
      .eq('user_id', userId);

    if (error) throw error;
    return data?.map(m => ({ ...m.household, memberRole: m.role })) || [];
  },

  async getHouseholdMembers(householdId) {
    const { data, error } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .order('joined_at');

    if (error) throw error;
    return data || [];
  },

  async addHouseholdMember(householdId, userId, role = 'member') {
    const { data, error } = await supabase
      .from('household_members')
      .insert({
        household_id: householdId,
        user_id: userId,
        role
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateMemberRole(memberId, newRole) {
    const { data, error } = await supabase
      .from('household_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeHouseholdMember(memberId) {
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
    return { success: true };
  },

  async sendInvitation(inviteeEmail, invitationType, metadata = {}) {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        inviter_user_id: userId,
        invitee_email: inviteeEmail,
        invitation_type: invitationType,
        relationship_metadata: metadata,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getMyInvitations() {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('inviter_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getInvitationByToken(token) {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async acceptInvitation(token) {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const invitation = await this.getInvitationByToken(token);
    if (!invitation) throw new Error('Invitation not found');
    if (invitation.status !== 'pending') throw new Error('Invitation already processed');
    if (new Date(invitation.expires_at) < new Date()) throw new Error('Invitation expired');

    const { data, error } = await supabase
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId
      })
      .eq('token', token)
      .select()
      .single();

    if (error) throw error;

    if (invitation.invitation_type === 'household_member') {
      await this.addHouseholdMember(
        invitation.relationship_metadata.household_id,
        userId,
        invitation.relationship_metadata.role || 'member'
      );
    } else if (invitation.invitation_type === 'user_connection') {
      await this.createRelationship(
        invitation.inviter_user_id,
        invitation.relationship_metadata.relationship_type || 'friend',
        invitation.relationship_metadata.permissions || {}
      );
    }

    return data;
  },

  async cancelInvitation(invitationId) {
    const { data, error } = await supabase
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createRelationship(relatedUserId, relationshipType, permissions = {}) {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('user_relationships')
      .insert({
        user_id: userId,
        related_user_id: relatedUserId,
        relationship_type: relationshipType,
        permissions,
        created_by: userId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getMyRelationships() {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('user_relationships')
      .select('*')
      .or(`user_id.eq.${userId},related_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async updateRelationship(relationshipId, updates) {
    const { data, error } = await supabase
      .from('user_relationships')
      .update(updates)
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async acceptRelationship(relationshipId) {
    return this.updateRelationship(relationshipId, {
      status: 'accepted',
      accepted_at: new Date().toISOString()
    });
  },

  async declineRelationship(relationshipId) {
    return this.updateRelationship(relationshipId, { status: 'declined' });
  },

  async blockRelationship(relationshipId) {
    return this.updateRelationship(relationshipId, { status: 'blocked' });
  },

  async deleteRelationship(relationshipId) {
    const { error } = await supabase
      .from('user_relationships')
      .delete()
      .eq('id', relationshipId);

    if (error) throw error;
    return { success: true };
  },

  async shareResource(sharedWithUserId, resourceType, resourceId, permissionLevel = 'view') {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('shared_resources')
      .insert({
        owner_user_id: userId,
        shared_with_user_id: sharedWithUserId,
        resource_type: resourceType,
        resource_id: resourceId,
        permission_level: permissionLevel
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getSharedWithMe() {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('shared_resources')
      .select('*')
      .eq('shared_with_user_id', userId);

    if (error) throw error;
    return data || [];
  },

  async getMySharedResources() {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('shared_resources')
      .select('*')
      .eq('owner_user_id', userId);

    if (error) throw error;
    return data || [];
  },

  async updateResourcePermission(sharedResourceId, newPermissionLevel) {
    const { data, error } = await supabase
      .from('shared_resources')
      .update({ permission_level: newPermissionLevel })
      .eq('id', sharedResourceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async unshareResource(sharedResourceId) {
    const { error } = await supabase
      .from('shared_resources')
      .delete()
      .eq('id', sharedResourceId);

    if (error) throw error;
    return { success: true };
  }
};
