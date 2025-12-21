import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import PlaidLinkButton from './PlaidLinkButton';
import { validateAmount } from '../utils/validation';
import { withRetry, showErrorToast, logError } from '../utils/errorHandler';
import { DEFAULT_DETAIL_TYPES, getDetailTypeDisplayName } from '../utils/constants';

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'equity', label: 'Equity' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'liability', label: 'Liability' },
];

export default function AddFinancialAccountSheet({
  open,
  onOpenChange,
  onAccountCreated,
  editingAccount,
  mode = 'all',
  hideLinkAccount = false,
  sortColumn = 'name',
  sortDirection = 'asc',
  initialCategoryName = '',
  initialAccountType = null
}) {
  const [formData, setFormData] = useState({
    name: '',
    accountType: '',
    detailType: '',
    balance: '',
    startDate: '',
    bankName: '',
    institutionLogoUrl: '',
    accountNumber: '',
    description: '',
    isSubaccount: false,
    parentAccountId: '',
    isActive: true,
  });

  const [showManualForm, setShowManualForm] = useState(false);
  const [plaidActive, setPlaidActive] = useState(false);

  const queryClient = useQueryClient();

  const { data: existingAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => firstsavvy.entities.BankAccount.filter({ is_active: true })
  });

  const { data: existingCreditCards = [] } = useQuery({
    queryKey: ['creditCards'],
    queryFn: () => firstsavvy.entities.CreditCard.filter({ is_active: true })
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => firstsavvy.entities.Category.list('name')
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => firstsavvy.entities.Asset.list('name')
  });

  const { data: liabilities = [] } = useQuery({
    queryKey: ['liabilities'],
    queryFn: () => firstsavvy.entities.Liability.list('name')
  });

  const { data: equityAccounts = [] } = useQuery({
    queryKey: ['equity'],
    queryFn: () => firstsavvy.entities.Equity.list('name')
  });

  const getDetailTypesForAccountType = (accType) => {
    if (!accType) return [];
    return DEFAULT_DETAIL_TYPES[accType] || [];
  };

  useEffect(() => {
    if (formData.accountType === 'income' || formData.accountType === 'expense') {
      setFormData(prev => ({ ...prev, detailType: prev.accountType }));
    } else if (formData.accountType === 'credit_card') {
      setFormData(prev => ({ ...prev, detailType: 'credit_card' }));
    }
  }, [formData.accountType]);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    if (editingAccount) {
      populateEditForm(editingAccount);
    } else {
      const newFormData = {
        name: initialCategoryName || '',
        accountType: initialAccountType || '',
        detailType: '',
        balance: '',
        startDate: '',
        bankName: '',
        institutionLogoUrl: '',
        accountNumber: '',
        description: '',
        isSubaccount: false,
        parentAccountId: '',
        isActive: true,
      };
      setFormData(newFormData);
      setShowManualForm(mode === 'category');
    }
  }, [open, editingAccount, initialCategoryName, initialAccountType, mode]);

  const resetForm = () => {
    setFormData({
      name: '',
      accountType: '',
      detailType: '',
      balance: '',
      startDate: '',
      bankName: '',
      institutionLogoUrl: '',
      accountNumber: '',
      description: '',
      isSubaccount: false,
      parentAccountId: '',
      isActive: true,
    });
    setShowManualForm(false);
  };

  const populateEditForm = (account) => {
    const entityType = account.entityType;
    let accountType = '';
    let detailType = '';
    let bankName = '';
    let logoUrl = '';
    let accountNum = '';

    if (entityType === 'BankAccount') {
      accountType = 'bank';
      detailType = account.account_type || '';
      bankName = account.bank_name || account.institution || '';
      logoUrl = account.logo_url || '';
    } else if (entityType === 'CreditCard') {
      accountType = 'credit_card';
      detailType = 'credit_card';
      bankName = account.institution || '';
      logoUrl = account.institution_logo_url || '';
      accountNum = account.account_number_masked || account.last_four || '';
    } else if (entityType === 'Asset') {
      accountType = 'asset';
      detailType = account.type || account.account_type || '';
      bankName = account.institution || '';
      logoUrl = account.logo_url || '';
    } else if (entityType === 'Liability') {
      accountType = 'liability';
      detailType = account.type || account.account_type || '';
      bankName = account.institution || '';
      logoUrl = account.logo_url || '';
    } else if (entityType === 'Equity') {
      accountType = 'equity';
      detailType = account.type || account.account_type || '';
      bankName = account.institution || '';
      logoUrl = account.logo_url || '';
    } else if (entityType === 'Income') {
      accountType = 'income';
      detailType = account.detail_type || 'salary';
    } else if (entityType === 'Expense') {
      accountType = 'expense';
      detailType = account.detail_type || 'other_expenses';
    }

    setFormData({
      name: account.account_name || account.name || '',
      accountType,
      detailType,
      balance: String(Math.abs(account.current_balance || account.current_value || 0)),
      startDate: account.start_date || '',
      bankName,
      institutionLogoUrl: logoUrl,
      accountNumber: entityType !== 'CreditCard' ? (account.account_number || '') : accountNum,
      description: account.description || '',
      isSubaccount: !!account.parent_account_id,
      parentAccountId: account.parent_account_id || '',
      isActive: account.is_active !== false,
    });
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createBankAccountMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.BankAccount.create(data)),
    onSuccess: (newAccount) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      onAccountCreated?.({ type: 'bank', account: newAccount });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'createBankAccount' });
      showErrorToast(error);
    }
  });

  const createCreditCardMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.CreditCard.create(data)),
    onSuccess: (newAccount) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['creditCards'] });
      onAccountCreated?.({ type: 'credit_card', account: newAccount });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'createCreditCard' });
      showErrorToast(error);
    }
  });

  const createAssetMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.Asset.create(data)),
    onSuccess: (newAsset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onAccountCreated?.({ type: 'asset', account: newAsset });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'createAsset' });
      showErrorToast(error);
    }
  });

  const createLiabilityMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.Liability.create(data)),
    onSuccess: (newLiability) => {
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      onAccountCreated?.({ type: 'liability', account: newLiability });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'createLiability' });
      showErrorToast(error);
    }
  });

  const createEquityMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.Equity.create(data)),
    onSuccess: (newEquity) => {
      queryClient.invalidateQueries({ queryKey: ['equity'] });
      onAccountCreated?.({ type: 'equity', account: newEquity });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'createEquity' });
      showErrorToast(error);
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.Category.create(data)),
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onAccountCreated?.({ type: formData.accountType, account: newCategory });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'createCategory' });
      showErrorToast(error);
    }
  });

  const updateBankAccountMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => firstsavvy.entities.BankAccount.update(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      onAccountCreated?.({ type: 'bank' });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'updateBankAccount' });
      showErrorToast(error);
    }
  });

  const updateCreditCardMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => firstsavvy.entities.CreditCard.update(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['creditCards'] });
      onAccountCreated?.({ type: 'credit_card' });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'updateCreditCard' });
      showErrorToast(error);
    }
  });

  const updateAssetMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => firstsavvy.entities.Asset.update(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onAccountCreated?.({ type: 'asset' });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'updateAsset' });
      showErrorToast(error);
    }
  });

  const updateLiabilityMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => firstsavvy.entities.Liability.update(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      onAccountCreated?.({ type: 'liability' });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'updateLiability' });
      showErrorToast(error);
    }
  });

  const updateEquityMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => firstsavvy.entities.Equity.update(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equity'] });
      onAccountCreated?.({ type: 'equity' });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'updateEquity' });
      showErrorToast(error);
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => firstsavvy.entities.Category.update(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'updateCategory' });
      showErrorToast(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.accountType || !formData.detailType || !formData.name) {
      return;
    }

    let validatedBalance = 0;
    if (formData.balance && formData.balance.trim() !== '') {
      const balanceValidation = validateAmount(formData.balance, { allowZero: true });
      if (!balanceValidation.valid) {
        alert(balanceValidation.error);
        return;
      }
      validatedBalance = balanceValidation.value;
    }

    const capitalizedName = formData.name.charAt(0).toUpperCase() + formData.name.slice(1);

    if (editingAccount) {
      handleUpdate(editingAccount.id, validatedBalance);
    } else {
      handleCreate(capitalizedName, validatedBalance);
    }
  };

  const handleCreate = async (capitalizedName, validatedBalance) => {
    const baseData = {
      name: capitalizedName,
      is_active: true,
    };

    if (formData.isSubaccount && formData.parentAccountId) {
      baseData.parent_account_id = formData.parentAccountId;
    }

    let accountNumber = formData.accountNumber;
    if (formData.accountType === 'bank' || formData.accountType === 'credit_card') {
      if (!accountNumber || accountNumber.trim() === '') {
        const existingAccounts = await firstsavvy.entities.Account.list();
        const existingAccountNumbers = existingAccounts
          .map(acc => parseInt(acc.account_number))
          .filter(num => !isNaN(num));
        const nextAccountNumber = existingAccountNumbers.length > 0
          ? Math.max(...existingAccountNumbers) + 1
          : 1001;
        accountNumber = nextAccountNumber.toString();
      }
    }

    switch (formData.accountType) {
      case 'bank':
        createBankAccountMutation.mutate({
          ...baseData,
          account_name: capitalizedName,
          account_number: accountNumber,
          account_type: formData.detailType,
          balance: validatedBalance,
          institution_name: formData.bankName,
          account_number_last4: formData.accountNumber ? formData.accountNumber.slice(-4) : undefined,
        });
        break;

      case 'credit_card':
        createCreditCardMutation.mutate({
          ...baseData,
          account_name: capitalizedName,
          account_number: accountNumber,
          account_type: 'credit_card',
          balance: validatedBalance,
          institution_name: formData.bankName || null,
          account_number_last4: formData.accountNumber ? formData.accountNumber.slice(-4) : undefined,
        });
        break;

      case 'asset':
        createAssetMutation.mutate({
          ...baseData,
          type: formData.detailType,
          current_value: validatedBalance,
          description: formData.description,
          institution: formData.bankName,
          logo_url: formData.institutionLogoUrl || null,
        });
        break;

      case 'liability':
        createLiabilityMutation.mutate({
          ...baseData,
          type: formData.detailType,
          current_balance: validatedBalance,
          institution: formData.bankName,
          logo_url: formData.institutionLogoUrl || null,
        });
        break;

      case 'equity':
        createEquityMutation.mutate({
          ...baseData,
          type: formData.detailType,
          current_balance: validatedBalance,
          institution: formData.bankName,
          logo_url: formData.institutionLogoUrl || null,
        });
        break;

      case 'income':
      case 'expense':
        createCategoryMutation.mutate({
          name: capitalizedName,
          type: formData.accountType,
          detail_type: formData.accountType,
          parent_account_id: formData.isSubaccount && formData.parentAccountId ? formData.parentAccountId : undefined,
        });
        break;
    }
  };

  const handleUpdate = (id, validatedBalance) => {
    const baseData = {
      is_active: formData.isActive,
    };

    if (formData.isSubaccount && formData.parentAccountId) {
      baseData.parent_account_id = formData.parentAccountId;
    } else {
      baseData.parent_account_id = null;
    }

    switch (formData.accountType) {
      case 'bank':
        updateBankAccountMutation.mutate({
          id,
          data: {
            ...baseData,
            account_name: formData.name,
            account_number: formData.accountNumber,
            account_type: formData.detailType,
            balance: validatedBalance,
            institution_name: formData.bankName,
          }
        });
        break;

      case 'credit_card':
        updateCreditCardMutation.mutate({
          id,
          data: {
            ...baseData,
            account_name: formData.name,
            account_number: formData.accountNumber,
            account_type: 'credit_card',
            balance: validatedBalance,
            institution_name: formData.bankName || null,
            account_number_last4: formData.accountNumber ? formData.accountNumber.slice(-4) : undefined,
          }
        });
        break;

      case 'asset':
        updateAssetMutation.mutate({
          id,
          data: {
            ...baseData,
            name: formData.name,
            type: formData.detailType,
            current_value: validatedBalance,
            description: formData.description,
            institution: formData.bankName,
            logo_url: formData.institutionLogoUrl || null,
          }
        });
        break;

      case 'liability':
        updateLiabilityMutation.mutate({
          id,
          data: {
            ...baseData,
            name: formData.name,
            type: formData.detailType,
            current_balance: validatedBalance,
            institution: formData.bankName,
            logo_url: formData.institutionLogoUrl || null,
          }
        });
        break;

      case 'equity':
        updateEquityMutation.mutate({
          id,
          data: {
            ...baseData,
            name: formData.name,
            type: formData.detailType,
            current_balance: validatedBalance,
            institution: formData.bankName,
            logo_url: formData.institutionLogoUrl || null,
          }
        });
        break;

      case 'income':
      case 'expense':
        updateCategoryMutation.mutate({
          id,
          data: {
            name: formData.name,
            type: formData.accountType,
            detail_type: formData.accountType,
            is_active: formData.isActive
          }
        });
        break;
    }
  };

  const isLoading =
    createBankAccountMutation.isPending ||
    createCreditCardMutation.isPending ||
    createAssetMutation.isPending ||
    createLiabilityMutation.isPending ||
    createEquityMutation.isPending ||
    createCategoryMutation.isPending ||
    updateBankAccountMutation.isPending ||
    updateCreditCardMutation.isPending ||
    updateAssetMutation.isPending ||
    updateLiabilityMutation.isPending ||
    updateEquityMutation.isPending ||
    updateCategoryMutation.isPending;

  const isCategory = mode === 'category';
  const entityLabel = isCategory ? 'Category' : 'Account';

  const getBalanceLabel = () => {
    if (formData.accountType === 'asset') return 'Beginning Value';
    if (formData.accountType === 'liability' || formData.accountType === 'credit_card' || formData.accountType === 'equity') return 'Beginning Balance';
    return 'Beginning Balance';
  };

  const showBalanceField = ['bank', 'credit_card', 'asset', 'liability', 'equity'].includes(formData.accountType);
  const showInstitutionFields = ['bank', 'credit_card', 'asset', 'liability', 'equity'].includes(formData.accountType);

  return (
    <>
      {plaidActive && (
        <style>{`
          #plaid-link-iframe-1,
          [id^="plaid-link-iframe"] {
            z-index: 9999 !important;
          }
        `}</style>
      )}

      <Sheet open={open} onOpenChange={(newOpen) => {
        if (!newOpen && plaidActive) return;
        onOpenChange(newOpen);
      }}>
        <SheetContent className="overflow-y-auto sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>
              {editingAccount ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
            </SheetTitle>
          </SheetHeader>

          {!showManualForm && !editingAccount && !hideLinkAccount ? (
            <div className="py-6 flex flex-col gap-3">
              <PlaidLinkButton
                onLinkStart={() => onOpenChange(false)}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['accounts'] });
                  queryClient.invalidateQueries({ queryKey: ['transactions'] });
                }}
                onPlaidStateChange={(active) => {
                  setPlaidActive(active);
                  if (active) onOpenChange(false);
                }}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Link Account
              </PlaidLinkButton>
              <Button
                onClick={() => setShowManualForm(true)}
                variant="outline"
                className="w-full h-12"
              >
                Add Manually
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">{isCategory ? 'Category Name*' : 'Account Name*'}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateFormField('name', e.target.value)}
                  placeholder={isCategory ? "e.g., Groceries, Rent, Salary" : "e.g., Chase Checking"}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="accountType">{entityLabel} Type*</Label>
                  <ClickThroughSelect
                    value={formData.accountType}
                    onValueChange={(val) => {
                      updateFormField('accountType', val);
                      if (val === 'income' || val === 'expense') {
                        updateFormField('detailType', val);
                      } else if (val === 'credit_card') {
                        updateFormField('detailType', 'credit_card');
                      } else {
                        updateFormField('detailType', '');
                      }
                    }}
                    placeholder="Select type"
                    triggerClassName="hover:bg-slate-50"
                  >
                    {ACCOUNT_TYPES
                      .filter(type => mode === 'all' || (mode === 'category' && (type.value === 'income' || type.value === 'expense')))
                      .map(type => (
                        <ClickThroughSelectItem key={type.value} value={type.value}>
                          {type.label}
                        </ClickThroughSelectItem>
                      ))}
                  </ClickThroughSelect>
                </div>

                {formData.accountType !== 'income' && formData.accountType !== 'expense' && (
                  <div>
                    <Label htmlFor="detailType">Detail Type*</Label>
                    <ClickThroughSelect
                      key={formData.accountType}
                      value={formData.detailType}
                      onValueChange={(val) => updateFormField('detailType', val)}
                      placeholder="Select detail type"
                      triggerClassName="hover:bg-slate-50"
                    >
                      {formData.accountType && getDetailTypesForAccountType(formData.accountType).map(type => (
                        <ClickThroughSelectItem key={type.value} value={type.value}>
                          {type.label}
                        </ClickThroughSelectItem>
                      ))}
                    </ClickThroughSelect>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isSubaccount"
                    checked={formData.isSubaccount}
                    onCheckedChange={(checked) => updateFormField('isSubaccount', checked)}
                  />
                  <Label htmlFor="isSubaccount" className="text-sm font-normal cursor-pointer">
                    Is sub-account
                  </Label>
                </div>

                {formData.isSubaccount && (
                  <div>
                    <Label htmlFor="parentAccount">Parent Account*</Label>
                    <ClickThroughSelect
                      value={formData.parentAccountId}
                      onValueChange={(val) => updateFormField('parentAccountId', val)}
                      placeholder="Select parent account"
                      triggerClassName="hover:bg-slate-50"
                    >
                      {formData.accountType === 'bank' && existingAccounts.filter(acc => !acc.parent_account_id).map(acc => (
                        <ClickThroughSelectItem key={acc.id} value={acc.id}>
                          {acc.account_name}{acc.account_number ? ` (${acc.account_number})` : ''}
                        </ClickThroughSelectItem>
                      ))}
                      {formData.accountType === 'credit_card' && existingCreditCards.filter(cc => cc.id !== editingAccount?.id).map(cc => (
                        <ClickThroughSelectItem key={cc.id} value={cc.id}>
                          {cc.name}{cc.last_four ? ` (${cc.last_four})` : ''}
                        </ClickThroughSelectItem>
                      ))}
                      {formData.accountType === 'asset' && assets.filter(a => !a.parent_account_id).map(asset => (
                        <ClickThroughSelectItem key={asset.id} value={asset.id}>
                          {asset.name}
                        </ClickThroughSelectItem>
                      ))}
                      {formData.accountType === 'liability' && liabilities.filter(l => !l.parent_account_id).map(liability => (
                        <ClickThroughSelectItem key={liability.id} value={liability.id}>
                          {liability.name}
                        </ClickThroughSelectItem>
                      ))}
                      {formData.accountType === 'equity' && equityAccounts.filter(e => !e.parent_account_id).map(equity => (
                        <ClickThroughSelectItem key={equity.id} value={equity.id}>
                          {equity.name}
                        </ClickThroughSelectItem>
                      ))}
                      {formData.accountType === 'income' && categories.filter(c => c.type === 'income' && !c.parent_account_id).map(cat => (
                        <ClickThroughSelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </ClickThroughSelectItem>
                      ))}
                      {formData.accountType === 'expense' && categories.filter(c => c.type === 'expense' && !c.parent_account_id).map(cat => (
                        <ClickThroughSelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </ClickThroughSelectItem>
                      ))}
                    </ClickThroughSelect>
                  </div>
                )}
              </div>

              {showBalanceField && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="balance">{getBalanceLabel()}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                      <Input
                        id="balance"
                        type="text"
                        value={formData.balance}
                        onChange={(e) => updateFormField('balance', e.target.value.replace(/[^0-9.]/g, ''))}
                        onBlur={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          if (val) {
                            updateFormField('balance', parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                          }
                        }}
                        onFocus={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          updateFormField('balance', val);
                        }}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => updateFormField('startDate', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {showInstitutionFields && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bankName">Institution Name</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => updateFormField('bankName', e.target.value)}
                      placeholder="e.g. Chase, Schwab"
                    />
                  </div>
                  <div>
                    <Label htmlFor="institutionLogo">Logo URL</Label>
                    <Input
                      id="institutionLogo"
                      value={formData.institutionLogoUrl}
                      onChange={(e) => updateFormField('institutionLogoUrl', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Additional details..."
                />
              </div>

              {editingAccount && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => updateFormField('isActive', checked)}
                  />
                  <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
                    Active account
                  </Label>
                  {!formData.isActive && (
                    <span className="text-xs text-slate-500">(Excluded from all calculations)</span>
                  )}
                </div>
              )}

              <SheetFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!formData.accountType || !formData.detailType || !formData.name || isLoading || (formData.isSubaccount && !formData.parentAccountId)}
                >
                  Save
                </Button>
              </SheetFooter>

              {formData.name && formData.accountType && (
                <div className="mt-4">
                  <div className="flex items-center justify-end mb-2">
                    <span className="text-[10px] px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">PREVIEW</span>
                  </div>
                  <div className="bg-white border rounded-md text-xs">
                    <div className="p-3 bg-blue-100 border-l-2 border-l-blue-500 font-medium text-slate-900">
                      {formData.name}
                      {formData.accountNumber && ` (${formData.accountNumber})`}
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
