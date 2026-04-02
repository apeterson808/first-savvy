import { supabase } from './supabaseClient';

export const parentAccessGrantsAPI = {
  async getParentAccessGrants(childId) {
    const { data, error } = await supabase
      .from('parent_access_grants')
      .select(`
        *,
        profiles (
          id,
          display_name
        )
      `)
      .eq('child_profile_id', childId)
      .eq('is_active', true)
      .order('granted_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async grantParentAccess(childId, parentProfileId, permissions) {
    const { data: existingGrant, error: checkError } = await supabase
      .from('parent_access_grants')
      .select('*')
      .eq('child_profile_id', childId)
      .eq('parent_profile_id', parentProfileId)
      .eq('is_active', true)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingGrant) {
      const { data, error } = await supabase
        .from('parent_access_grants')
        .update({
          can_view_transactions: permissions.can_view_transactions || false,
          can_view_balances: permissions.can_view_balances || false,
          can_view_budgets: permissions.can_view_budgets || false,
          can_view_goals: permissions.can_view_goals || false,
          can_comment: permissions.can_comment || false,
          can_suggest: permissions.can_suggest || false,
          full_collaboration: permissions.full_collaboration || false,
          notes: permissions.notes,
        })
        .eq('id', existingGrant.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('parent_access_grants')
      .insert({
        child_profile_id: childId,
        parent_profile_id: parentProfileId,
        can_view_transactions: permissions.can_view_transactions || false,
        can_view_balances: permissions.can_view_balances || false,
        can_view_budgets: permissions.can_view_budgets || false,
        can_view_goals: permissions.can_view_goals || false,
        can_comment: permissions.can_comment || false,
        can_suggest: permissions.can_suggest || false,
        full_collaboration: permissions.full_collaboration || false,
        notes: permissions.notes,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async revokeParentAccess(grantId) {
    const { data, error } = await supabase
      .from('parent_access_grants')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', grantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateParentAccess(grantId, permissions) {
    const { data, error } = await supabase
      .from('parent_access_grants')
      .update(permissions)
      .eq('id', grantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getAccessPresets() {
    return {
      fullAccess: {
        name: 'Full Access',
        description: 'Parent can see everything like before',
        can_view_transactions: true,
        can_view_balances: true,
        can_view_budgets: true,
        can_view_goals: true,
        can_comment: true,
        can_suggest: true,
        full_collaboration: true,
      },
      viewOnly: {
        name: 'View Only',
        description: 'Parent can see everything but cannot interact',
        can_view_transactions: true,
        can_view_balances: true,
        can_view_budgets: true,
        can_view_goals: true,
        can_comment: false,
        can_suggest: false,
        full_collaboration: false,
      },
      limited: {
        name: 'Limited',
        description: 'Custom selection of what parent can see',
        can_view_transactions: false,
        can_view_balances: true,
        can_view_budgets: false,
        can_view_goals: true,
        can_comment: true,
        can_suggest: true,
        full_collaboration: false,
      },
      noAccess: {
        name: 'No Access',
        description: 'Complete privacy from parent',
        can_view_transactions: false,
        can_view_balances: false,
        can_view_budgets: false,
        can_view_goals: false,
        can_comment: false,
        can_suggest: false,
        full_collaboration: false,
      },
    };
  },

  async checkParentHasAccess(childId, parentProfileId, permissionType) {
    const { data, error } = await supabase
      .from('parent_access_grants')
      .select('*')
      .eq('child_profile_id', childId)
      .eq('parent_profile_id', parentProfileId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return false;

    if (data.full_collaboration) return true;

    return data[permissionType] === true;
  },
};
