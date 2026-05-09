import { supabase } from './supabaseClient';

/**
 * Log a household action to the audit trail.
 * Both the acting user and the profile context are recorded so the UI can
 * later show "Jenna categorized this" next to any financial record.
 *
 * @param {object} params
 * @param {string} params.profileId  - Household profile this action belongs to
 * @param {string} params.userId     - auth.uid() of the person taking the action
 * @param {string} params.actorName  - Display name (cached to avoid extra lookups)
 * @param {string} params.action     - Action code: 'categorize_transaction', 'create_budget', etc.
 * @param {string} params.entityType - 'transaction' | 'budget' | 'journal_entry' | 'task_completion' | 'reward_redemption'
 * @param {string} [params.entityId] - UUID of the affected record
 * @param {string} [params.description] - Human-readable summary
 * @param {object} [params.metadata] - Optional additional context (before/after values, etc.)
 */
export async function logHouseholdAction({
  profileId,
  userId,
  actorName,
  action,
  entityType,
  entityId = null,
  description = '',
  metadata = null,
}) {
  if (!profileId || !userId) return;

  try {
    await supabase.rpc('log_household_action', {
      p_profile_id: profileId,
      p_user_id: userId,
      p_actor_display_name: actorName,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_description: description,
      p_metadata: metadata,
    });
  } catch {
    // Audit log failures are non-fatal — never block the primary operation
  }
}

/**
 * Fetch paginated household activity feed.
 * Returns all actions by all household members, attributed to each actor.
 */
export async function getHouseholdActivityFeed({
  profileId,
  limit = 50,
  offset = 0,
  entityType = null,
}) {
  const { data, error } = await supabase.rpc('get_household_activity_feed', {
    p_profile_id: profileId,
    p_limit: limit,
    p_offset: offset,
    p_entity_type: entityType,
  });

  if (error) throw error;

  if (!data || data.length === 0) {
    return { items: [], totalCount: 0, hasMore: false };
  }

  return {
    items: data,
    totalCount: data[0]?.total_count || 0,
    hasMore: offset + data.length < (data[0]?.total_count || 0),
  };
}

export const AUDIT_ACTIONS = {
  CATEGORIZE_TRANSACTION: 'categorize_transaction',
  POST_TRANSACTION: 'post_transaction',
  UNDO_TRANSACTION: 'undo_transaction',
  IMPORT_TRANSACTIONS: 'import_transactions',
  CREATE_BUDGET: 'create_budget',
  UPDATE_BUDGET: 'update_budget',
  DELETE_BUDGET: 'delete_budget',
  CREATE_JOURNAL_ENTRY: 'create_journal_entry',
  EDIT_JOURNAL_ENTRY: 'edit_journal_entry',
  DELETE_JOURNAL_ENTRY: 'delete_journal_entry',
  APPROVE_TASK: 'approve_task',
  REJECT_TASK: 'reject_task',
  APPROVE_REWARD: 'approve_reward',
  REJECT_REWARD: 'reject_reward',
  FULFILL_REWARD: 'fulfill_reward',
  AWARD_STARS: 'award_stars',
};
