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
  'transactions', 'budgets', 'contacts',
  'user_chart_of_accounts', 'transaction_rules'
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

      console.log(`[${tableName}] Creating record:`, recordToInsert);

      const { data, error } = await supabase
        .from(tableName)
        .insert(recordToInsert)
        .select()
        .single();

      if (error) {
        console.error(`[${tableName}] Create error:`, error);
        console.error(`[${tableName}] Failed record:`, recordToInsert);
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

      console.log(`[${tableName}] Updating record:`, { id, updates });

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
        console.error(`[${tableName}] Update error:`, error);
        console.error(`[${tableName}] Failed update data:`, { id, updates });
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
      async parsePdfStatement(body) {
        try {
          const session = await supabase.auth.getSession();
          const token = session.data?.session?.access_token;

          if (!token) {
            throw new Error('Not authenticated');
          }

          const functionUrl = `${supabaseUrl}/functions/v1/parse-pdf-statement`;

          console.log('Calling edge function directly:', functionUrl);
          console.log('Request body keys:', Object.keys(body));

          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
          });

          console.log('Response status:', response.status);
          console.log('Response ok:', response.ok);

          const responseData = await response.json();
          console.log('Response data:', responseData);

          if (!response.ok) {
            const errorMessage = responseData.error || 'Edge function error';
            const errorDetails = responseData.details || '';
            throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
          }

          return responseData;
        } catch (err) {
          console.error('parsePdfStatement error:', err);
          throw err;
        }
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
      async sendPaymentReminders(body) {
        const { data, error } = await supabase.functions.invoke('send-payment-reminders', { body });
        if (error) throw error;
        return data;
      }
    }
  };
};
