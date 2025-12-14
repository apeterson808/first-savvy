import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_DETAIL_TYPES } from '../utils/constants';
import { Plus, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function PlaidAccountReviewDialog({ 
  open, 
  onOpenChange, 
  discoveredAccounts, 
  transactionsByAccount,
  onComplete 
}) {
  const [accountMappings, setAccountMappings] = useState([]);
  const queryClient = useQueryClient();

  const { data: existingAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true })
  });

  React.useEffect(() => {
    if (discoveredAccounts && open) {
      const defaultGoLive = new Date().toISOString().split('T')[0];
      const defaultImportStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      setAccountMappings(discoveredAccounts.map(acc => ({ 
        target_account_id: 'add_new',
        ...acc,
        account_type: acc.type === 'credit_card' ? 'credit_card' : 'bank',
        detail_type: acc.type,
        go_live_date: defaultGoLive,
        import_start_date: defaultImportStart,
        include: true
      })));
    }
  }, [discoveredAccounts, open]);

  const importMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('plaidCompleteImport', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onComplete?.();
      onOpenChange(false);
    },
    onError: (error) => {
      alert(`Import failed: ${error.message}`);
    }
  });

  const handleImport = () => {
    importMutation.mutate({
      account_mappings: accountMappings
        .filter(m => m.include)
        .map((m, i) => ({
          ...m,
          plaid_account_id: discoveredAccounts[i].plaid_account_id,
          action: m.target_account_id === 'add_new' ? 'create_new' : 'merge_existing',
          existing_account_id: m.target_account_id !== 'add_new' ? m.target_account_id : undefined
        })),
      transactions_by_account: transactionsByAccount
    });
  };

  if (!discoveredAccounts || discoveredAccounts.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Discovered Accounts</DialogTitle>
          <p className="text-sm text-slate-600">Choose what to do with each account and configure import settings</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {discoveredAccounts.map((account, index) => {
            const mapping = accountMappings[index] || { 
              target_account_id: 'add_new',
              ...account,
              account_type: account.type === 'credit_card' ? 'credit_card' : 'bank',
              detail_type: account.type,
              go_live_date: new Date().toISOString().split('T')[0],
              import_start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              include: true
            };
            const isAddNew = mapping.target_account_id === 'add_new';
            const isIncluded = mapping.include !== false;
            
            return (
              <div key={account.plaid_account_id} className={`p-4 rounded-lg border space-y-3 ${isIncluded ? 'bg-slate-50 border-slate-200' : 'bg-slate-100 border-slate-300 opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isIncluded}
                    onCheckedChange={(checked) => {
                      const newMappings = [...accountMappings];
                      newMappings[index] = { ...mapping, include: checked };
                      setAccountMappings(newMappings);
                    }}
                  />
                  <div className="flex-1 flex items-center justify-between gap-3">
                    <div className="flex flex-col justify-center">
                      <div className="font-medium text-slate-900">{account.name}</div>
                      <div className="text-sm text-slate-600">
                        {account.type.replace('_', ' ')} • {account.mask ? `••${account.mask}` : ''} • ${account.balance.toLocaleString()}
                      </div>
                    </div>
                    {isAddNew && (
                      <div className="flex items-center gap-2">
                        <div>
                          <Label className="text-[10px] mb-0.5 block text-slate-500">Account Type</Label>
                          <ClickThroughSelect
                            value={mapping.account_type || 'bank'}
                            onValueChange={(val) => {
                              const newMappings = [...accountMappings];
                              newMappings[index] = { 
                                ...mapping, 
                                account_type: val,
                                detail_type: val === 'credit_card' ? 'credit_card' : (val === 'bank' ? 'checking' : '')
                              };
                              setAccountMappings(newMappings);
                            }}
                            triggerClassName="h-7 text-xs hover:bg-slate-50 w-28"
                            disabled={!isIncluded}
                          >
                            <ClickThroughSelectItem value="add_new">
                              <div className="flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                <span>Add New</span>
                              </div>
                            </ClickThroughSelectItem>
                            <ClickThroughSelectItem value="bank">Bank</ClickThroughSelectItem>
                            <ClickThroughSelectItem value="credit_card">Credit Card</ClickThroughSelectItem>
                            <ClickThroughSelectItem value="asset">Asset</ClickThroughSelectItem>
                            <ClickThroughSelectItem value="liability">Liability</ClickThroughSelectItem>
                          </ClickThroughSelect>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-0.5 block text-slate-500">Detail</Label>
                          <ClickThroughSelect
                            value={mapping.detail_type || ''}
                            onValueChange={(val) => {
                              const newMappings = [...accountMappings];
                              newMappings[index] = { ...mapping, detail_type: val };
                              setAccountMappings(newMappings);
                            }}
                            triggerClassName="h-7 text-xs hover:bg-slate-50 w-28"
                            disabled={!isIncluded}
                          >
                            <ClickThroughSelectItem value="add_new">
                              <div className="flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                <span>Add New</span>
                              </div>
                            </ClickThroughSelectItem>
                            {(DEFAULT_DETAIL_TYPES[mapping.account_type || 'bank'] || []).map(dt => (
                              <ClickThroughSelectItem key={dt.value} value={dt.value}>
                                {dt.label}
                              </ClickThroughSelectItem>
                            ))}
                          </ClickThroughSelect>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 h-[18px]">
                            <Label htmlFor={`import-start-${index}`} className="text-[10px]">Import From</Label>
                          </div>
                          <Input
                            id={`import-start-${index}`}
                            type="date"
                            value={mapping.import_start_date || ''}
                            onChange={(e) => {
                              const newMappings = [...accountMappings];
                              newMappings[index] = { ...mapping, import_start_date: e.target.value };
                              setAccountMappings(newMappings);
                            }}
                            className="h-7 text-xs w-36 px-2"
                            disabled={!isIncluded}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 h-[18px]">
                            <Label htmlFor={`go-live-${index}`} className="text-[10px]">Go-Live Date</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3 h-3 text-slate-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="text-xs">
                                    <div className="font-medium mb-1">How it works:</div>
                                    <div>• Transactions <strong>before</strong> go-live: Auto-posted as historical</div>
                                    <div>• Transactions <strong>after</strong> go-live: Pending for review</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id={`go-live-${index}`}
                            type="date"
                            value={mapping.go_live_date || ''}
                            onChange={(e) => {
                              const newMappings = [...accountMappings];
                              newMappings[index] = { ...mapping, go_live_date: e.target.value };
                              setAccountMappings(newMappings);
                            }}
                            className="h-7 text-xs w-36 px-2"
                            disabled={!isIncluded}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>




              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {importMutation.isPending ? 'Importing...' : 'Import Selected Accounts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}