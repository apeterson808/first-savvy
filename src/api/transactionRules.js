import { supabase } from './supabaseClient';

export const transactionRulesApi = {
  async listRules(profileId, options = {}) {
    const { enabled, sortBy = 'name' } = options;

    let query = supabase
      .from('transaction_rules')
      .select('*')
      .eq('profile_id', profileId);

    if (enabled !== undefined) {
      query = query.eq('is_enabled', enabled);
    }

    const [sortField, sortDirection] = sortBy.startsWith('-')
      ? [sortBy.slice(1), false]
      : [sortBy, true];

    query = query.order(sortField, { ascending: sortDirection });

    const [{ data, error }, { data: matchCounts }] = await Promise.all([
      query,
      supabase
        .from('transactions')
        .select('applied_rule_id')
        .eq('profile_id', profileId)
        .not('applied_rule_id', 'is', null)
    ]);

    if (error) throw error;

    const countMap = {};
    for (const tx of (matchCounts || [])) {
      countMap[tx.applied_rule_id] = (countMap[tx.applied_rule_id] || 0) + 1;
    }

    const allRules = (data || []).map(r => ({
      ...r,
      times_matched: countMap[r.id] || 0
    }));

    const zeroMatchSuggested = allRules.filter(r => r.created_from_transaction_id && (countMap[r.id] || 0) === 0);
    if (zeroMatchSuggested.length > 0) {
      await supabase
        .from('transaction_rules')
        .delete()
        .in('id', zeroMatchSuggested.map(r => r.id));
      return allRules.filter(r => !zeroMatchSuggested.find(z => z.id === r.id));
    }

    return allRules;
  },

  async getRule(ruleId) {
    const { data, error } = await supabase
      .from('transaction_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (error) throw error;
    return data;
  },

  async createRule(profileId, ruleData) {
    const validColumns = [
      'name',
      'match_description_pattern',
      'match_description_mode',
      'match_original_description_pattern',
      'match_case_sensitive',
      'match_money_direction',
      'match_bank_account_ids',
      'match_bank_account_id',
      'match_amount_exact',
      'match_amount_min',
      'match_amount_max',
      'match_transaction_type',
      'match_contact_id',
      'match_date_from',
      'match_date_to',
      'match_conditions_logic',
      'action_set_category_id',
      'action_set_contact_id',
      'action_set_description',
      'action_add_note',
      'action_add_tags',
      'auto_confirm_and_post',
      'is_enabled',
      'created_from_transaction_id'
    ];

    const cleanedData = {};
    for (const key of Object.keys(ruleData)) {
      if (validColumns.includes(key)) {
        cleanedData[key] = ruleData[key];
      }
    }

    const insertData = {
      profile_id: profileId,
      ...cleanedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('transaction_rules')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data;
  },

  async updateRule(ruleId, updates) {
    const validColumns = [
      'name',
      'match_description_pattern',
      'match_description_mode',
      'match_original_description_pattern',
      'match_case_sensitive',
      'match_money_direction',
      'match_bank_account_ids',
      'match_bank_account_id',
      'match_amount_exact',
      'match_amount_min',
      'match_amount_max',
      'match_transaction_type',
      'match_contact_id',
      'match_date_from',
      'match_date_to',
      'match_conditions_logic',
      'action_set_category_id',
      'action_set_contact_id',
      'action_set_description',
      'action_add_note',
      'action_add_tags',
      'auto_confirm_and_post',
      'is_enabled',
      'times_matched',
      'times_accepted',
      'times_rejected',
      'last_matched_at'
    ];

    const cleanedUpdates = {};
    for (const key of validColumns) {
      if (updates[key] !== undefined) {
        cleanedUpdates[key] = updates[key];
      }
    }

    const { data, error } = await supabase
      .from('transaction_rules')
      .update({
        ...cleanedUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteRule(ruleId) {
    const { error } = await supabase
      .from('transaction_rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;
    return true;
  },

  async toggleRule(ruleId, enabled) {
    return this.updateRule(ruleId, { is_enabled: enabled });
  },

  async findMatchingRules(transactionId, limit = 10) {
    const { data, error } = await supabase
      .rpc('find_matching_rules_for_transaction', {
        p_transaction_id: transactionId,
        p_limit: limit
      });

    if (error) throw error;
    return data || [];
  },

  async applyRuleToTransaction(transactionId, ruleId, updateTransaction = true) {
    const { data, error } = await supabase
      .rpc('apply_rule_to_transaction', {
        p_transaction_id: transactionId,
        p_rule_id: ruleId,
        p_update_transaction: updateTransaction
      });

    if (error) throw error;
    return data;
  },

  async checkTransactionMatchesRule(transactionId, ruleId) {
    const { data, error } = await supabase
      .rpc('check_transaction_matches_rule', {
        p_transaction_id: transactionId,
        p_rule_id: ruleId
      });

    if (error) throw error;
    return data;
  },

  async applyManualRuleToAllTransactions(profileId, ruleId) {
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id')
      .eq('profile_id', profileId)
      .eq('status', 'pending');

    if (txError) throw txError;

    const { data: rule, error: ruleError } = await supabase
      .from('transaction_rules')
      .select('match_description_pattern, match_description_mode')
      .eq('id', ruleId)
      .maybeSingle();

    if (ruleError) throw ruleError;

    let applied = 0;
    for (const tx of (transactions || [])) {
      try {
        const result = await this.applyRuleToTransaction(tx.id, ruleId, true);
        if (result?.success) applied++;
      } catch {}
    }

    if (rule?.match_description_pattern) {
      const { data: conflictingSuggestions } = await supabase
        .from('transaction_rules')
        .select('id')
        .eq('profile_id', profileId)
        .eq('match_description_pattern', rule.match_description_pattern)
        .eq('match_description_mode', rule.match_description_mode || 'contains')
        .not('created_from_transaction_id', 'is', null)
        .neq('id', ruleId);

      if (conflictingSuggestions?.length > 0) {
        await supabase
          .from('transaction_rules')
          .delete()
          .in('id', conflictingSuggestions.map(r => r.id));
      }
    }

    return applied;
  },

  async applyRulesToTransactions(profileId, ruleIds = null, transactionIds = null) {
    let transactions;

    if (transactionIds) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('profile_id', profileId)
        .in('id', transactionIds);

      if (error) throw error;
      transactions = data || [];
    } else {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('profile_id', profileId)
        .eq('status', 'pending');

      if (error) throw error;
      transactions = data || [];
    }

    let rules;
    if (ruleIds) {
      const { data, error } = await supabase
        .from('transaction_rules')
        .select('id')
        .eq('profile_id', profileId)
        .eq('is_enabled', true)
        .in('id', ruleIds)
        .order('created_from_transaction_id', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true });

      if (error) throw error;
      rules = data || [];
    } else {
      const { data, error } = await supabase
        .from('transaction_rules')
        .select('id')
        .eq('profile_id', profileId)
        .eq('is_enabled', true)
        .order('created_from_transaction_id', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true });

      if (error) throw error;
      rules = data || [];
    }

    const results = {
      totalTransactions: transactions.length,
      totalRules: rules.length,
      matchedTransactions: 0,
      appliedRules: 0,
      changes: []
    };

    for (const transaction of transactions) {
      let matchedAnyRule = false;

      for (const rule of rules) {
        try {
          const result = await this.applyRuleToTransaction(
            transaction.id,
            rule.id,
            true
          );

          if (result?.success) {
            matchedAnyRule = true;
            results.appliedRules++;
            results.changes.push({
              transactionId: transaction.id,
              ruleId: rule.id,
              changes: result.changes
            });
            break;
          }
        } catch (error) {
        }
      }

      if (matchedAnyRule) {
        results.matchedTransactions++;
      }
    }

    return results;
  },

  async recordRuleFeedback(ruleId, accepted) {
    const field = accepted ? 'times_accepted' : 'times_rejected';

    const { error } = await supabase.rpc('increment', {
      table_name: 'transaction_rules',
      row_id: ruleId,
      field_name: field,
      increment_by: 1
    });

    if (error) {
      const rule = await this.getRule(ruleId);
      const newValue = (rule[field] || 0) + 1;
      await this.updateRule(ruleId, { [field]: newValue });
    }
  },

  async createRuleFromTransaction(profileId, transaction, options = {}) {
    const {
      name,
      categoryId,
      contactId,
      descriptionPattern,
      matchMode = 'contains',
      caseSensitive = false,
      matchAmountExact = false,
      matchAccount = false,
      matchType = false,
      addNote
    } = options;

    const ruleData = {
      name: name || `Auto-categorize ${transaction.description.substring(0, 30)}`,
      match_description_pattern: descriptionPattern || transaction.description,
      match_description_mode: matchMode,
      match_case_sensitive: caseSensitive
    };

    if (matchAmountExact) {
      ruleData.match_amount_exact = Math.abs(transaction.amount);
    }

    if (matchAccount && transaction.bank_account_id) {
      ruleData.match_bank_account_id = transaction.bank_account_id;
    }

    if (matchType && transaction.type) {
      ruleData.match_transaction_type = transaction.type;
    }

    if (categoryId) {
      ruleData.action_set_category_id = categoryId;
    }

    if (contactId) {
      ruleData.action_set_contact_id = contactId;
    }

    if (addNote) {
      ruleData.action_add_note = addNote;
    }

    ruleData.created_from_transaction_id = transaction.id;

    return this.createRule(profileId, ruleData);
  },

  async duplicateRule(ruleId) {
    const rule = await this.getRule(ruleId);

    const { id, created_at, updated_at, times_matched, times_accepted, times_rejected, last_matched_at, ...ruleData } = rule;

    return this.createRule(rule.profile_id, {
      ...ruleData,
      name: `${rule.name} (Copy)`,
      times_matched: 0,
      times_accepted: 0,
      times_rejected: 0
    });
  },

  async getMatchPreview(profileId, conditions, limit = 10) {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('profile_id', profileId)
      .eq('status', 'pending')
      .order('date', { ascending: false })
      .limit(limit);

    if (conditions.match_description_pattern) {
      const patterns = conditions.match_description_pattern.split('|').map(p => p.trim()).filter(Boolean);
      const mode = conditions.match_description_mode || 'contains';
      if (patterns.length === 1) {
        const p = conditions.match_case_sensitive ? patterns[0] : patterns[0].toLowerCase();
        if (mode === 'contains') query = query.ilike('description', `%${p}%`);
        else if (mode === 'starts_with') query = query.ilike('description', `${p}%`);
        else if (mode === 'ends_with') query = query.ilike('description', `%${p}`);
        else query = conditions.match_case_sensitive ? query.eq('description', p) : query.ilike('description', p);
      } else if (patterns.length > 1) {
        const orFilter = patterns.map(p => {
          const lp = conditions.match_case_sensitive ? p : p.toLowerCase();
          return `description.ilike.%${lp}%`;
        }).join(',');
        query = query.or(orFilter);
      }
    }

    if (conditions.match_original_description_pattern) {
      const patterns = conditions.match_original_description_pattern.split('|').map(p => p.trim()).filter(Boolean);
      const mode = conditions.match_description_mode || 'contains';
      if (patterns.length === 1) {
        const p = conditions.match_case_sensitive ? patterns[0] : patterns[0].toLowerCase();
        if (mode === 'contains') query = query.ilike('original_description', `%${p}%`);
        else if (mode === 'starts_with') query = query.ilike('original_description', `${p}%`);
        else if (mode === 'ends_with') query = query.ilike('original_description', `%${p}`);
        else query = conditions.match_case_sensitive ? query.eq('original_description', p) : query.ilike('original_description', p);
      } else if (patterns.length > 1) {
        const orFilter = patterns.map(p => {
          const lp = conditions.match_case_sensitive ? p : p.toLowerCase();
          return `original_description.ilike.%${lp}%`;
        }).join(',');
        query = query.or(orFilter);
      }
    }

    if (conditions.match_money_direction && conditions.match_money_direction !== 'both') {
      if (conditions.match_money_direction === 'money_out') {
        query = query.in('type', ['expense', 'transfer', 'credit_card_payment']);
      } else if (conditions.match_money_direction === 'money_in') {
        query = query.eq('type', 'income');
      }
    }

    if (conditions.match_bank_account_ids && conditions.match_bank_account_ids.length > 0) {
      query = query.in('bank_account_id', conditions.match_bank_account_ids);
    }

    if (conditions.match_amount_min !== undefined && conditions.match_amount_min !== null) {
      query = query.gte('amount', Math.abs(conditions.match_amount_min));
    }

    if (conditions.match_amount_max !== undefined && conditions.match_amount_max !== null) {
      query = query.lte('amount', Math.abs(conditions.match_amount_max));
    }

    if (conditions.match_amount_exact !== undefined && conditions.match_amount_exact !== null) {
      query = query.eq('amount', Math.abs(conditions.match_amount_exact));
    }

    if (conditions.match_transaction_type) {
      query = query.eq('type', conditions.match_transaction_type);
    }

    if (conditions.match_bank_account_id) {
      query = query.eq('bank_account_id', conditions.match_bank_account_id);
    }

    if (conditions.match_contact_id) {
      query = query.eq('contact_id', conditions.match_contact_id);
    }

    if (conditions.match_date_from) {
      query = query.gte('date', conditions.match_date_from);
    }

    if (conditions.match_date_to) {
      query = query.lte('date', conditions.match_date_to);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async checkRuleNameUnique(profileId, name, excludeRuleId = null) {
    let query = supabase
      .from('transaction_rules')
      .select('id, name')
      .eq('profile_id', profileId)
      .ilike('name', name);

    if (excludeRuleId) {
      query = query.neq('id', excludeRuleId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data.length === 0;
  },

  async getRuleTemplates() {
    const { data, error } = await supabase
      .from('transaction_rules')
      .select('*')
      .eq('is_template', true)
      .order('template_category');

    if (error) throw error;
    return data || [];
  },

  async createRuleFromTemplate(profileId, templateId) {
    const template = await this.getRule(templateId);

    const { id, profile_id, created_at, updated_at, times_matched, times_accepted, times_rejected, last_matched_at, is_template, ...ruleData } = template;

    return this.createRule(profileId, {
      ...ruleData,
      times_matched: 0,
      times_accepted: 0,
      times_rejected: 0
    });
  }
};
