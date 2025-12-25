import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import TypeDetailSelector from '@/components/common/TypeDetailSelector';
import { validateAmount } from '../utils/validation';
import { DollarSign, Loader2 } from 'lucide-react';

export default function SimpleAccountCreationDialog({ open, onOpenChange, onAccountCreated }) {
  const [formData, setFormData] = useState({
    account_name: '',
    account_type: null,
    account_detail: null,
    current_balance: '',
    institution_name: '',
    account_number_last4: ''
  });

  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const resetForm = () => {
    setFormData({
      account_name: '',
      account_type: null,
      account_detail: null,
      current_balance: '',
      institution_name: '',
      account_number_last4: ''
    });
    setErrors({});
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.account_name?.trim()) {
      newErrors.account_name = 'Account name is required';
    }

    if (!formData.account_type) {
      newErrors.account_type = 'Account type is required';
    }

    if (!formData.account_detail) {
      newErrors.account_detail = 'Account detail is required';
    }

    const balanceValidation = validateAmount(formData.current_balance || '0', {
      allowZero: true,
      allowNegative: true
    });
    if (!balanceValidation.valid) {
      newErrors.current_balance = balanceValidation.error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createAccountMutation = useMutation({
    mutationFn: async (data) => {
      const accountNumber = Date.now().toString().slice(-6);

      return await firstsavvy.entities.Account.create({
        account_name: data.account_name,
        account_number: accountNumber,
        account_type: data.account_type,
        account_detail: data.account_detail,
        current_balance: data.current_balance,
        institution_name: data.institution_name || null,
        account_number_last4: data.account_number_last4 || null,
        is_active: true
      });
    },
    onSuccess: (newAccount) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['equity'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });

      toast.success('Account created successfully!');
      onAccountCreated?.(newAccount);
      handleOpenChange(false);

      setTimeout(() => {
        navigate(`/Banking/account/${newAccount.id}`);
      }, 100);
    },
    onError: (error) => {
      console.error('Error creating account:', error);
      toast.error(error.message || 'Failed to create account');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const balanceValidation = validateAmount(formData.current_balance || '0', {
      allowZero: true,
      allowNegative: true
    });

    createAccountMutation.mutate({
      ...formData,
      current_balance: balanceValidation.value
    });
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="account_name">
                Account Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) => updateFormData('account_name', e.target.value)}
                placeholder="e.g., Chase Checking"
                className="mt-1.5"
              />
              {errors.account_name && (
                <p className="text-xs text-red-600 mt-1">{errors.account_name}</p>
              )}
            </div>

            <TypeDetailSelector
              classFilter={null}
              accountType={formData.account_type}
              accountDetail={formData.account_detail}
              onTypeChange={(type) => updateFormData('account_type', type)}
              onDetailChange={(detail) => updateFormData('account_detail', detail)}
              typeLabel="Account Type"
              detailLabel="Account Detail"
              required
            />
            {errors.account_type && (
              <p className="text-xs text-red-600 mt-1">{errors.account_type}</p>
            )}
            {errors.account_detail && (
              <p className="text-xs text-red-600 mt-1">{errors.account_detail}</p>
            )}

            <div>
              <Label htmlFor="current_balance">Current Balance</Label>
              <div className="relative mt-1.5">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="current_balance"
                  type="text"
                  value={formData.current_balance}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9.-]/g, '');
                    updateFormData('current_balance', cleaned);
                  }}
                  placeholder="0.00"
                  className="pl-9"
                />
              </div>
              {errors.current_balance && (
                <p className="text-xs text-red-600 mt-1">{errors.current_balance}</p>
              )}
            </div>

            <div>
              <Label htmlFor="institution_name">Financial Institution (Optional)</Label>
              <Input
                id="institution_name"
                value={formData.institution_name}
                onChange={(e) => updateFormData('institution_name', e.target.value)}
                placeholder="e.g., Chase Bank"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="account_number_last4">Last 4 Digits (Optional)</Label>
              <Input
                id="account_number_last4"
                value={formData.account_number_last4}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                  updateFormData('account_number_last4', value);
                }}
                placeholder="1234"
                maxLength={4}
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createAccountMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createAccountMutation.isPending}
            >
              {createAccountMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
