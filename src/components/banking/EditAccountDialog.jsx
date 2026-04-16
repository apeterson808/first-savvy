import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import TypeDetailSelector from '@/components/common/TypeDetailSelector';
import { validateAmount } from '../utils/validation';
import { withRetry, showErrorToast, logError } from '../utils/errorHandler';
import { toast } from 'sonner';
import { getAccountDisplayName } from '../utils/constants';
import CalculatorAmountInput from '@/components/common/CalculatorAmountInput';
import { Switch } from '@/components/ui/switch';

export default function EditAccountDialog({ open, onOpenChange, account, onSuccess }) {
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    if (account) {
      setFormData({
        name: getAccountDisplayName(account),
        institution: account.institution_name || account.institution || '',
        current_balance: account.current_balance || 0,
        notes: account.notes || '',
        account_type: account.account_type || null,
        account_detail: account.account_detail || null,
        include_in_net_worth: account.include_in_net_worth !== false,
        include_in_cash_balance: account.include_in_cash_balance || false
      });
    }
  }, [account]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      if (!account) return;

      return await firstsavvy.entities.ChartAccount.update(account.id, {
        display_name: data.name,
        institution_name: data.institution || null,
        current_balance: parseFloat(data.current_balance) || 0,
        notes: data.notes || null,
        account_type: data.account_type || null,
        account_detail: data.account_detail || null,
        include_in_net_worth: data.include_in_net_worth,
        include_in_cash_balance: data.include_in_cash_balance
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      toast.success('Account updated successfully');
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      showErrorToast('Failed to update account', error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toast.error('Name is required');
      return;
    }

    updateMutation.mutate(formData);
  };

  const isCategory = account?.entityType === 'Income' || account?.entityType === 'Expense';
  const showInstitution = !isCategory && account?.entityType !== 'Equity';
  const showBalance = !isCategory;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit {getAccountDisplayName(account)}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter name"
            />
          </div>

          {!isCategory && (
            <TypeDetailSelector
              classFilter={account?.entityType === 'Asset' ? 'asset' : account?.entityType === 'Liability' ? 'liability' : 'equity'}
              accountType={formData.account_type}
              accountDetail={formData.account_detail}
              onTypeChange={(type) => setFormData({ ...formData, account_type: type })}
              onDetailChange={(detail) => setFormData({ ...formData, account_detail: detail })}
              typeLabel="Account Type"
              detailLabel="Account Detail"
            />
          )}

          {showInstitution && (
            <div>
              <Label htmlFor="institution">Institution (optional)</Label>
              <Input
                id="institution"
                value={formData.institution || ''}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder="Enter institution"
              />
            </div>
          )}

          {showBalance && (
            <div>
              <Label htmlFor="balance">Current Balance</Label>
              <CalculatorAmountInput
                value={parseFloat(formData.current_balance) || 0}
                onChange={(value) => setFormData({ ...formData, current_balance: value })}
                placeholder="0.00"
              />
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Enter notes"
            />
          </div>

          {showBalance && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="include-net-worth" className="text-sm font-medium">Include in Net Worth</Label>
                  <p className="text-xs text-slate-500">Include this account in net worth calculations</p>
                </div>
                <Switch
                  id="include-net-worth"
                  checked={formData.include_in_net_worth}
                  onCheckedChange={(checked) => setFormData({ ...formData, include_in_net_worth: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="include-cash-balance" className="text-sm font-medium">Include in Cash Balance</Label>
                  <p className="text-xs text-slate-500">Include this account in cash balance chart</p>
                </div>
                <Switch
                  id="include-cash-balance"
                  checked={formData.include_in_cash_balance}
                  onCheckedChange={(checked) => setFormData({ ...formData, include_in_cash_balance: checked })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
