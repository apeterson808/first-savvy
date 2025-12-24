import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase configuration missing!', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    url: supabaseUrl
  });
} else {
  console.log('Supabase client initializing with URL:', supabaseUrl);
}

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
  'accounts', 'transactions', 'budgets', 'budget_groups',
  'goals', 'bills', 'assets', 'liabilities', 'equity',
  'contacts', 'user_chart_of_accounts', 'credit_cards',
  'credit_scores', 'vehicles', 'auto_loans', 'properties',
  'mortgages', 'plaid_items'
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
        const isDescending = orderBy.startsWith('-');
        const column = isDescending ? orderBy.substring(1) : orderBy;
        query = query.order(column, { ascending: !isDescending });
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
        const isDescending = orderBy.startsWith('-');
        const column = isDescending ? orderBy.substring(1) : orderBy;
        query = query.order(column, { ascending: !isDescending });
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
      const userId = (await supabase.auth.getUser()).data.user?.id;
      let recordToInsert = userId ? { ...record, user_id: userId } : record;

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
        console.error(`[${tableName}] Create error:`, error);
        throw error;
      }
      return data;
    },

    async bulkCreate(records) {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      let recordsToInsert = userId
        ? records.map(record => ({ ...record, user_id: userId }))
        : records;

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

      const { data, error } = await query.select().single();

      if (error) throw error;
      return data;
    },

    async delete(id) {
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
      Account: createEntityAPI('accounts'),
      BankAccount: createEntityAPI('bank_accounts'),
      CreditCard: createEntityAPI('credit_cards'),
      Transaction: createEntityAPI('transactions'),
      Budget: createEntityAPI('budgets'),
      BudgetGroup: createEntityAPI('budget_groups'),
      Goal: createEntityAPI('goals'),
      Bill: createEntityAPI('bills'),
      Asset: createEntityAPI('assets'),
      Liability: createEntityAPI('liabilities'),
      Equity: createEntityAPI('equity'),
      CreditScore: createEntityAPI('credit_scores'),
      Contact: createEntityAPI('contacts'),
      ChartAccount: createEntityAPI('user_chart_of_accounts'),
      DetailType: createEntityAPI('detail_types'),
      AuditLog: createEntityAPI('audit_logs'),
      DataRetentionPolicy: createEntityAPI('data_retention_policies'),
      UserConsent: createEntityAPI('user_consents'),
      DataExportRequest: createEntityAPI('data_export_requests'),
      DataDeletionRequest: createEntityAPI('data_deletion_requests'),
      ServiceConnection: createEntityAPI('service_connections'),
      UserRelationship: createEntityAPI('user_relationships'),
      SharedResource: createEntityAPI('shared_resources'),
      HouseholdGroup: createEntityAPI('household_groups'),
      HouseholdMember: createEntityAPI('household_members'),
      Invitation: createEntityAPI('invitations')
    },
    auth: {
      async signUp(email, password, fullName) {
        const options = fullName ? {
          data: { full_name: fullName }
        } : undefined;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options
        });
        if (error) throw error;
        return data;
      },
      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
      async parseOfx(body) {
        const { data, error } = await supabase.functions.invoke('parse-ofx', { body });
        if (error) throw error;
        return data;
      },
      async parseCsv(body) {
        const { data, error } = await supabase.functions.invoke('parse-csv', { body });
        if (error) throw error;
        return data;
      },
      async fixImportedTransactions(body) {
        const { data, error } = await supabase.functions.invoke('fix-imported-transactions', { body });
        if (error) throw error;
        return data;
      },
      async plaidCreateLinkToken(body) {
        const { data, error } = await supabase.functions.invoke('plaid-create-link-token', { body });
        if (error) throw error;
        return data;
      },
      async plaidExchangeToken(body) {
        const { data, error } = await supabase.functions.invoke('plaid-exchange-token', { body });
        if (error) throw error;
        return data;
      },
      async plaidCompleteImport(body) {
        const { data, error } = await supabase.functions.invoke('plaid-complete-import', { body });
        if (error) throw error;
        return data;
      },
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
      async sendInvitationNotification(body) {
        const { data, error } = await supabase.functions.invoke('send-invitation-notification', { body });
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
