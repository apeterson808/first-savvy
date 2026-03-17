import { supabase } from './supabaseClient';

export const vaultService = {
  async getAllItems(profileId, includeShared = true) {
    const { data, error } = await supabase.rpc('get_vault_items', {
      p_profile_id: profileId,
      p_include_shared: includeShared,
    });

    if (error) throw error;
    return data || [];
  },

  async getItemById(itemId) {
    const { data, error } = await supabase
      .from('vault_items')
      .select('*')
      .eq('id', itemId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createItem(itemData, profileId) {
    const { data, error } = await supabase.rpc('create_vault_item', {
      p_item_data: itemData,
      p_profile_id: profileId,
    });

    if (error) throw error;
    return data;
  },

  async updateItem(itemId, itemData) {
    const { error } = await supabase.rpc('update_vault_item', {
      p_item_id: itemId,
      p_item_data: itemData,
    });

    if (error) throw error;
  },

  async deleteItem(itemId) {
    const { error } = await supabase
      .from('vault_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) throw error;
  },

  async restoreItem(itemId) {
    const { error } = await supabase
      .from('vault_items')
      .update({ deleted_at: null })
      .eq('id', itemId);

    if (error) throw error;
  },

  async permanentlyDeleteItem(itemId) {
    const { error } = await supabase
      .from('vault_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  },

  async updateLastUsed(itemId) {
    const { error } = await supabase
      .from('vault_items')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) throw error;
  },

  async searchItems(profileId, query) {
    const items = await this.getAllItems(profileId);

    if (!query) return items;

    const lowerQuery = query.toLowerCase();
    return items.filter(
      (item) =>
        item.name?.toLowerCase().includes(lowerQuery) ||
        item.username?.toLowerCase().includes(lowerQuery) ||
        item.url?.toLowerCase().includes(lowerQuery) ||
        item.notes?.toLowerCase().includes(lowerQuery) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  },

  async getFolders(profileId) {
    const { data, error } = await supabase
      .from('vault_folders')
      .select('*')
      .eq('profile_id', profileId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createFolder(folderData) {
    const { data, error } = await supabase
      .from('vault_folders')
      .insert(folderData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateFolder(folderId, folderData) {
    const { error } = await supabase
      .from('vault_folders')
      .update({ ...folderData, updated_at: new Date().toISOString() })
      .eq('id', folderId);

    if (error) throw error;
  },

  async deleteFolder(folderId) {
    const { error } = await supabase
      .from('vault_folders')
      .delete()
      .eq('id', folderId);

    if (error) throw error;
  },

  async shareItem(itemId, userId, permission, expiresAt = null) {
    const { data, error } = await supabase.rpc('share_vault_item', {
      p_item_id: itemId,
      p_user_id: userId,
      p_permission: permission,
      p_expires_at: expiresAt,
    });

    if (error) throw error;
    return data;
  },

  async revokeShare(shareId) {
    const { error } = await supabase.rpc('revoke_vault_share', {
      p_share_id: shareId,
    });

    if (error) throw error;
  },

  async getShares(itemId) {
    const { data, error } = await supabase
      .from('vault_shares')
      .select(`
        *,
        shared_with:shared_with_user_id(
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('vault_item_id', itemId)
      .is('revoked_at', null);

    if (error) throw error;
    return data || [];
  },

  async getSharedWithMe() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('vault_shares')
      .select(`
        *,
        vault_items(*),
        shared_by:shared_by_user_id(
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('shared_with_user_id', user.id)
      .is('revoked_at', null);

    if (error) throw error;
    return data || [];
  },

  generatePassword(length = 16, options = {}) {
    const {
      includeUppercase = true,
      includeLowercase = true,
      includeNumbers = true,
      includeSymbols = true,
    } = options;

    let charset = '';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (charset === '') {
      charset = 'abcdefghijklmnopqrstuvwxyz';
    }

    let password = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }

    return password;
  },

  calculatePasswordStrength(password) {
    if (!password) return { score: 0, label: 'None', color: 'gray' };

    let score = 0;

    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    if (score <= 2) return { score, label: 'Weak', color: 'red' };
    if (score <= 4) return { score, label: 'Fair', color: 'orange' };
    if (score <= 5) return { score, label: 'Good', color: 'yellow' };
    return { score, label: 'Strong', color: 'green' };
  },

  async exportVault(profileId) {
    const items = await this.getAllItems(profileId, false);
    const folders = await this.getFolders(profileId);

    return {
      exportDate: new Date().toISOString(),
      folders,
      items,
    };
  },

  async importVault(profileId, importData) {
    const imported = {
      folders: 0,
      items: 0,
      errors: [],
    };

    if (importData.folders) {
      for (const folder of importData.folders) {
        try {
          await this.createFolder({
            ...folder,
            profile_id: profileId,
            id: undefined,
          });
          imported.folders++;
        } catch (error) {
          imported.errors.push(`Folder "${folder.name}": ${error.message}`);
        }
      }
    }

    if (importData.items) {
      for (const item of importData.items) {
        try {
          await this.createItem(
            {
              ...item,
              id: undefined,
            },
            profileId
          );
          imported.items++;
        } catch (error) {
          imported.errors.push(`Item "${item.name}": ${error.message}`);
        }
      }
    }

    return imported;
  },
};
