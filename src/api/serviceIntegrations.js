import { supabase } from './supabaseClient';

export const serviceIntegrationsAPI = {
  async connectService(serviceName, connectionType, credentials) {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const connectionData = {
      user_id: userId,
      service_name: serviceName,
      connection_type: connectionType,
      connection_status: 'active',
      is_active: true
    };

    if (connectionType === 'oauth') {
      connectionData.access_token = credentials.access_token;
      connectionData.refresh_token = credentials.refresh_token;
      connectionData.token_expiry = credentials.token_expiry;
    } else {
      connectionData.encrypted_credentials = credentials;
    }

    const { data, error } = await supabase
      .from('service_connections')
      .insert(connectionData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getMyConnections() {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('service_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getConnectionByService(serviceName) {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('service_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', serviceName)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateConnection(connectionId, updates) {
    const { data, error } = await supabase
      .from('service_connections')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateConnectionStatus(connectionId, status) {
    return this.updateConnection(connectionId, { connection_status: status });
  },

  async refreshToken(connectionId, newAccessToken, newRefreshToken, tokenExpiry) {
    return this.updateConnection(connectionId, {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_expiry: tokenExpiry
    });
  },

  async updateLastSync(connectionId) {
    return this.updateConnection(connectionId, {
      last_sync_at: new Date().toISOString()
    });
  },

  async updateMetadata(connectionId, metadata) {
    const connection = await this.getConnection(connectionId);
    const updatedMetadata = {
      ...connection.metadata,
      ...metadata
    };

    return this.updateConnection(connectionId, { metadata: updatedMetadata });
  },

  async getConnection(connectionId) {
    const { data, error } = await supabase
      .from('service_connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async disconnectService(connectionId) {
    const { data, error } = await supabase
      .from('service_connections')
      .update({
        is_active: false,
        connection_status: 'disconnected'
      })
      .eq('id', connectionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteConnection(connectionId) {
    const { error } = await supabase
      .from('service_connections')
      .delete()
      .eq('id', connectionId);

    if (error) throw error;
    return { success: true };
  },

  async getActiveConnections() {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('service_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('connection_status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getExpiredConnections() {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('service_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lt('token_expiry', new Date().toISOString())
      .order('token_expiry');

    if (error) throw error;
    return data || [];
  },

  async syncService(connectionId) {
    const connection = await this.getConnection(connectionId);
    if (!connection) throw new Error('Connection not found');

    if (connection.connection_status !== 'active') {
      throw new Error('Connection is not active');
    }

    await this.updateLastSync(connectionId);

    return {
      success: true,
      service: connection.service_name,
      last_sync: new Date().toISOString()
    };
  }
};
