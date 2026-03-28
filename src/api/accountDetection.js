import { supabase } from './supabaseClient';

export const accountDetectionService = {
  async checkEmailForAccount(email) {
    if (!email || !email.includes('@')) {
      return { found: false, user: null };
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('id, email, full_name, avatar_url')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('Email check error:', error);
        return { found: false, user: null, error };
      }

      if (data) {
        return {
          found: true,
          user: {
            id: data.id,
            email: data.email,
            name: data.full_name || data.email,
            avatar: data.avatar_url
          }
        };
      }

      return { found: false, user: null };
    } catch (err) {
      console.error('Email check exception:', err);
      return { found: false, user: null, error: err };
    }
  },

  async checkPhoneForAccount(phone) {
    if (!phone) {
      return { found: false, user: null };
    }

    const phoneDigits = phone.replace(/[^\d]/g, '');
    if (phoneDigits.length !== 10) {
      return { found: false, user: null };
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('id, phone, email, full_name, avatar_url')
        .eq('phone', phoneDigits)
        .maybeSingle();

      if (error) {
        console.error('Phone check error:', error);
        return { found: false, user: null, error };
      }

      if (data) {
        return {
          found: true,
          user: {
            id: data.id,
            phone: data.phone,
            email: data.email,
            name: data.full_name || data.email || data.phone,
            avatar: data.avatar_url
          }
        };
      }

      return { found: false, user: null };
    } catch (err) {
      console.error('Phone check exception:', err);
      return { found: false, user: null, error: err };
    }
  },

  async checkExistingConnection(userId, targetUserId) {
    if (!userId || !targetUserId) {
      return { exists: false, relationship: null };
    }

    try {
      const { data, error } = await supabase
        .from('user_relationships')
        .select('*')
        .or(`and(user_id.eq.${userId},related_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},related_user_id.eq.${userId})`)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        return { exists: false, relationship: null, error };
      }

      return {
        exists: !!data,
        relationship: data
      };
    } catch (err) {
      return { exists: false, relationship: null, error: err };
    }
  }
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
