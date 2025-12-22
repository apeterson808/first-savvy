import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RefreshCw, Building2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { firstsavvy } from '@/api/firstsavvyClient';
import { plaidAPI } from '@/api/plaidClient';
import { useAuth } from '@/contexts/AuthContext';
import { PlaidLinkButton } from './PlaidLinkButton';

export default function PlaidConnectionsTest({ open, onOpenChange }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [syncingItems, setSyncingItems] = useState(new Set());

  const { data: plaidItems = [], isLoading, refetch } = useQuery({
    queryKey: ['plaidItems'],
    queryFn: async () => {
      const items = await firstsavvy.entities.PlaidItem.list('-created_at');
      return items;
    },
    enabled: open && !!user,
  });

  const handleSync = async (itemId, institutionName) => {
    setSyncingItems(prev => new Set(prev).add(itemId));

    try {
      const response = await plaidAPI.syncTransactions(itemId);

      const added = response.added || 0;
      const modified = response.modified || 0;
      const removed = response.removed || 0;

      toast.success(
        `Synced ${institutionName}`,
        {
          description: `Added: ${added}, Modified: ${modified}, Removed: ${removed}`,
        }
      );

      queryClient.invalidateQueries({ queryKey: ['plaidItems'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeAccounts'] });

      await refetch();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed', {
        description: error.message || 'Unable to sync transactions',
      });
    } finally {
      setSyncingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handlePlaidSuccess = async () => {
    toast.success('Bank connected successfully!');
    await refetch();
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['activeAccounts'] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" aria-describedby="plaid-connections-description">
        <SheetHeader>
          <SheetTitle>Plaid Connections</SheetTitle>
          <p id="plaid-connections-description" className="text-sm text-slate-600">
            Manage your connected bank accounts and sync transactions
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : plaidItems.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">No Plaid Connections</h3>
                    <p className="text-xs text-slate-600 mb-4">
                      Connect your bank account to test Plaid integration
                    </p>
                    <PlaidLinkButton
                      userId={user?.id}
                      onSuccess={handlePlaidSuccess}
                    >
                      Connect Bank Account
                    </PlaidLinkButton>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-600">
                  {plaidItems.length} {plaidItems.length === 1 ? 'connection' : 'connections'} found
                </p>
                <PlaidLinkButton
                  userId={user?.id}
                  onSuccess={handlePlaidSuccess}
                >
                  Add Another
                </PlaidLinkButton>
              </div>

              {plaidItems.map((item) => {
                const isSyncing = syncingItems.has(item.item_id);
                const lastSynced = item.last_synced_at
                  ? format(new Date(item.last_synced_at), 'MMM d, yyyy h:mm a')
                  : 'Never';

                return (
                  <Card key={item.id} className="border-slate-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 bg-sky-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-sky-blue" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-semibold truncate">
                              {item.institution_name}
                            </CardTitle>
                            <p className="text-xs text-slate-500 mt-1">
                              Item ID: {item.item_id.substring(0, 20)}...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {item.status === 'active' ? (
                            <CheckCircle2 className="w-4 h-4 text-soft-green" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-orange" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">Last synced:</span>
                        <span className="font-medium">{lastSynced}</span>
                      </div>

                      <Button
                        onClick={() => handleSync(item.item_id, item.institution_name)}
                        disabled={isSyncing}
                        className="w-full"
                        size="sm"
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Test Sync
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
