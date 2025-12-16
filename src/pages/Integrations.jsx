import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { serviceIntegrationsAPI } from '@/api/serviceIntegrations';
import {
  ShoppingBag,
  Film,
  Music,
  TrendingUp,
  Cable,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw
} from 'lucide-react';

const AVAILABLE_SERVICES = [
  {
    id: 'amazon',
    name: 'Amazon',
    description: 'Import order history and match with transactions',
    icon: ShoppingBag,
    color: 'text-orange-500',
    connectionType: 'credentials'
  },
  {
    id: 'netflix',
    name: 'Netflix',
    description: 'Track subscription and viewing history',
    icon: Film,
    color: 'text-red-500',
    connectionType: 'credentials'
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Monitor subscription and listening habits',
    icon: Music,
    color: 'text-green-500',
    connectionType: 'oauth'
  },
  {
    id: 'robinhood',
    name: 'Robinhood',
    description: 'Import investment portfolio and trades',
    icon: TrendingUp,
    color: 'text-green-600',
    connectionType: 'oauth'
  }
];

export default function Integrations() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    try {
      const data = await serviceIntegrationsAPI.getMyConnections();
      setConnections(data);
    } catch (error) {
      console.error('Error loading connections:', error);
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(service) {
    setConnecting(service.id);
    try {
      toast.info(`Connecting to ${service.name}...`);

      await serviceIntegrationsAPI.connectService(
        service.id,
        service.connectionType,
        { connected_at: new Date().toISOString() }
      );

      toast.success(`Connected to ${service.name}`);
      await loadConnections();
    } catch (error) {
      console.error('Connection error:', error);
      toast.error(`Failed to connect to ${service.name}`);
    } finally {
      setConnecting(null);
    }
  }

  async function handleDisconnect(connectionId, serviceName) {
    try {
      await serviceIntegrationsAPI.disconnectService(connectionId);
      toast.success(`Disconnected from ${serviceName}`);
      await loadConnections();
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect service');
    }
  }

  async function handleSync(connectionId, serviceName) {
    try {
      toast.info(`Syncing ${serviceName}...`);
      await serviceIntegrationsAPI.syncService(connectionId);
      toast.success(`${serviceName} synced successfully`);
      await loadConnections();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync service');
    }
  }

  function getConnection(serviceId) {
    return connections.find(c => c.service_name === serviceId && c.is_active);
  }

  function getStatusBadge(connection) {
    if (!connection) return null;

    const statusConfig = {
      active: { label: 'Connected', variant: 'default', icon: Check },
      expired: { label: 'Token Expired', variant: 'destructive', icon: AlertCircle },
      error: { label: 'Error', variant: 'destructive', icon: AlertCircle },
      disconnected: { label: 'Disconnected', variant: 'secondary', icon: AlertCircle }
    };

    const config = statusConfig[connection.connection_status] || statusConfig.disconnected;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect external services to automatically sync transactions and enrich your financial data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Services</CardTitle>
          <CardDescription>
            Connect your favorite services to get the most out of your financial data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {AVAILABLE_SERVICES.map((service) => {
            const connection = getConnection(service.id);
            const Icon = service.icon;
            const isConnecting = connecting === service.id;

            return (
              <div key={service.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-lg bg-muted ${service.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{service.name}</h3>
                        {getStatusBadge(connection)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {service.description}
                      </p>
                      {connection && connection.last_sync_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last synced: {new Date(connection.last_sync_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {connection ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(connection.id, service.name)}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Sync
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(connection.id, service.name)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleConnect(service)}
                        disabled={isConnecting}
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Cable className="h-4 w-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <Separator className="mt-4" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>
            Monitor the health and status of your connected services
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No services connected yet. Connect a service above to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => {
                const service = AVAILABLE_SERVICES.find(s => s.id === connection.service_name);
                return (
                  <div key={connection.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{service?.name || connection.service_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Connected {new Date(connection.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(connection)}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
