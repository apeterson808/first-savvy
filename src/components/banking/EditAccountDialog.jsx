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

export default function EditAccountDialog({ open, onOpenChange, account, onSuccess }) {
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    if (account) {
      const isCategory = account.entityType === 'Income' || account.entityType === 'Expense';
      setFormData({
        name: isCategory ? account.name : account.account_name,
        institution: account.institution || '',
        current_balance: account.current_balance || 0,
        notes: account.notes || '',
        account_type: account.account_type || null,
        account_detail: account.account_detail || null
      });
    }
  }, [account]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      if (!account) return;

      const entityType = account.entityType || 'BankAccount';

      if (entityType === 'BankAccount' || entityType === 'CreditCard') {
        return await firstsavvy.entities.Account.update(account.id, {
          account_name: data.name,
          institution: data.institution,
          current_balance: parseFloat(data.current_balance) || 0,
          notes: data.notes,
          account_type: data.account_type || null,
          account_detail: data.account_detail || null
        });
      } else if (entityType === 'Asset') {
        return await firstsavvy.entities.Asset.update(account.id, {
          name: data.name,
          institution: data.institution,
          current_balance: parseFloat(data.current_balance) || 0,
          notes: data.notes,
          account_type: data.account_type || null,
          account_detail: data.account_detail || null
        });
      } else if (entityType === 'Liability') {
        return await firstsavvy.entities.Liability.update(account.id, {
          name: data.name,
          institution: data.institution,
          current_balance: parseFloat(data.current_balance) || 0,
          notes: data.notes,
          account_type: data.account_type || null,
          account_detail: data.account_detail || null
        });
      } else if (entityType === 'Equity') {
        return await firstsavvy.entities.Equity.update(account.id, {
          name: data.name,
          current_balance: parseFloat(data.current_balance) || 0,
          notes: data.notes,
          account_type: data.account_type || null,
          account_detail: data.account_detail || null
        });
      } else if (entityType === 'Income' || entityType === 'Expense') {
        return await firstsavvy.entities.Category.update(account.id, {
          name: data.name,
          notes: data.notes
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['equity'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit {account?.account_name || account?.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isCategory ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter name"
                />
              </div>

              <div>
                <Label htmlFor="account_type">Type</Label>
                <TypeDetailSelector
                  classFilter={account?.entityType === 'Asset' ? 'asset' : account?.entityType === 'Liability' ? 'liability' : 'equity'}
                  accountType={formData.account_type}
                  accountDetail={formData.account_detail}
                  onTypeChange={(type) => setFormData({ ...formData, account_type: type })}
                  onDetailChange={(detail) => setFormData({ ...formData, account_detail: detail })}
                  showTypeOnly
                  inline
                />
              </div>

              <div>
                <Label htmlFor="account_detail">Detail</Label>
                <TypeDetailSelector
                  classFilter={account?.entityType === 'Asset' ? 'asset' : account?.entityType === 'Liability' ? 'liability' : 'equity'}
                  accountType={formData.account_type}
                  accountDetail={formData.account_detail}
                  onTypeChange={(type) => setFormData({ ...formData, account_type: type })}
                  onDetailChange={(detail) => setFormData({ ...formData, account_detail: detail })}
                  showDetailOnly
                  inline
                />
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter name"
              />
            </div>
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
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={formData.current_balance || ''}
                onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
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
