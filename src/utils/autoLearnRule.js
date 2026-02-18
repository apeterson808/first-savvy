import { supabase } from '@/api/supabaseClient';
import { transactionRulesApi } from '@/api/transactionRules';

function buildPatternFromDescription(description) {
  if (!description) return null;
  const cleaned = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by']);
  const tokens = cleaned.split(' ').filter(t => t.length > 2 && !stopWords.has(t));
  if (tokens.length === 0) return description.trim();
  return tokens.slice(0, 3).join(' ');
}

export async function autoLearnRule(profileId, transaction, { categoryId, contactId }) {
  if (!profileId || !transaction) return;
  if (!categoryId && !contactId) return;

  const descKey = transaction.original_description || transaction.description;
  if (!descKey) return;

  const pattern = buildPatternFromDescription(descKey);
  if (!pattern) return;

  try {
    const { data: existingRules } = await supabase
      .from('transaction_rules')
      .select('id, action_set_category_id, action_set_contact_id')
      .eq('profile_id', profileId)
      .eq('match_description_pattern', pattern)
      .eq('match_description_mode', 'contains')
      .eq('is_enabled', true);

    if (existingRules && existingRules.length > 0) {
      const rule = existingRules[0];
      const updates = {};
      if (categoryId && rule.action_set_category_id !== categoryId) {
        updates.action_set_category_id = categoryId;
      }
      if (contactId && rule.action_set_contact_id !== contactId) {
        updates.action_set_contact_id = contactId;
      }
      if (Object.keys(updates).length > 0) {
        await transactionRulesApi.updateRule(rule.id, updates);
      }
    } else {
      const ruleData = {
        name: `Auto: ${(transaction.description || descKey).substring(0, 40)}`,
        match_description_pattern: pattern,
        match_description_mode: 'contains',
        match_case_sensitive: false,
        created_from_transaction_id: transaction.id,
        is_enabled: true
      };
      if (categoryId) ruleData.action_set_category_id = categoryId;
      if (contactId) ruleData.action_set_contact_id = contactId;
      await transactionRulesApi.createRule(profileId, ruleData);
    }
  } catch {
  }
}
