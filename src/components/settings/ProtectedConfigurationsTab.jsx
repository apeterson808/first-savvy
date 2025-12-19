import React, { useState } from 'react';
import { useConfigurationManagement, useProtectedConfiguration } from '@/hooks/useProtectedConfiguration';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  History,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Eye
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function ProtectedConfigurationsTab() {
  const { configurations, loading, error, lock, unlock, getHistory, refresh } = useConfigurationManagement();
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { integrity } = useProtectedConfiguration('category_dropdown_system');

  const handleLock = async (configId) => {
    try {
      await lock(configId);
      toast.success('Configuration locked successfully');
    } catch (err) {
      toast.error('Failed to lock configuration: ' + err.message);
    }
  };

  const handleUnlock = async (configId) => {
    try {
      await unlock(configId);
      toast.success('Configuration unlocked successfully');
    } catch (err) {
      toast.error('Failed to unlock configuration: ' + err.message);
    }
  };

  const handleViewHistory = async (config) => {
    setSelectedConfig(config);
    setLoadingHistory(true);
    setShowHistory(true);

    try {
      const history = await getHistory(config.id);
      setHistoryData(history);
    } catch (err) {
      toast.error('Failed to load history: ' + err.message);
      setHistoryData([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewDetails = (config) => {
    setSelectedConfig(config);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Protected Configurations</h3>
        <p className="text-sm text-slate-600">
          Manage and monitor critical application configurations that require explicit confirmation before modification.
        </p>
      </div>

      <Separator />

      {integrity && !integrity.valid && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong>Integrity Warning:</strong> Category Dropdown configuration has {integrity.differences?.length || 0} difference(s) from the protected baseline.
          </AlertDescription>
        </Alert>
      )}

      {integrity && integrity.valid && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-900">
            All protected configurations are verified and match their baseline versions.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-slate-600" />
          <h4 className="font-semibold">Protected Configurations ({configurations.length})</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && configurations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            Loading configurations...
          </CardContent>
        </Card>
      ) : configurations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            No protected configurations found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {configurations.map((config) => (
            <Card key={config.id} className="border-2">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      config.is_locked ? 'bg-red-100' : 'bg-green-100'
                    }`}>
                      {config.is_locked ? (
                        <ShieldAlert className="h-5 w-5 text-red-600" />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">{config.name}</CardTitle>
                        <Badge variant={config.is_locked ? 'destructive' : 'secondary'} className="text-xs">
                          {config.is_locked ? (
                            <>
                              <Lock className="h-3 w-3 mr-1" />
                              Locked
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3 w-3 mr-1" />
                              Unlocked
                            </>
                          )}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          v{config.version}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">
                        {config.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {config.file_paths && config.file_paths.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileCode className="h-4 w-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Protected Files:</span>
                      </div>
                      <ul className="space-y-1 ml-6">
                        {config.file_paths.map((filePath, idx) => (
                          <li key={idx} className="text-sm font-mono text-slate-600">
                            {filePath}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(config)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewHistory(config)}
                    >
                      <History className="h-4 w-4 mr-2" />
                      History
                    </Button>
                    {config.is_locked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlock(config.id)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Unlock className="h-4 w-4 mr-2" />
                        Unlock
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLock(config.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Lock
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuration Change History</DialogTitle>
            <DialogDescription>
              {selectedConfig?.name} - Version history and modifications
            </DialogDescription>
          </DialogHeader>

          {loadingHistory ? (
            <div className="py-8 text-center text-slate-500">Loading history...</div>
          ) : historyData.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No change history found</div>
          ) : (
            <div className="space-y-3">
              {historyData.map((change) => (
                <Card key={change.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <History className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {change.change_type}
                          </Badge>
                          {change.new_version && (
                            <Badge variant="secondary" className="text-xs">
                              v{change.new_version}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 mb-2">
                          {change.change_description || 'No description provided'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>{new Date(change.created_at).toLocaleString()}</span>
                          {change.user?.email && <span>by {change.user.email}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedConfig && !showHistory && (
        <Dialog open={!!selectedConfig} onOpenChange={() => setSelectedConfig(null)}>
          <DialogContent className="max-w-3xl max-h-[600px] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configuration Details</DialogTitle>
              <DialogDescription>
                {selectedConfig.name} - Version {selectedConfig.version}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Description</h4>
                <p className="text-sm text-slate-700">{selectedConfig.description}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Status</h4>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedConfig.is_locked ? 'destructive' : 'secondary'}>
                    {selectedConfig.is_locked ? 'Locked' : 'Unlocked'}
                  </Badge>
                  <Badge variant={selectedConfig.is_active ? 'default' : 'outline'}>
                    {selectedConfig.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Content Hash</h4>
                <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">
                  {selectedConfig.content_hash}
                </code>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Protected Files</h4>
                <ul className="space-y-1">
                  {selectedConfig.file_paths?.map((file, idx) => (
                    <li key={idx} className="text-sm font-mono text-slate-600">
                      {file}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Configuration Data</h4>
                <pre className="text-xs bg-slate-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(selectedConfig.configuration_data, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
