import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Link2, Search, Building2, TrendingUp, Bitcoin, Upload, FlaskConical } from 'lucide-react';
import PlaidImportSimulator from './PlaidImportSimulator';
import FileImporter from './FileImporter';
import PlaidLinkButton from './PlaidLinkButton';
import PlaidAccountReviewDialog from './PlaidAccountReviewDialog';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';

const POPULAR_INSTITUTIONS = [
  { name: 'Chase', color: 'bg-blue-600' },
  { name: 'Bank of America', color: 'bg-red-600' },
  { name: 'Wells Fargo', color: 'bg-red-500' },
  { name: 'Capital One', color: 'bg-blue-700' },
  { name: 'Citi', color: 'bg-blue-500' },
  { name: 'American Express', color: 'bg-blue-600' },
  { name: 'US Bank', color: 'bg-red-600' },
  { name: 'Charles Schwab', color: 'bg-blue-500' },
  { name: 'Fidelity', color: 'bg-green-600' },
  { name: 'Vanguard', color: 'bg-red-700' },
  { name: 'Discover', color: 'bg-orange-600' },
  { name: 'Navy Federal', color: 'bg-blue-900' },
];

import { validateAmount } from '../utils/validation';
import { withRetry, showErrorToast, logError } from '../utils/errorHandler';
import { DEFAULT_DETAIL_TYPES, getDetailTypeDisplayName } from '../utils/constants';

const COLOR_OPTIONS = [
  '#ef4444', '#f59e0b', '#22c55e', '#059669', '#3b82f6', '#2563eb', '#ec4899'
];

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset', plaidLinkable: false },
  { value: 'bank', label: 'Bank', plaidLinkable: true },
  { value: 'credit_card', label: 'Credit Card', plaidLinkable: true },
  { value: 'expense', label: 'Expense', plaidLinkable: false },
  { value: 'income', label: 'Income', plaidLinkable: false },
  { value: 'liability', label: 'Liability', plaidLinkable: true },
];

// Detail types that can be linked via Plaid
const PLAID_LINKABLE_DETAIL_TYPES = [
  'checking', 'savings', 'credit_card', 'business', // bank
  'mortgage', 'car_loan', 'student_loan', 'personal_loan' // liability
];

export default function AddFinancialAccountSheet({ open, onOpenChange, onAccountCreated, editingAccount, mode = 'all', hideLinkAccount = false, sortColumn = 'name', sortDirection = 'asc', initialCategoryName = '', externalPlaidReviewOpen, onPlaidReviewOpenChange, externalPlaidData, onPlaidDataChange }) {
  const [accountType, setAccountType] = useState('');
  const [detailType, setDetailType] = useState('');
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [description, setDescription] = useState('');
  const [balance, setBalance] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isSubaccount, setIsSubaccount] = useState(false);
  const [parentAccountId, setParentAccountId] = useState('');
  const [bankName, setBankName] = useState('');
  const [institutionLogoUrl, setInstitutionLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [plaidSimulatorOpen, setPlaidSimulatorOpen] = useState(false);
  const [fileImporterOpen, setFileImporterOpen] = useState(false);
  const [importedAccounts, setImportedAccounts] = useState([]);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const [importMode, setImportMode] = useState(null); // 'new' or 'existing'
  const [selectedExistingAccountId, setSelectedExistingAccountId] = useState('');
  const [plaidActive, setPlaidActive] = useState(false);


  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existingAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true })
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name')
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => base44.entities.Asset.list('name')
  });

  const { data: liabilities = [] } = useQuery({
    queryKey: ['liabilities'],
    queryFn: () => base44.entities.Liability.list('name')
  });

  const getDetailTypesForAccountType = (accType) => {
    if (!accType) return [];
    return DEFAULT_DETAIL_TYPES[accType] || [];
  };

  // Auto-set detail_type for Income and Expense accounts
  React.useEffect(() => {
    if (accountType === 'income' || accountType === 'expense') {
      setDetailType(accountType);
    }
  }, [accountType]);

  useEffect(() => {
    if (editingAccount) {
      // Populate form with editing account data
      const entityType = editingAccount.entityType;
      if (entityType === 'BankAccount') {
        setAccountType('bank');
        setDetailType(editingAccount.account_type || '');
        setBankName(editingAccount.bank_name || editingAccount.institution || '');
        setInstitutionLogoUrl(editingAccount.logo_url || '');
      } else if (entityType === 'CreditCard') {
        setAccountType('credit_card');
        setDetailType('credit_card');
        setBankName(editingAccount.bank_name || editingAccount.institution || '');
        setInstitutionLogoUrl(editingAccount.logo_url || '');
      } else if (entityType === 'Asset') {
        setAccountType('asset');
        setDetailType(editingAccount.type || editingAccount.account_type || '');
        setBankName(editingAccount.institution || '');
        setInstitutionLogoUrl(editingAccount.logo_url || '');
      } else if (entityType === 'Liability') {
        setAccountType('liability');
        setDetailType(editingAccount.type || editingAccount.account_type || '');
        setBankName(editingAccount.institution || '');
        setInstitutionLogoUrl(editingAccount.logo_url || '');
      } else if (entityType === 'Income') {
        setAccountType('income');
        setDetailType(editingAccount.detail_type || 'salary');
      } else if (entityType === 'Expense') {
        setAccountType('expense');
        setDetailType(editingAccount.detail_type || 'other_expenses');
      }
      setName(editingAccount.account_name || editingAccount.name || '');
      setAccountNumber(editingAccount.account_number || '');
      setDescription(editingAccount.description || '');
      setBalance(String(Math.abs(editingAccount.current_balance || editingAccount.current_value || 0)));
      setStartDate(editingAccount.start_date || '');
      setIsSubaccount(!!editingAccount.parent_account_id);
      setParentAccountId(editingAccount.parent_account_id || '');
      setIsActive(editingAccount.is_active !== false);
    } else {
      // Reset form when opening for new account
      setAccountType('');
      setDetailType('');
      setName(initialCategoryName || '');
      setAccountNumber('');
      setDescription('');
      setBalance('');
      setStartDate('');
      setIsSubaccount(false);
      setParentAccountId('');
      setBankName('');
      setInstitutionLogoUrl('');
      setIsActive(true);
      setShowManualForm(mode === 'category');
      }
      }, [open, editingAccount, initialCategoryName, mode]);

      // Detail type reset is now fully handled in the onChange handler

  const createBankAccountMutation = useMutation({
    mutationFn: (data) => {
      console.log('🏦 Creating BankAccount with data:', data);
      return withRetry(() => base44.entities.BankAccount.create(data), { maxRetries: 2 });
    },
    onSuccess: (newAccount) => {
      console.log('✅ BankAccount created successfully:', newAccount);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeBankAccounts'] });
      onAccountCreated?.({ type: 'bank', account: newAccount });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('❌ Error creating BankAccount:', error);
      logError(error, { action: 'createBankAccount' });
      showErrorToast(error);
    }
  });

  const createCreditCardMutation = useMutation({
    mutationFn: (data) => {
      console.log('💳 Creating CreditCard with data:', data);
      return withRetry(() => base44.entities.CreditCard.create(data), { maxRetries: 2 });
    },
    onSuccess: (newAccount) => {
      console.log('✅ CreditCard created successfully:', newAccount);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeCreditCards'] });
      queryClient.invalidateQueries({ queryKey: ['creditCards'] });
      onAccountCreated?.({ type: 'credit_card', account: newAccount });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('❌ Error creating CreditCard:', error);
      logError(error, { action: 'createCreditCard' });
      showErrorToast(error);
    }
  });

  const createAssetMutation = useMutation({
    mutationFn: (data) => {
      console.log('💰 Creating Asset with data:', data);
      return withRetry(() => base44.entities.Asset.create(data), { maxRetries: 2 });
    },
    onSuccess: (newAsset) => {
      console.log('✅ Asset created successfully:', newAsset);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onAccountCreated?.({ type: 'asset', account: newAsset });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('❌ Error creating Asset:', error);
      logError(error, { action: 'createAsset' });
      showErrorToast(error);
    }
  });

  const createLiabilityMutation = useMutation({
    mutationFn: (data) => {
      console.log('💳 Creating Liability with data:', data);
      return withRetry(() => base44.entities.Liability.create(data), { maxRetries: 2 });
    },
    onSuccess: (newLiability) => {
      console.log('✅ Liability created successfully:', newLiability);
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      onAccountCreated?.({ type: 'liability', account: newLiability });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('❌ Error creating Liability:', error);
      logError(error, { action: 'createLiability' });
      showErrorToast(error);
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data) => withRetry(() => base44.entities.Category.create(data), { maxRetries: 2 }),
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
      onAccountCreated?.({ type: accountType, account: newCategory });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'createCategory' });
      showErrorToast(error);
    }
  });

  // Update mutations
  const updateBankAccountMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => base44.entities.BankAccount.update(id, data), { maxRetries: 2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeBankAccounts'] });
      onAccountCreated?.({ type: 'bank' });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'updateBankAccount' });
      showErrorToast(error);
    }
  });

  const updateCreditCardMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => base44.entities.CreditCard.update(id, data), { maxRetries: 2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['activeCreditCards'] });
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
    mutationFn: ({ id, data }) => withRetry(() => base44.entities.Asset.update(id, data), { maxRetries: 2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
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
    mutationFn: ({ id, data }) => withRetry(() => base44.entities.Liability.update(id, data), { maxRetries: 2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      onAccountCreated?.({ type: 'liability' });
      onOpenChange(false);
    },
    onError: (error) => {
      logError(error, { action: 'updateLiability' });
      showErrorToast(error);
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => base44.entities.Category.update(id, data), { maxRetries: 2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
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
    console.log('📝 handleSubmit called. State:', { accountType, detailType, name, balance, bankName, hideLinkAccount });
    
    if (!accountType || !detailType || !name) {
      console.warn('⚠️ Validation failed - missing required fields');
      return;
    }

    // Validate balance if provided
    let validatedBalance = 0;
    if (balance && balance.trim() !== '') {
      const balanceValidation = validateAmount(balance, { allowZero: true });
      if (!balanceValidation.valid) {
        alert(balanceValidation.error);
        return;
      }
      validatedBalance = balanceValidation.value;
    }

    if (editingAccount) {
      // Update existing account
      if (accountType === 'bank') {
        const bankData = {
          account_name: name,
          account_number: accountNumber,
          account_type: detailType,
          current_balance: validatedBalance,
          institution: bankName,
          logo_url: institutionLogoUrl || null,
          is_active: isActive,
        };
        if (startDate) bankData.start_date = startDate;
        if (isSubaccount && parentAccountId) {
          bankData.parent_account_id = parentAccountId;
        } else {
          bankData.parent_account_id = null;
        }
        updateBankAccountMutation.mutate({ id: editingAccount.id, data: bankData });
      } else if (accountType === 'credit_card') {
        const creditCardData = {
          name: name,
          current_balance: validatedBalance,
          is_active: isActive,
        };
        if (accountNumber) creditCardData.last_four = accountNumber.slice(-4);
        if (isSubaccount && parentAccountId) {
          creditCardData.parent_account_id = parentAccountId;
        } else {
          creditCardData.parent_account_id = null;
        }
        updateCreditCardMutation.mutate({ id: editingAccount.id, data: creditCardData });
      } else if (accountType === 'asset') {
        const assetData = {
          name,
          type: detailType,
          current_value: validatedBalance,
          description,
          is_active: isActive
        };
        if (startDate) assetData.start_date = startDate;
        if (bankName) assetData.institution = bankName;
        if (institutionLogoUrl) assetData.logo_url = institutionLogoUrl;
        console.log('Updating asset with data:', assetData);
        updateAssetMutation.mutate({
          id: editingAccount.id,
          data: assetData
        });
      } else if (accountType === 'liability') {
        const liabilityData = {
          name,
          type: detailType,
          current_balance: validatedBalance,
          description,
          is_active: isActive
        };
        if (startDate) liabilityData.start_date = startDate;
        if (bankName) liabilityData.institution = bankName;
        if (institutionLogoUrl) liabilityData.logo_url = institutionLogoUrl;
        updateLiabilityMutation.mutate({
          id: editingAccount.id,
          data: liabilityData
        });
      } else if (accountType === 'income' || accountType === 'expense') {
        updateCategoryMutation.mutate({
          id: editingAccount.id,
          data: { name, type: accountType, detail_type: accountType, is_active: isActive }
        });
      }
    } else {
      // Create new account
      console.log('🆕 Creating new account, accountType:', accountType);
      if (accountType === 'bank') {
        const bankData = {
          account_name: name.charAt(0).toUpperCase() + name.slice(1),
          account_number: accountNumber,
          account_type: detailType,
          current_balance: validatedBalance,
          is_active: true,
          institution: bankName,
          logo_url: institutionLogoUrl || null,
        };
        if (startDate) bankData.start_date = startDate;
        if (isSubaccount && parentAccountId) {
          bankData.parent_account_id = parentAccountId;
        }
        console.log('🏦 Calling createBankAccountMutation.mutate with:', bankData);
        createBankAccountMutation.mutate(bankData);
      } else if (accountType === 'credit_card') {
        const creditCardData = {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          current_balance: validatedBalance,
          is_active: true,
        };
        if (accountNumber) creditCardData.last_four = accountNumber.slice(-4);
        console.log('💳 Calling createCreditCardMutation.mutate with:', creditCardData);
        createCreditCardMutation.mutate(creditCardData);
      } else if (accountType === 'asset') {
        const assetData = {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          type: detailType,
          current_value: validatedBalance,
          description,
          institution: bankName,
          logo_url: institutionLogoUrl || null,
        };
        if (startDate) assetData.start_date = startDate;
        if (isSubaccount && parentAccountId) {
          assetData.parent_account_id = parentAccountId;
        }
        createAssetMutation.mutate(assetData);
      } else if (accountType === 'liability') {
        const liabilityData = {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          type: detailType,
          current_balance: validatedBalance,
          institution: bankName,
          logo_url: institutionLogoUrl || null,
        };
        if (startDate) liabilityData.start_date = startDate;
        if (isSubaccount && parentAccountId) {
          liabilityData.parent_account_id = parentAccountId;
        }
        createLiabilityMutation.mutate(liabilityData);
      } else if (accountType === 'income' || accountType === 'expense') {
        const categoryData = {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          type: accountType,
          detail_type: accountType,
        };
        if (isSubaccount && parentAccountId) {
          categoryData.parent_account_id = parentAccountId;
        }
        createCategoryMutation.mutate(categoryData);
      }
    }
  };

  const isLoading = createBankAccountMutation.isPending || 
                    createCreditCardMutation.isPending ||
                    createAssetMutation.isPending || 
                    createLiabilityMutation.isPending ||
                    createCategoryMutation.isPending ||
                    updateBankAccountMutation.isPending ||
                    updateCreditCardMutation.isPending ||
                    updateAssetMutation.isPending ||
                    updateLiabilityMutation.isPending ||
                    updateCategoryMutation.isPending;

  const showBalanceField = accountType === 'bank' || accountType === 'credit_card' || accountType === 'asset' || accountType === 'liability';
  
  const isCategory = mode === 'category';
  const entityLabel = isCategory ? 'Category' : 'Account';

  const getBalanceLabel = () => {
    if (accountType === 'asset') return 'Beginning Value';
    if (accountType === 'liability' || accountType === 'credit_card') return 'Beginning Balance';
    return 'Beginning Balance';
  };

  const currentImportedAccount = importedAccounts[currentImportIndex];
  const showingImportDecision = importedAccounts.length > 0 && !importMode;
  const showingImportForm = importedAccounts.length > 0 && importMode === 'new';

  const handleImportDecision = async (decision) => {
    if (decision === 'existing') {
      setImportMode('existing');
    } else {
      setImportMode('new');
      // Pre-fill form with imported data
      if (currentImportedAccount) {
        setName(currentImportedAccount.name || '');
        setAccountType(currentImportedAccount.type || 'bank');
        setDetailType(currentImportedAccount.detailType || 'checking');
        setBalance(String(currentImportedAccount.balance || 0));
        setBankName(currentImportedAccount.institution || '');
        setInstitutionLogoUrl(currentImportedAccount.logo_url || '');
      }
    }
  };

  const handleSkipImportedAccount = () => {
    if (currentImportIndex < importedAccounts.length - 1) {
      setCurrentImportIndex(prev => prev + 1);
      setImportMode(null);
      setSelectedExistingAccountId('');
    } else {
      // Done with all imports
      setImportedAccounts([]);
      setCurrentImportIndex(0);
      setImportMode(null);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onOpenChange(false);
    }
  };

  const handleCompleteImportToExisting = async () => {
    if (!selectedExistingAccountId) return;
    
    // TODO: Merge imported account with existing account
    // For now, just move to next
    handleSkipImportedAccount();
  };

  return (
    <>
      <style>{`
        ${hideLinkAccount ? `
          [data-radix-dialog-overlay]:last-of-type {
            background-color: transparent !important;
          }
        ` : ''}
        ${plaidActive ? `
          #plaid-link-iframe-1,
          [id^="plaid-link-iframe"] {
            z-index: 99999 !important;
            pointer-events: auto !important;
          }
          [data-radix-dialog-overlay] {
            pointer-events: none !important;
          }
        ` : ''}
        [data-radix-popper-content-wrapper] {
          pointer-events: auto !important;
          z-index: 999 !important;
        }
        [data-radix-dialog-content] {
          pointer-events: auto !important;
        }
      `}</style>
      <Sheet open={open} onOpenChange={(newOpen) => {
        if (!newOpen && plaidActive) return;
        onOpenChange(newOpen);
      }}>
        <SheetContent className="overflow-y-auto sm:max-w-[600px]" ref={(el) => {
          if (el && open) {
            el.scrollTop = 0;
          }
        }}>
        <SheetHeader>
          <SheetTitle>
            {showingImportDecision 
              ? `Import Account (${currentImportIndex + 1} of ${importedAccounts.length})`
              : editingAccount ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
          </SheetTitle>
        </SheetHeader>

        {showingImportDecision ? (
          <div className="py-6 space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">{currentImportedAccount.name}</h3>
              <div className="space-y-1 text-sm text-slate-600">
                <p>Institution: {currentImportedAccount.institution || 'N/A'}</p>
                <p>Type: {currentImportedAccount.detailType || currentImportedAccount.type}</p>
                <p>Balance: ${(currentImportedAccount.balance || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Where should this account go?</p>
              
              <button
                onClick={() => handleImportDecision('new')}
                className="w-full p-4 bg-white border-2 border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="font-medium text-slate-900 group-hover:text-blue-700">Create New Account</div>
                <div className="text-sm text-slate-500 mt-1">Add this as a new account in your system</div>
              </button>

              <button
                onClick={() => handleImportDecision('existing')}
                className="w-full p-4 bg-white border-2 border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="font-medium text-slate-900 group-hover:text-blue-700">Add to Existing Account</div>
                <div className="text-sm text-slate-500 mt-1">Merge transactions into an existing account</div>
              </button>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleSkipImportedAccount} className="flex-1">
                Skip This Account
              </Button>
            </div>
          </div>
        ) : importMode === 'existing' ? (
          <div className="py-6 space-y-4">
            <div>
              <Label>Select Existing Account</Label>
              <ClickThroughSelect
                value={selectedExistingAccountId}
                onValueChange={setSelectedExistingAccountId}
                placeholder="Choose account..."
                triggerClassName="hover:bg-slate-50"
              >
                {existingAccounts.map(acc => (
                  <ClickThroughSelectItem key={acc.id} value={acc.id}>
                    {acc.account_name} {acc.account_number ? `(${acc.account_number})` : ''}
                  </ClickThroughSelectItem>
                ))}
                {assets.map(asset => (
                  <ClickThroughSelectItem key={asset.id} value={asset.id}>
                    {asset.name} (Asset)
                  </ClickThroughSelectItem>
                ))}
                {liabilities.map(liability => (
                  <ClickThroughSelectItem key={liability.id} value={liability.id}>
                    {liability.name} (Liability)
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setImportMode(null)}>
                Back
              </Button>
              <Button 
                onClick={handleCompleteImportToExisting}
                disabled={!selectedExistingAccountId}
                className="bg-blue-600 hover:bg-blue-700 flex-1"
              >
                Merge & Continue
              </Button>
            </div>
          </div>
        ) : !showManualForm && !editingAccount && !hideLinkAccount && !showingImportForm ? (
          <div className="py-6 flex flex-col gap-3">
            <PlaidLinkButton
              onLinkStart={() => {
                onOpenChange(false);
              }}
              onSuccess={(result) => {
                if (result.discovered_accounts) {
                  // Open review dialog via global handler
                  if (window.__openPlaidReview) {
                    window.__openPlaidReview(result);
                  }
                } else {
                  queryClient.invalidateQueries({ queryKey: ['accounts'] });
                  queryClient.invalidateQueries({ queryKey: ['transactions'] });
                }
              }}
              onPlaidStateChange={(active) => {
                setPlaidActive(active);
                if (active) {
                  onOpenChange(false);
                }
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
        <form onSubmit={handleSubmit} className="space-y-4 py-4" onKeyDown={(e) => e.stopPropagation()}>
          {/* Display Name - Hidden for Income/Expense, auto-filled from detail type */}
          {accountType !== 'income' && accountType !== 'expense' && (
            <div>
              <Label htmlFor="name">Account Name*</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Chase Checking"
                required
              />
            </div>
          )}

          {/* Account Type and Detail Type - Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="accountType">{entityLabel} Type*</Label>
              <ClickThroughSelect 
              value={accountType} 
              onValueChange={(val) => {
                setAccountType(val);
                // Auto-select detail type for single-option types, reset for others
                if (val === 'income') {
                  setDetailType('income');
                } else if (val === 'expense') {
                  setDetailType('expense');
                } else if (val === 'credit_card') {
                  setDetailType('credit_card');
                } else {
                  setDetailType('');
                }
              }} 
              placeholder={`Select type`} 
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

            {/* Detail Type - Hidden for income/expense (auto-set) */}
            {accountType !== 'income' && accountType !== 'expense' && (
              <div>
                <Label htmlFor="detailType">Detail Type*</Label>
                <ClickThroughSelect
                  key={accountType}
                  value={detailType}
                  onValueChange={setDetailType}
                  placeholder="Select detail type"
                  triggerClassName="hover:bg-slate-50"
                >
                  {accountType && getDetailTypesForAccountType(accountType).map(type => (
                    <ClickThroughSelectItem key={type.value} value={type.value}>
                      {type.label}
                    </ClickThroughSelectItem>
                  ))}
                </ClickThroughSelect>
              </div>
            )}
                  </div>

                  {/* Sub-account toggle and parent selection */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isSubaccount"
                checked={isSubaccount}
                onCheckedChange={setIsSubaccount}
              />
              <Label htmlFor="isSubaccount" className="text-sm font-normal cursor-pointer">
                Is sub-account
              </Label>
            </div>
            {isSubaccount && (
              <div>
                <Label htmlFor="parentAccount">Parent Account*</Label>
                <ClickThroughSelect
                                      value={parentAccountId}
                                      onValueChange={setParentAccountId}
                                      placeholder="Select parent account"
                                      triggerClassName="hover:bg-slate-50"
                                    >
                  {(accountType === 'bank' || accountType === 'credit_card') && existingAccounts.filter(acc => !acc.parent_account_id).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Bank Accounts</div>
                      {existingAccounts.filter(acc => !acc.parent_account_id).map(acc => (
                        <ClickThroughSelectItem key={acc.id} value={acc.id}>
                          {acc.account_name}{acc.account_number ? ` (${acc.account_number})` : ''}
                        </ClickThroughSelectItem>
                      ))}
                    </>
                  )}
                  {accountType === 'asset' && assets.filter(a => !a.parent_account_id).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Assets</div>
                      {assets.filter(a => !a.parent_account_id).map(asset => (
                        <ClickThroughSelectItem key={asset.id} value={asset.id}>
                          {asset.name}
                        </ClickThroughSelectItem>
                      ))}
                    </>
                  )}
                  {accountType === 'liability' && liabilities.filter(l => !l.parent_account_id).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Liabilities</div>
                      {liabilities.filter(l => !l.parent_account_id).map(liability => (
                        <ClickThroughSelectItem key={liability.id} value={liability.id}>
                          {liability.name}
                        </ClickThroughSelectItem>
                      ))}
                    </>
                  )}
                  {accountType === 'income' && categories.filter(c => c.type === 'income' && !c.parent_account_id).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Income Accounts</div>
                      {categories.filter(c => c.type === 'income' && !c.parent_account_id).map(cat => (
                        <ClickThroughSelectItem key={`income-${cat.id}`} value={cat.id}>
                          {cat.name}
                        </ClickThroughSelectItem>
                      ))}
                    </>
                  )}
                  {accountType === 'expense' && categories.filter(c => c.type === 'expense' && !c.parent_account_id).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Expense Accounts</div>
                      {categories.filter(c => c.type === 'expense' && !c.parent_account_id).map(cat => (
                        <ClickThroughSelectItem key={`expense-${cat.id}`} value={cat.id}>
                          {cat.name}
                        </ClickThroughSelectItem>
                      ))}
                    </>
                  )}
                </ClickThroughSelect>
              </div>
            )}
          </div>

          

          {/* Balance field */}
          {(accountType === 'bank' || accountType === 'credit_card' || accountType === 'asset' || accountType === 'liability') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="balance">{getBalanceLabel()}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <Input
                    id="balance"
                    type="text"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value.replace(/[^0-9.]/g, ''))}
                    onBlur={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      if (val) {
                        setBalance(parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      }
                    }}
                    onFocus={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      setBalance(val);
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
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Institution fields - show for bank, credit_card, asset, liability */}
          {(accountType === 'bank' || accountType === 'credit_card' || accountType === 'asset' || accountType === 'liability') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bankName">Institution Name</Label>
                <Input
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Chase, Schwab"
                />
              </div>
              <div>
                <Label htmlFor="institutionLogo">Logo URL</Label>
                <Input
                  id="institutionLogo"
                  value={institutionLogoUrl}
                  onChange={(e) => setInstitutionLogoUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          {/* Description field */}
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Additional details..."
                        />
                      </div>

          {/* Active status toggle - only show when editing */}
          {editingAccount && (
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
                Active account
              </Label>
              {!isActive && (
                <span className="text-xs text-slate-500">(Excluded from all calculations)</span>
              )}
            </div>
          )}

          <SheetFooter className="pt-4">
            {showingImportForm ? (
              <>
                <Button type="button" variant="outline" onClick={() => setImportMode(null)}>
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!accountType || !detailType || !name || isLoading || (isSubaccount && !parentAccountId)}
                  onClick={(e) => {
                    handleSubmit(e);
                    // After successful save, move to next account
                    setTimeout(handleSkipImportedAccount, 500);
                  }}
                >
                  Save & Continue
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!accountType || !detailType || !name || isLoading || (isSubaccount && !parentAccountId)}
                >
                  Save
                </Button>
              </>
            )}
            </SheetFooter>

            {/* Preview Section */}
                            {name && accountType && (
                              <div className="mt-4">
                                <div className="flex items-center justify-end mb-2">
                                  <span className="text-[10px] px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">PREVIEW</span>
                                </div>
                                <div className="bg-white border rounded-md text-xs max-h-64 overflow-y-auto" ref={(el) => {
                                  if (el) {
                                    const newItem = el.querySelector('[data-new-item="true"]');
                                    if (newItem) {
                                      newItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
                                    }
                                  }
                                }}>
                                  {(() => {
                                    // Create new/edited account object
                                    const newAccount = { 
                                     id: editingAccount?.id || '__new__', 
                                     account_name: name, 
                                     account_number: accountNumber,
                                     bank_name: bankName,
                                     account_type: detailType,
                                     current_balance: parseFloat(balance) || 0,
                                     parent_account_id: isSubaccount ? parentAccountId : null,
                                     isNew: true,
                                     entityType: accountType === 'bank' ? 'BankAccount' : 
                                                 accountType === 'credit_card' ? 'CreditCard' :
                                                 accountType === 'asset' ? 'Asset' : 
                                                 accountType === 'liability' ? 'Liability' : 
                                                 accountType === 'income' ? 'Income' : 'Expense'
                                    };

                                    // Combine all accounts into a flat list, excluding the one being edited
                                    const editingId = editingAccount?.id;
                                    let allAccounts = [
                                      ...existingAccounts.filter(a => a.id !== editingId).map(a => ({ ...a, entityType: 'BankAccount', isNew: false })),
                                      ...assets.filter(a => a.id !== editingId).map(a => ({ ...a, account_name: a.name, entityType: 'Asset', isNew: false })),
                                      ...liabilities.filter(l => l.id !== editingId).map(l => ({ ...l, account_name: l.name, entityType: 'Liability', isNew: false })),
                                      ...categories.filter(c => c.type === 'income' && c.id !== editingId).map(c => ({ ...c, account_name: c.name, entityType: 'Income', isNew: false })),
                                      ...categories.filter(c => c.type === 'expense' && c.id !== editingId).map(c => ({ ...c, account_name: c.name, entityType: 'Expense', isNew: false }))
                                    ];

                                    // Add new/edited account
                                    allAccounts.push(newAccount);

                                    // Separate parents and children
                                    const parentAccounts = allAccounts.filter(a => !a.parent_account_id);
                                    const childAccounts = allAccounts.filter(a => a.parent_account_id);

                                    // Sort parents
                                    const sortedParents = [...parentAccounts].sort((a, b) => {
                                      let aVal, bVal;
                                      switch (sortColumn) {
                                        case 'name':
                                          aVal = (a.account_name || '').toLowerCase();
                                          bVal = (b.account_name || '').toLowerCase();
                                          break;
                                        case 'institution':
                                          aVal = (a.bank_name || '').toLowerCase();
                                          bVal = (b.bank_name || '').toLowerCase();
                                          break;
                                        case 'type':
                                          aVal = getDetailTypeDisplayName(a.entityType === 'BankAccount' ? a.account_type : a.entityType === 'Asset' || a.entityType === 'Liability' ? a.type : a.detail_type).toLowerCase();
                                          bVal = getDetailTypeDisplayName(b.entityType === 'BankAccount' ? b.account_type : b.entityType === 'Asset' || b.entityType === 'Liability' ? b.type : b.detail_type).toLowerCase();
                                          break;
                                        case 'balance':
                                          aVal = a.current_balance || a.current_value || 0;
                                          bVal = b.current_balance || b.current_value || 0;
                                          break;
                                        default:
                                          aVal = (a.account_name || '').toLowerCase();
                                          bVal = (b.account_name || '').toLowerCase();
                                      }
                                      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                                      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                                      return 0;
                                    });

                                    // Build ordered list with children under parents
                                    const orderedAccounts = [];
                                    sortedParents.forEach(parent => {
                                      orderedAccounts.push(parent);
                                      const children = childAccounts.filter(c => c.parent_account_id === parent.id);
                                      children.sort((a, b) => (a.account_name || '').localeCompare(b.account_name || ''));
                                      children.forEach(child => orderedAccounts.push({ ...child, isSubAccount: true }));
                                    });

                                    return (
                                      <div className="divide-y divide-slate-100">
                                        {orderedAccounts.map(account => (
                                          <div 
                                            key={account.id}
                                            data-new-item={account.isNew ? "true" : undefined}
                                            className={`px-3 py-1.5 ${account.isNew ? 'bg-blue-100 border-l-2 border-l-blue-500 font-medium text-slate-900' : 'text-slate-700'} ${account.isSubAccount ? 'pl-8' : ''}`}
                                          >
                                            {account.account_name}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
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