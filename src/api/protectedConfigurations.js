import { supabase } from './supabaseClient';

async function generateHash(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(content));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export const protectedConfigurationService = {
  async getConfiguration(name) {
    const { data, error } = await supabase
      .from('protected_configurations')
      .select('*')
      .eq('name', name)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getAllConfigurations() {
    const { data, error } = await supabase
      .from('protected_configurations')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createConfiguration(configData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const hash = await generateHash(configData.configuration_data);

    const { data, error } = await supabase
      .from('protected_configurations')
      .insert({
        name: configData.name,
        description: configData.description,
        version: configData.version || '1.0.0',
        content_hash: hash,
        configuration_data: configData.configuration_data,
        file_paths: configData.file_paths || [],
        is_locked: configData.is_locked !== undefined ? configData.is_locked : true,
        is_active: true,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateConfiguration(id, updates, changeDescription) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: oldConfig } = await supabase
      .from('protected_configurations')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldConfig) throw new Error('Configuration not found');

    const newConfigData = updates.configuration_data || oldConfig.configuration_data;
    const newHash = await generateHash(newConfigData);
    const newVersion = updates.version || this.incrementVersion(oldConfig.version);

    const { data, error } = await supabase
      .from('protected_configurations')
      .update({
        ...updates,
        content_hash: newHash,
        version: newVersion,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await this.logChange({
      configuration_id: id,
      user_id: user.id,
      change_type: 'update',
      old_version: oldConfig.version,
      new_version: newVersion,
      change_description: changeDescription,
      diff_data: {
        old: oldConfig.configuration_data,
        new: newConfigData
      }
    });

    return data;
  },

  async verifyIntegrity(name, currentContent) {
    const config = await this.getConfiguration(name);
    if (!config) return { valid: false, error: 'Configuration not found' };

    const currentHash = await generateHash(currentContent);
    const valid = currentHash === config.content_hash;

    return {
      valid,
      expectedHash: config.content_hash,
      actualHash: currentHash,
      configuration: config
    };
  },

  async lockConfiguration(id) {
    const { data, error } = await supabase
      .from('protected_configurations')
      .update({ is_locked: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await this.logChange({
        configuration_id: id,
        user_id: user.id,
        change_type: 'lock',
        change_description: 'Configuration locked'
      });
    }

    return data;
  },

  async unlockConfiguration(id) {
    const { data, error } = await supabase
      .from('protected_configurations')
      .update({ is_locked: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await this.logChange({
        configuration_id: id,
        user_id: user.id,
        change_type: 'unlock',
        change_description: 'Configuration unlocked'
      });
    }

    return data;
  },

  async restoreVersion(configurationId, versionToRestore) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: oldConfig } = await supabase
      .from('protected_configurations')
      .select('*')
      .eq('id', configurationId)
      .single();

    if (!oldConfig) throw new Error('Configuration not found');

    const { data: changeLog } = await supabase
      .from('configuration_change_log')
      .select('*')
      .eq('configuration_id', configurationId)
      .eq('new_version', versionToRestore)
      .maybeSingle();

    if (!changeLog || !changeLog.diff_data?.new) {
      throw new Error('Version not found in change log');
    }

    const restoredData = changeLog.diff_data.new;
    const newHash = await generateHash(restoredData);

    const { data, error } = await supabase
      .from('protected_configurations')
      .update({
        configuration_data: restoredData,
        content_hash: newHash,
        version: this.incrementVersion(oldConfig.version),
        updated_at: new Date().toISOString()
      })
      .eq('id', configurationId)
      .select()
      .single();

    if (error) throw error;

    await this.logChange({
      configuration_id: configurationId,
      user_id: user.id,
      change_type: 'restore',
      old_version: oldConfig.version,
      new_version: data.version,
      change_description: `Restored to version ${versionToRestore}`,
      diff_data: {
        old: oldConfig.configuration_data,
        new: restoredData
      }
    });

    return data;
  },

  async getChangeHistory(configurationId) {
    const { data, error } = await supabase
      .from('configuration_change_log')
      .select(`
        *,
        user:user_id(id, email)
      `)
      .eq('configuration_id', configurationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async logChange(changeData) {
    const { error } = await supabase
      .from('configuration_change_log')
      .insert({
        ...changeData,
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  },

  incrementVersion(currentVersion) {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }
};
