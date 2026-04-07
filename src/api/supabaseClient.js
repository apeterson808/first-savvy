import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (typeof window !== 'undefined') {
  window.supabase = supabase;
}

const getActiveProfileId = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeProfileId');
  }
  return null;
};

const TABLES_WITH_PROFILE_ID = [
  'transactions',
  'budgets',
  'contacts',
  'user_chart_of_accounts',
  'transaction_rules',
  'journal_entries',
  'journal_entry_lines',
  'transaction_splits',
  'tasks',
  'rewards',
  'task_templates',
  'vault_folders',
  'vault_items',
  'vault_encryption_keys',
  'csv_column_mapping_configs',
  'ai_category_suggestions',
  'ai_contact_suggestions',
  'transfer_match_suggestions',
  'journal_entry_attachments',
  'transaction_match_history',
  'detection_jobs',
  'transaction_processing_state',
  'transfer_match_history',
  'cc_payment_match_history',
  'job_execution_metrics',
  'detection_jobs_archive',
  'transfer_registry',
  'transfer_patterns',
  'credit_card_payment_registry',
  'credit_card_payment_patterns',
  'transaction_categorization_memory',
  'audit_logs'
];

const createEntityAPI = (tableName) => {
  const requiresProfileId = TABLES_WITH_PROFILE_ID.includes(tableName);

  return {
    async list(orderBy = 'created_at', limit = null) {
      let query = supabase.from(tableName).select('*');

      if (requiresProfileId) {
        const profileId = getActiveProfileId();
        if (profileId) {
          query = query.eq('profile_id', profileId);
        }
      }

      if (orderBy) {
        // Handle multiple order columns separated by comma
        const columns = orderBy.split(',').map(col => col.trim());
        columns.forEach(col => {
          const isDescending = col.startsWith('-');
          const column = isDescending ? col.substring(1) : col;
          query = query.order(column, { ascending: !isDescending });
        });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filter(conditions = {}, orderBy = null, limit = null) {
      let query = supabase.from(tableName).select('*');

      if (requiresProfileId) {
        const profileId = getActiveProfileId();
        if (profileId) {
          query = query.eq('profile_id', profileId);
        }
      }

      for (const [key, value] of Object.entries(conditions)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      }

      if (orderBy) {
        // Handle multiple order columns separated by comma
        const columns = orderBy.split(',').map(col => col.trim());
        columns.forEach(col => {
          const isDescending = col.startsWith('-');
          const column = isDescending ? col.substring(1) : col;
          query = query.order(column, { ascending: !isDescending });
        });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      let query = supabase
        .from(tableName)
        .select('*')
        .eq('id', id);

      if (requiresProfileId) {
        const profileId = getActiveProfileId();
        if (profileId) {
          query = query.eq('profile_id', profileId);
        }
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data;
    },

    async create(record) {
      let recordToInsert = { ...record };

      if (requiresProfileId && !recordToInsert.profile_id) {
        const profileId = getActiveProfileId();
        if (profileId) {
          recordToInsert = { ...recordToInsert, profile_id: profileId };
        }
      }

      const { data, error } = await supabase
        .from(tableName)
        .insert(recordToInsert)
        .select()
        .single();

      if (error) {
        throw error;
      }
      return data;
    },

    async bulkCreate(records) {
      let recordsToInsert = [...records];

      if (requiresProfileId) {
        const profileId = getActiveProfileId();
        if (profileId) {
          recordsToInsert = recordsToInsert.map(record =>
            record.profile_id ? record : { ...record, profile_id: profileId }
          );
        }
      }

      const { data, error } = await supabase
        .from(tableName)
        .insert(recordsToInsert)
        .select();

      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      // Special handling for transaction status changes
      // Must use transactionService to maintain journal entry integrity
      if (tableName === 'transactions' && 'status' in updates) {
        throw new Error(
          'Direct transaction status updates not allowed. ' +
          'Use transactionService.postTransaction() or transactionService.undoPostTransaction() instead.'
        );
      }

      if (tableName === 'user_chart_of_accounts') {
        const accountToUpdate = await supabase
          .from('user_chart_of_accounts')
          .select('template_account_number')
          .eq('id', id)
          .maybeSingle();

        if (accountToUpdate.data) {
          const isSystemAccount = accountToUpdate.data.template_account_number === 3000 ||
                                   accountToUpdate.data.template_account_number === 3200;
          if (isSystemAccount) {
            throw new Error('System accounts cannot be modified');
          }
        }
      }

      let query = supabase
        .from(tableName)
        .update(updates)
        .eq('id', id);

      if (requiresProfileId) {
        const profileId = getActiveProfileId();
        if (profileId) {
          query = query.eq('profile_id', profileId);
        }
      }

      const { data, error } = await query.select('*').single();

      if (error) {
        throw error;
      }
      return data;
    },

    async delete(id) {
      if (tableName === 'user_chart_of_accounts') {
        const accountToDelete = await supabase
          .from('user_chart_of_accounts')
          .select('template_account_number')
          .eq('id', id)
          .maybeSingle();

        if (accountToDelete.data) {
          const isSystemAccount = accountToDelete.data.template_account_number === 3000 ||
                                   accountToDelete.data.template_account_number === 3200;
          if (isSystemAccount) {
            throw new Error('System accounts cannot be deleted');
          }
        }
      }

      let query = supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (requiresProfileId) {
        const profileId = getActiveProfileId();
        if (profileId) {
          query = query.eq('profile_id', profileId);
        }
      }

      const { error } = await query;

      if (error) throw error;
      return { success: true };
    }
  };
};

export const createSupabaseClient = () => {
  return {
    supabase,
    from: (...args) => supabase.from(...args),
    rpc: (...args) => supabase.rpc(...args),
    storage: supabase.storage,
    entities: {
      Transaction: createEntityAPI('transactions'),
      Budget: createEntityAPI('budgets'),
      Contact: createEntityAPI('contacts'),
      ChartAccount: createEntityAPI('user_chart_of_accounts'),
      Account: createEntityAPI('user_chart_of_accounts'),
      UserRelationship: createEntityAPI('user_relationships'),
      Invitation: createEntityAPI('invitations'),
      TransactionRule: createEntityAPI('transaction_rules')
    },
    auth: {
      async signUp(email, password, fullName) {
        const signUpParams = {
          email,
          password
        };

        if (fullName) {
          signUpParams.options = {
            data: { full_name: fullName }
          };
        }

        const { data, error } = await supabase.auth.signUp(signUpParams);
        if (error) throw error;
        return data;
      },
      async signIn(emailOrUsername, password) {
        let loginEmail = emailOrUsername;

        if (!emailOrUsername.includes('@')) {
          const { data: childProfile, error: lookupError } = await supabase
            .from('child_profiles')
            .select('id')
            .eq('username', emailOrUsername.toLowerCase())
            .maybeSingle();

          if (!lookupError && childProfile) {
            loginEmail = `child_${childProfile.id}@firstsavvy.internal`;
          }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password
        });
        if (error) throw error;
        return data;
      },
      async signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) throw error;
        return data;
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      async getUser() {
        const { data, error } = await supabase.auth.getUser();
        return { data, error };
      },
      async me() {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user;
      },
      async getSession() {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
      },
      onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange((event, session) => {
          (() => {
            callback(event, session);
          })();
        });
      }
    },
    functions: {
      async aiCategorizeTransaction(body) {
        const { data, error } = await supabase.functions.invoke('ai-categorize-transaction', { body });
        if (error) throw error;
        return data;
      },
      async aiSuggestContact(body) {
        const { data, error } = await supabase.functions.invoke('ai-suggest-contact', { body });
        if (error) throw error;
        return data;
      },
      async sendPaymentReminders(body) {
        const { data, error } = await supabase.functions.invoke('send-payment-reminders', { body });
        if (error) throw error;
        return data;
      }
    }
  };
};
