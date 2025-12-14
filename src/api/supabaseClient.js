import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const createEntityAPI = (tableName) => {
  return {
    async list(orderBy = 'created_at', limit = null) {
      let query = supabase.from(tableName).select('*');

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

    async filter(conditions = {}) {
      let query = supabase.from(tableName).select('*');

      for (const [key, value] of Object.entries(conditions)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    async create(record) {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const recordWithUser = userId ? { ...record, user_id: userId } : record;

      const { data, error } = await supabase
        .from(tableName)
        .insert(recordWithUser)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    }
  };
};

export const createSupabaseClient = () => {
  return {
    entities: {
      BankAccount: createEntityAPI('bank_accounts'),
      Transaction: createEntityAPI('transactions'),
      Budget: createEntityAPI('budgets'),
      BudgetGroup: createEntityAPI('budget_groups'),
      Category: createEntityAPI('categories'),
      CategorizationRule: createEntityAPI('categorization_rules'),
      Goal: createEntityAPI('goals'),
      Bill: createEntityAPI('bills'),
      Asset: createEntityAPI('assets'),
      Liability: createEntityAPI('liabilities'),
      CreditScore: createEntityAPI('credit_scores'),
      CreditCard: createEntityAPI('credit_cards'),
      Contact: createEntityAPI('contacts'),
      DetailType: createEntityAPI('detail_types'),
      AuditLog: createEntityAPI('audit_logs'),
      DataRetentionPolicy: createEntityAPI('data_retention_policies'),
      UserConsent: createEntityAPI('user_consents'),
      DataExportRequest: createEntityAPI('data_export_requests'),
      DataDeletionRequest: createEntityAPI('data_deletion_requests')
    },
    auth: {
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data;
      },
      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      async getUser() {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user;
      },
      async me() {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user;
      }
    }
  };
};
