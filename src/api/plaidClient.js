import { supabase } from './supabaseClient';

const PLAID_API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const plaidAPI = {
  async createLinkToken(userId) {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${PLAID_API_BASE}/plaid-create-link-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create link token');
    }

    return response.json();
  },

  async exchangePublicToken(publicToken, metadata) {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${PLAID_API_BASE}/plaid-exchange-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_token: publicToken,
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to exchange token');
    }

    return response.json();
  },

  async getAccounts(itemId) {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${PLAID_API_BASE}/plaid-get-accounts?item_id=${itemId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch accounts');
    }

    return response.json();
  },

  async importTransactions(mappings) {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${PLAID_API_BASE}/plaid-import-transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mappings }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to import transactions');
    }

    return response.json();
  },

  async syncTransactions(itemId) {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${PLAID_API_BASE}/plaid-sync-transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ item_id: itemId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sync transactions');
    }

    return response.json();
  },
};
