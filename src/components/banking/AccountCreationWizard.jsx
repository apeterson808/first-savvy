import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { validateAmount } from '../utils/validation';
import { withRetry, showErrorToast, logError } from '../utils/errorHandler';
import { toast } from 'sonner';
import { createVehicleAsset, createAutoLoan, createAssetLiabilityLink } from '@/api/vehiclesAndLoans';
import { createPropertyAsset, createMortgage } from '@/api/propertiesAndMortgages';
import TypeDetailSelector from '@/components/common/TypeDetailSelector';
import { getAccountTypes, getAccountDetails } from '@/utils/accountTypeMapping';
import ChartAccountDropdown from '@/components/common/ChartAccountDropdown';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Wallet,
  CreditCard,
  Car,
  Home,
  TrendingUp,
  FileText,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Check,
  PiggyBank,
  Landmark,
  BadgeDollarSign,
  Receipt,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Info
} from 'lucide-react';

const VEHICLE_TYPES = [
  'Car',
  'Truck',
  'SUV',
  'Motorcycle',
  'RV',
  'Boat',
  'Other',
];

const PROPERTY_TYPES = [
  'Single Family',
  'Condo',
  'Townhouse',
  'Multi-Family',
  'Commercial',
  'Land',
  'Other',
];

const MOCK_BANK_ACCOUNTS = [
  {
    id: 'mock-1',
    name: 'Chase Freedom Checking',
    type: 'checking',
    last4: '1234',
    balance: 2450.00,
    institutionName: 'Chase'
  },
  {
    id: 'mock-2',
    name: 'Chase Sapphire Credit Card',
    type: 'credit_card',
    last4: '5678',
    balance: -1250.00,
    institutionName: 'Chase'
  },
  {
    id: 'mock-3',
    name: 'Chase Savings',
    type: 'savings',
    last4: '9012',
    balance: 15000.00,
    institutionName: 'Chase'
  },
  {
    id: 'mock-4',
    name: 'Chase Business Checking',
    type: 'checking',
    last4: '3456',
    balance: 8500.00,
    institutionName: 'Chase'
  }
];

const ACCOUNT_TYPE_CARDS = [
  {
    id: 'banking',
    title: 'Banking',
    icon: Building2,
    bgColor: '#52A5CE',
    iconColor: 'text-white',
    subtypes: [
      { value: 'checking', label: 'Checking', icon: Wallet },
      { value: 'savings', label: 'Savings', icon: PiggyBank },
      { value: 'credit_card', label: 'Credit Card', icon: CreditCard }
    ]
  },
  {
    id: 'vehicle',
    title: 'Vehicle',
    icon: Car,
    bgColor: '#AACC96',
    iconColor: 'text-white',
    subtypes: []
  },
  {
    id: 'property',
    title: 'Property',
    icon: Home,
    bgColor: '#EF6F3C',
    iconColor: 'text-white',
    subtypes: []
  },
  {
    id: 'investments',
    title: 'Investments',
    icon: TrendingUp,
    bgColor: '#FF7BAC',
    iconColor: 'text-white',
    subtypes: [
      { value: 'retirement', label: 'Retirement', icon: Landmark },
      { value: 'stocks', label: 'Stock', icon: TrendingUp },
      { value: 'crypto', label: 'Crypto', icon: BadgeDollarSign },
      { value: 'investment', label: 'Other', icon: TrendingUp }
    ]
  },
  {
    id: 'loans',
    title: 'Loans & Debts',
    icon: FileText,
    bgColor: '#6D1F42',
    iconColor: 'text-white',
    subtypes: [
      { value: 'personal_loan', label: 'Personal', icon: FileText },
      { value: 'student_loan', label: 'Student', icon: FileText },
      { value: 'medical_debt', label: 'Medical', icon: FileText }
    ]
  },
  {
    id: 'budget',
    title: 'Budget Category',
    icon: DollarSign,
    bgColor: '#EFCE7B',
    iconColor: 'text-white',
    subtypes: [
      { value: 'income', label: 'Income', icon: BadgeDollarSign },
      { value: 'expense', label: 'Expense', icon: Receipt }
    ]
  }
];

export default function AccountCreationWizard({ open, onOpenChange, onAccountCreated }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState('select-type');
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedSubtype, setSelectedSubtype] = useState(null);
  const [formData, setFormData] = useState({});
  const [focusedFields, setFocusedFields] = useState({});
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [mockBankAccounts, setMockBankAccounts] = useState([]);
  const [checkedAccountIds, setCheckedAccountIds] = useState([]);
  const [accountConfigurations, setAccountConfigurations] = useState({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts-assets-liabilities', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await firstsavvy
        .from('user_chart_of_accounts')
        .select('*')
        .eq('user_id', user.id)
        .in('account_type', ['asset', 'liability'])
        .eq('is_active', true)
        .order('account_number');
      return data || [];
    },
    enabled: !!user && open
  });

  useEffect(() => {
    if (!open) {
      resetWizard();
    }
  }, [open]);

  const resetWizard = () => {
    setCurrentStep('select-type');
    setSelectedCard(null);
    setSelectedSubtype(null);
    setFormData({});
    setShowConnectionModal(false);
    setConnectionStatus('connecting');
    setMockBankAccounts([]);
    setCheckedAccountIds([]);
    setAccountConfigurations({});
  };

  const handleCardSelect = (card) => {
    setSelectedCard(card);
    if (card.id === 'banking') {
      setCurrentStep('bank-search');
    } else if (card.subtypes && card.subtypes.length > 0) {
      setCurrentStep('select-subtype');
    } else {
      const subtypeValue = card.id === 'property' ? 'property' : card.id;
      setSelectedSubtype({ value: subtypeValue, label: card.title });
      setFormData({ subtype: subtypeValue });
      setCurrentStep('details');
    }
  };

  const handleSubtypeSelect = (subtype) => {
    setSelectedSubtype(subtype);
    setFormData({ subtype: subtype.value });
    setCurrentStep('details');
  };

  const handleBack = () => {
    if (currentStep === 'bank-search') {
      setCurrentStep('select-type');
      setSelectedCard(null);
    } else if (currentStep === 'configure-accounts') {
      setCurrentStep('bank-search');
      setMockBankAccounts([]);
      setCheckedAccountIds([]);
      setAccountConfigurations({});
    } else if (currentStep === 'select-subtype') {
      if (selectedCard?.id === 'banking') {
        setCurrentStep('bank-search');
      } else {
        setCurrentStep('select-type');
        setSelectedCard(null);
      }
    } else if (currentStep === 'details') {
      if (selectedCard?.subtypes && selectedCard.subtypes.length > 0) {
        setCurrentStep('select-subtype');
        setSelectedSubtype(null);
        setFormData({});
      } else {
        setCurrentStep('select-type');
        setSelectedCard(null);
        setSelectedSubtype(null);
        setFormData({});
      }
    } else if (currentStep === 'loan-search' || currentStep === 'balance') {
      setCurrentStep('details');
    } else if (currentStep === 'loan-details') {
      setCurrentStep('loan-search');
    } else if (currentStep === 'review') {
      if (selectedCard.id === 'vehicle' && !formData.skipLoanDetails) {
        setCurrentStep('loan-details');
      } else if (selectedCard.id === 'property' && !formData.skipMortgageDetails) {
        setCurrentStep('loan-details');
      } else if (selectedCard.id === 'banking') {
        setCurrentStep('balance');
      } else {
        setCurrentStep('details');
      }
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBankSimulation = () => {
    setShowConnectionModal(true);
    setConnectionStatus('connecting');

    setTimeout(() => {
      setConnectionStatus('authenticating');
    }, 1500);

    setTimeout(() => {
      setConnectionStatus('success');
      setMockBankAccounts(MOCK_BANK_ACCOUNTS);
    }, 3000);
  };

  const handleConnectionContinue = () => {
    setShowConnectionModal(false);
    setConnectionStatus('connecting');
    setCurrentStep('configure-accounts');
  };

  const getDefaultChartAccountForType = (accountType) => {
    const detailMap = {
      'checking': 'Checking',
      'savings': 'Savings',
      'credit_card': 'Credit Card',
    };

    const detail = detailMap[accountType];
    if (!detail) return null;

    const matchingAccount = chartAccounts.find(a =>
      a.account_detail === detail && a.is_active
    );

    return matchingAccount?.id || null;
  };

  const handleToggleAccount = (accountId) => {
    setCheckedAccountIds(prev => {
      if (prev.includes(accountId)) {
        const newChecked = prev.filter(id => id !== accountId);
        setAccountConfigurations(prevConfig => {
          const newConfig = { ...prevConfig };
          delete newConfig[accountId];
          return newConfig;
        });
        return newChecked;
      } else {
        const account = mockBankAccounts.find(acc => acc.id === accountId);
        const today = new Date().toISOString().split('T')[0];
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const startDate = ninetyDaysAgo.toISOString().split('T')[0];

        const defaultChartAccountId = getDefaultChartAccountForType(account.type);
        const classType = account.type === 'credit_card' ? 'liability' : 'asset';

        setAccountConfigurations(prevConfig => ({
          ...prevConfig,
          [accountId]: {
            displayName: account.name,
            classType: classType,
            chart_account_id: defaultChartAccountId,
            startDatePreset: 'last_90',
            startDate: startDate,
            goLiveDate: today
          }
        }));
        return [...prev, accountId];
      }
    });
  };

  const updateAccountConfiguration = (accountId, field, value) => {
    setAccountConfigurations(prev => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [field]: value
      }
    }));

    if (field === 'startDatePreset' && value !== 'custom') {
      const today = new Date();
      let daysAgo;
      if (value === 'last_30') daysAgo = 30;
      else if (value === 'last_60') daysAgo = 60;
      else if (value === 'last_90') daysAgo = 90;

      const calculatedDate = new Date();
      calculatedDate.setDate(today.getDate() - daysAgo);
      const dateStr = calculatedDate.toISOString().split('T')[0];

      setAccountConfigurations(prev => ({
        ...prev,
        [accountId]: {
          ...prev[accountId],
          startDate: dateStr
        }
      }));
    }
  };

  const formatAmountField = (fieldName, value, isFocused) => {
    if (!value) return '';
    const numValue = Number(value.toString().replace(/,/g, ''));
    if (isFocused) {
      return numValue.toLocaleString('en-US');
    }
    return numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAmountChange = (fieldName, rawValue) => {
    const cleaned = rawValue.replace(/[^0-9.]/g, '');
    updateFormData(fieldName, cleaned);
  };

  const handleAmountBlur = (fieldName, value) => {
    setFocusedFields(prev => ({ ...prev, [fieldName]: false }));
    if (value) {
      const cleaned = value.replace(/,/g, '');
      const formatted = Number(cleaned).toFixed(2);
      updateFormData(fieldName, formatted);
    }
  };

  const createAccountMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.Account.create(data)),
    onSuccess: (newAccount) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
      onAccountCreated?.({ type: newAccount.account_type, account: newAccount });
      toast.success('Account created successfully!');
      onOpenChange(false);
      setTimeout(() => {
        navigate(`/Banking/account/${newAccount.id}`);
      }, 100);
    },
    onError: (error) => {
      logError(error, { action: 'createAccount' });
      showErrorToast(error);
    }
  });

  const createAssetMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.Asset.create(data)),
    onSuccess: (newAsset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onAccountCreated?.({ type: 'asset', account: newAsset });
      toast.success('Asset created successfully!');
      if (formData.createLoan) {
        setCurrentStep('loan-details');
      } else {
        onOpenChange(false);
        setTimeout(() => {
          navigate(`/Banking/account/${newAsset.id}`);
        }, 100);
      }
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
      toast.success('Loan created successfully!');
      onOpenChange(false);
      setTimeout(() => {
        navigate(`/Banking/account/${newLiability.id}`);
      }, 100);
    },
    onError: (error) => {
      logError(error, { action: 'createLiability' });
      showErrorToast(error);
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.Category.create(data)),
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onAccountCreated?.({ type: formData.subtype, account: newCategory });
      toast.success('Category created successfully!');
      onOpenChange(false);
      setTimeout(() => {
        navigate(`/Banking/account/${newCategory.id}`);
      }, 100);
    },
    onError: (error) => {
      logError(error, { action: 'createCategory' });
      showErrorToast(error);
    }
  });

  const handleSubmit = async () => {
    if (selectedCard?.id === 'banking' && checkedAccountIds.length > 0) {
      try {
        let createdCount = 0;
        for (const accountId of checkedAccountIds) {
          const mockAccount = mockBankAccounts.find(acc => acc.id === accountId);
          const config = accountConfigurations[accountId];

          if (!mockAccount || !config) continue;

          const accountNumber = Date.now().toString().slice(-6);
          await firstsavvy.entities.Account.create({
            account_name: config.displayName,
            account_number: accountNumber,
            account_type: mockAccount.type,
            chart_account_id: config.chart_account_id,
            current_balance: mockAccount.balance,
            institution_name: mockAccount.institutionName,
            account_number_last4: mockAccount.last4,
            start_date: config.startDate || null,
            go_live_date: config.goLiveDate || null,
            is_active: true
          });
          createdCount++;
        }

        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
        toast.success(`Successfully imported ${createdCount} account${createdCount !== 1 ? 's' : ''}!`);
        onAccountCreated?.({ type: 'banking_batch', count: createdCount });
        onOpenChange(false);
        return;
      } catch (error) {
        console.error('Error creating accounts:', error);
        toast.error(error.message || 'Failed to create accounts. Please try again.');
        return;
      }
    }

    if (!selectedCard || !selectedSubtype) return;

    try {
      if (selectedCard.id === 'banking') {
        const balanceValidation = validateAmount(formData.balance || '0', {
          allowZero: true,
          allowNegative: selectedSubtype.value === 'credit_card'
        });
        if (!balanceValidation.valid) {
          toast.error(balanceValidation.error);
          return;
        }

        const accountNumber = Date.now().toString().slice(-6);
        await createAccountMutation.mutateAsync({
          account_name: formData.name,
          account_number: accountNumber,
          account_type: selectedSubtype.value,
          current_balance: balanceValidation.value,
          institution_name: formData.institutionName || null,
          account_number_last4: formData.last4 || null,
          is_active: true
        });
      } else if (selectedCard.id === 'vehicle') {
        const balanceValidation = validateAmount(formData.currentValue || '0', {
          allowZero: true,
          allowNegative: false
        });
        if (!balanceValidation.valid) {
          toast.error(balanceValidation.error);
          return;
        }

        const vehicleData = {
          name: formData.displayName.trim(),
          year: formData.year ? parseInt(formData.year) : null,
          make: formData.make?.trim() || null,
          model: formData.model?.trim() || null,
          vehicleType: formData.vehicleType || 'Other',
          vin: formData.vin?.trim() || null,
          estimatedValue: balanceValidation.value,
        };

        const newAsset = await createVehicleAsset(vehicleData);
        queryClient.invalidateQueries({ queryKey: ['assets'] });

        if (!formData.skipLoanDetails && formData.loanBalance) {
          const loanBalanceValidation = validateAmount(formData.loanBalance, {
            allowZero: false,
            allowNegative: false
          });
          if (!loanBalanceValidation.valid) {
            toast.error(loanBalanceValidation.error);
            return;
          }

          const loanData = {
            name: `${formData.displayName.trim()} Loan`,
            lenderName: formData.loanInstitution,
            currentBalance: loanBalanceValidation.value,
            originalAmount: formData.originalLoanAmount ? parseFloat(formData.originalLoanAmount) : loanBalanceValidation.value,
            interestRate: formData.interestRate ? parseFloat(formData.interestRate) : null,
            monthlyPayment: formData.monthlyPayment ? parseFloat(formData.monthlyPayment) : null,
            paymentDueDate: formData.paymentDueDate ? parseInt(formData.paymentDueDate) : null,
            startDate: formData.loanStartDate || null,
            linkedAssetId: newAsset.id,
          };

          const newLoan = await createAutoLoan(loanData);
          await createAssetLiabilityLink(newAsset.id, newLoan.id);
          queryClient.invalidateQueries({ queryKey: ['liabilities'] });
          queryClient.invalidateQueries({ queryKey: ['assetLinks'] });
          queryClient.invalidateQueries({ queryKey: ['liabilityLinks'] });
        }

        toast.success('Vehicle created successfully!');
        onAccountCreated?.({ type: 'asset', account: newAsset });
        onOpenChange(false);
        setTimeout(() => {
          navigate(`/Banking/account/${newAsset.id}`);
        }, 100);
        return;
      } else if (selectedCard.id === 'property') {
        const balanceValidation = validateAmount(formData.currentValue || '0', {
          allowZero: true,
          allowNegative: false
        });
        if (!balanceValidation.valid) {
          toast.error(balanceValidation.error);
          return;
        }

        const propertyData = {
          name: formData.displayName.trim(),
          address: formData.address?.trim() || null,
          city: formData.city?.trim() || null,
          state: formData.state?.trim() || null,
          zip: formData.zip?.trim() || null,
          propertyType: formData.propertyType || null,
          squareFeet: formData.squareFeet || null,
          bedrooms: formData.bedrooms || null,
          bathrooms: formData.bathrooms || null,
          estimatedValue: balanceValidation.value,
          purchasePrice: formData.purchasePrice || null,
          purchaseDate: formData.purchaseDate || null,
        };

        const newAsset = await createPropertyAsset(propertyData);
        queryClient.invalidateQueries({ queryKey: ['assets'] });

        if (!formData.skipMortgageDetails && formData.loanBalance) {
          const loanBalanceValidation = validateAmount(formData.loanBalance, {
            allowZero: false,
            allowNegative: false
          });
          if (!loanBalanceValidation.valid) {
            toast.error(loanBalanceValidation.error);
            return;
          }

          const mortgageData = {
            name: `${formData.displayName.trim()} Mortgage`,
            lenderName: formData.loanInstitution,
            currentBalance: loanBalanceValidation.value,
            originalAmount: formData.originalLoanAmount ? parseFloat(formData.originalLoanAmount) : loanBalanceValidation.value,
            interestRate: formData.interestRate ? parseFloat(formData.interestRate) : null,
            monthlyPayment: formData.monthlyPayment ? parseFloat(formData.monthlyPayment) : null,
            paymentDueDate: formData.paymentDueDate ? parseInt(formData.paymentDueDate) : null,
            startDate: formData.loanStartDate || null,
            linkedAssetId: newAsset.id,
          };

          const newMortgage = await createMortgage(mortgageData);
          await createAssetLiabilityLink(newAsset.id, newMortgage.id);
          queryClient.invalidateQueries({ queryKey: ['liabilities'] });
          queryClient.invalidateQueries({ queryKey: ['assetLinks'] });
          queryClient.invalidateQueries({ queryKey: ['liabilityLinks'] });
        }

        toast.success('Property created successfully!');
        onAccountCreated?.({ type: 'asset', account: newAsset });
        onOpenChange(false);
        setTimeout(() => {
          navigate(`/Banking/account/${newAsset.id}`);
        }, 100);
        return;
      } else if (selectedCard.id === 'investments') {
        const balanceValidation = validateAmount(formData.currentValue || '0', {
          allowZero: true,
          allowNegative: false
        });
        if (!balanceValidation.valid) {
          toast.error(balanceValidation.error);
          return;
        }

        await createAssetMutation.mutateAsync({
          name: formData.name,
          type: selectedSubtype.value,
          current_balance: balanceValidation.value,
          institution: formData.institutionName || null,
          is_active: true
        });
      } else if (selectedCard.id === 'loans') {
        const balanceValidation = validateAmount(formData.currentBalance || '0', {
          allowZero: false,
          allowNegative: false
        });
        if (!balanceValidation.valid) {
          toast.error(balanceValidation.error);
          return;
        }

        await createLiabilityMutation.mutateAsync({
          name: formData.name,
          type: selectedSubtype.value,
          current_balance: balanceValidation.value,
          institution: formData.lenderName || null,
          is_active: true
        });
      } else if (selectedCard.id === 'budget') {
        await createCategoryMutation.mutateAsync({
          name: formData.name,
          type: selectedSubtype.value,
          detail_type: selectedSubtype.value
        });
      }
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error(error.message || 'Failed to create account. Please try again.');
    }
  };

  const isLoading =
    createAccountMutation.isPending ||
    createAssetMutation.isPending ||
    createLiabilityMutation.isPending ||
    createCategoryMutation.isPending;

  const getTotalSteps = () => {
    if (currentStep === 'select-type') return 5;
    if (!selectedCard) return 5;
    if (currentStep === 'bank-search') return 5;
    if (currentStep === 'configure-accounts') return 3;
    if (currentStep === 'select-subtype' || !selectedSubtype) {
      return selectedCard.id === 'budget' ? 3 : (selectedCard.id === 'banking' ? 5 : 5);
    }

    if (selectedCard.id === 'banking') return 5;
    if (selectedCard.id === 'vehicle') {
      return formData.skipLoanDetails ? 2 : 3;
    }
    if (selectedCard.id === 'property') {
      return formData.skipMortgageDetails ? 2 : 3;
    }
    if (selectedCard.id === 'investments') return 4;
    if (selectedCard.id === 'loans') return 4;
    if (selectedCard.id === 'budget') return 3;

    return 5;
  };

  const getCurrentStepNumber = () => {
    if (selectedCard?.id === 'banking') {
      const bankingStepMap = {
        'select-type': 0,
        'bank-search': 1,
        'configure-accounts': 2,
        'select-subtype': 2,
        'details': 3,
        'balance': 4,
        'review': 5
      };
      return bankingStepMap[currentStep] || 0;
    }

    if (selectedCard?.id === 'vehicle') {
      if (formData.skipLoanDetails && currentStep === 'details') {
        return 2;
      }
      const vehicleStepMap = {
        'select-type': 0,
        'details': 1,
        'loan-search': 2,
        'loan-details': 3
      };
      return vehicleStepMap[currentStep] || 0;
    }

    if (selectedCard?.id === 'property') {
      if (formData.skipMortgageDetails && currentStep === 'details') {
        return 2;
      }
      const propertyStepMap = {
        'select-type': 0,
        'details': 1,
        'loan-search': 2,
        'loan-details': 3
      };
      return propertyStepMap[currentStep] || 0;
    }

    const stepMap = {
      'select-type': 0,
      'select-subtype': 1,
      'details': 2,
      'balance': 3,
      'loan-search': 3,
      'loan-details': 4
    };
    return stepMap[currentStep] || 0;
  };

  const canProceed = () => {
    if (currentStep === 'configure-accounts') {
      if (checkedAccountIds.length === 0) return false;

      for (const accountId of checkedAccountIds) {
        const config = accountConfigurations[accountId];
        if (!config || !config.displayName || !config.chart_account_id || !config.startDate || !config.goLiveDate) {
          return false;
        }
      }
      return true;
    }
    if (currentStep === 'details') {
      if (selectedCard.id === 'banking') {
        return formData.name && formData.name.trim();
      }
      if (selectedCard.id === 'vehicle') {
        return formData.displayName && formData.displayName.trim() && formData.currentValue;
      }
      if (selectedCard.id === 'property') {
        return formData.displayName && formData.displayName.trim() && formData.currentValue;
      }
      if (selectedCard.id === 'investments') {
        return formData.name && formData.name.trim() && formData.institutionName;
      }
      if (selectedCard.id === 'loans') {
        return formData.name && formData.name.trim() && formData.currentBalance && formData.lenderName;
      }
      if (selectedCard.id === 'budget') {
        return formData.name && formData.name.trim();
      }
    }
    if (currentStep === 'balance') {
      return formData.balance !== undefined;
    }
    if (currentStep === 'loan-details') {
      return formData.loanBalance && formData.loanInstitution;
    }
    return true;
  };

  const handleNext = async () => {
    if (selectedCard.id === 'banking') {
      if (currentStep === 'bank-search') {
        setCurrentStep('select-subtype');
      } else if (currentStep === 'configure-accounts') {
        await handleSubmit();
      } else if (currentStep === 'details') {
        setCurrentStep('balance');
      } else if (currentStep === 'balance') {
        await handleSubmit();
      }
    } else if (selectedCard.id === 'vehicle') {
      if (currentStep === 'details') {
        if (formData.skipLoanDetails) {
          await handleSubmit();
        } else {
          setCurrentStep('loan-search');
        }
      } else if (currentStep === 'loan-search') {
        setCurrentStep('loan-details');
      } else if (currentStep === 'loan-details') {
        await handleSubmit();
      }
    } else if (selectedCard.id === 'property') {
      if (currentStep === 'details') {
        if (formData.skipMortgageDetails) {
          await handleSubmit();
        } else {
          setCurrentStep('loan-search');
        }
      } else if (currentStep === 'loan-search') {
        setCurrentStep('loan-details');
      } else if (currentStep === 'loan-details') {
        await handleSubmit();
      }
    } else if (selectedCard.id === 'investments' || selectedCard.id === 'loans') {
      if (currentStep === 'details') {
        await handleSubmit();
      }
    } else if (selectedCard.id === 'budget') {
      if (currentStep === 'details') {
        await handleSubmit();
      }
    }
  };

  const renderProgressBar = () => {
    const total = getTotalSteps();
    const current = getCurrentStepNumber();
    const progressPercentage = (current / total) * 100;

    return (
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    );
  };

  const renderSelectType = () => (
    <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
      {ACCOUNT_TYPE_CARDS.map(card => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            className="flex flex-col items-center cursor-pointer transition-all hover:scale-105"
            onClick={() => handleCardSelect(card)}
          >
            <div
              className="rounded-[22%] w-20 h-20 flex items-center justify-center shadow-lg hover:shadow-xl transition-all mb-2"
              style={{ backgroundColor: card.bgColor }}
            >
              <IconComponent className={`w-10 h-10 ${card.iconColor}`} strokeWidth={2} />
            </div>
            <span className="text-xs font-medium text-gray-700 text-center leading-tight max-w-[80px]">{card.title}</span>
          </div>
        );
      })}
    </div>
  );

  const renderSelectSubtype = () => {
    return (
      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
        {selectedCard.subtypes.map(subtype => {
          const IconComponent = subtype.icon || selectedCard.icon;
          return (
            <div
              key={subtype.value}
              className="flex flex-col items-center cursor-pointer transition-all hover:scale-105"
              onClick={() => handleSubtypeSelect(subtype)}
            >
              <div
                className="rounded-[22%] w-20 h-20 flex items-center justify-center shadow-lg hover:shadow-xl transition-all mb-2"
                style={{ backgroundColor: selectedCard.bgColor }}
              >
                <IconComponent className={`w-10 h-10 ${selectedCard.iconColor}`} strokeWidth={2} />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight max-w-[80px]">{subtype.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDetailsStep = () => {
    if (selectedCard.id === 'banking') {
      return (
        <div className="space-y-5 max-w-lg mx-auto">
          <div>
            <Label htmlFor="name">Account Nickname*</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="e.g., Chase Freedom, Main Checking"
              required
            />
          </div>
          <div>
            <Label htmlFor="institutionName">Institution Name</Label>
            <Input
              id="institutionName"
              value={formData.institutionName || ''}
              onChange={(e) => updateFormData('institutionName', e.target.value)}
              placeholder="e.g., Chase, Bank of America"
            />
          </div>
          <div>
            <Label htmlFor="last4">Last 4 Digits</Label>
            <Input
              id="last4"
              value={formData.last4 || ''}
              onChange={(e) => updateFormData('last4', e.target.value)}
              placeholder="1234"
              maxLength={4}
            />
          </div>
        </div>
      );
    } else if (selectedCard.id === 'vehicle') {
      const currentYear = new Date().getFullYear();
      return (
        <div className="space-y-2.5 max-w-lg mx-auto">
          <div>
            <Label htmlFor="displayName" className="text-sm mb-1">Display Name*</Label>
            <Input
              id="displayName"
              value={formData.displayName || ''}
              onChange={(e) => updateFormData('displayName', e.target.value)}
              placeholder="My Truck"
              className="h-9"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="year" className="text-sm mb-1">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year || ''}
                onChange={(e) => updateFormData('year', e.target.value)}
                placeholder="2024"
                min="1900"
                max={currentYear + 1}
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="make" className="text-sm mb-1">Make</Label>
              <Input
                id="make"
                value={formData.make || ''}
                onChange={(e) => updateFormData('make', e.target.value)}
                placeholder="Toyota"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="model" className="text-sm mb-1">Model</Label>
              <Input
                id="model"
                value={formData.model || ''}
                onChange={(e) => updateFormData('model', e.target.value)}
                placeholder="Camry"
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="vin" className="text-sm mb-1">VIN</Label>
              <Input
                id="vin"
                value={formData.vin || ''}
                onChange={(e) => updateFormData('vin', e.target.value)}
                placeholder="1HGBH41JXMN109186"
                maxLength={17}
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="currentValue" className="text-sm mb-1">Estimated Value*</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <Input
                  id="currentValue"
                  type="text"
                  value={formatAmountField('currentValue', formData.currentValue, focusedFields.currentValue)}
                  onChange={(e) => handleAmountChange('currentValue', e.target.value)}
                  onFocus={() => setFocusedFields(prev => ({ ...prev, currentValue: true }))}
                  onBlur={(e) => handleAmountBlur('currentValue', e.target.value)}
                  placeholder="0.00"
                  className="pl-7 h-9"
                  required
                />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="skipLoanDetails"
              checked={formData.skipLoanDetails || false}
              onCheckedChange={(checked) => updateFormData('skipLoanDetails', checked)}
            />
            <Label htmlFor="skipLoanDetails" className="cursor-pointer font-normal text-sm">
              Create without loan details
            </Label>
          </div>
        </div>
      );
    } else if (selectedCard.id === 'property') {
      return (
        <div className="space-y-2.5 max-w-lg mx-auto">
          <div>
            <Label htmlFor="displayName" className="text-sm mb-1">Display Name*</Label>
            <Input
              id="displayName"
              value={formData.displayName || ''}
              onChange={(e) => updateFormData('displayName', e.target.value)}
              placeholder="Main Residence"
              className="h-9"
              required
            />
          </div>
          <div>
            <Label htmlFor="address" className="text-sm mb-1">Address</Label>
            <Input
              id="address"
              value={formData.address || ''}
              onChange={(e) => updateFormData('address', e.target.value)}
              placeholder="123 Main St"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="city" className="text-sm mb-1">City</Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => updateFormData('city', e.target.value)}
                placeholder="New York"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="state" className="text-sm mb-1">State</Label>
              <Input
                id="state"
                value={formData.state || ''}
                onChange={(e) => updateFormData('state', e.target.value)}
                placeholder="NY"
                className="h-9"
                maxLength={2}
              />
            </div>
            <div>
              <Label htmlFor="zip" className="text-sm mb-1">ZIP Code</Label>
              <Input
                id="zip"
                value={formData.zip || ''}
                onChange={(e) => updateFormData('zip', e.target.value)}
                placeholder="10001"
                className="h-9"
                maxLength={10}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="propertyType" className="text-sm mb-1">Property Type</Label>
              <Select
                value={formData.propertyType || ''}
                onValueChange={(value) => updateFormData('propertyType', value)}
              >
                <SelectTrigger id="propertyType" className="h-9">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="squareFeet" className="text-sm mb-1">Square Feet</Label>
              <Input
                id="squareFeet"
                type="number"
                value={formData.squareFeet || ''}
                onChange={(e) => updateFormData('squareFeet', e.target.value)}
                placeholder="2000"
                min="0"
                className="h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="bedrooms" className="text-sm mb-1">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                step="0.5"
                value={formData.bedrooms || ''}
                onChange={(e) => updateFormData('bedrooms', e.target.value)}
                placeholder="3"
                min="0"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="bathrooms" className="text-sm mb-1">Bathrooms</Label>
              <Input
                id="bathrooms"
                type="number"
                step="0.5"
                value={formData.bathrooms || ''}
                onChange={(e) => updateFormData('bathrooms', e.target.value)}
                placeholder="2"
                min="0"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="currentValue" className="text-sm mb-1">Current Value*</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <Input
                  id="currentValue"
                  type="text"
                  value={formatAmountField('currentValue', formData.currentValue, focusedFields.currentValue)}
                  onChange={(e) => handleAmountChange('currentValue', e.target.value)}
                  onFocus={() => setFocusedFields(prev => ({ ...prev, currentValue: true }))}
                  onBlur={(e) => handleAmountBlur('currentValue', e.target.value)}
                  placeholder="0.00"
                  className="pl-7 h-9"
                  required
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="purchasePrice" className="text-sm mb-1">Purchase Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <Input
                  id="purchasePrice"
                  type="text"
                  value={formatAmountField('purchasePrice', formData.purchasePrice, focusedFields.purchasePrice)}
                  onChange={(e) => handleAmountChange('purchasePrice', e.target.value)}
                  onFocus={() => setFocusedFields(prev => ({ ...prev, purchasePrice: true }))}
                  onBlur={(e) => handleAmountBlur('purchasePrice', e.target.value)}
                  placeholder="0.00"
                  className="pl-7 h-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="purchaseDate" className="text-sm mb-1">Purchase Date</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={formData.purchaseDate || ''}
                onChange={(e) => updateFormData('purchaseDate', e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="skipMortgageDetails"
              checked={formData.skipMortgageDetails || false}
              onCheckedChange={(checked) => updateFormData('skipMortgageDetails', checked)}
            />
            <Label htmlFor="skipMortgageDetails" className="cursor-pointer font-normal text-sm">
              Create without mortgage details
            </Label>
          </div>
        </div>
      );
    } else if (selectedCard.id === 'investments') {
      return (
        <div className="space-y-5 max-w-lg mx-auto">
          <div>
            <Label htmlFor="name">Account Name*</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="e.g., Fidelity 401k, Robinhood, Coinbase"
              required
            />
          </div>
          <div>
            <Label htmlFor="institutionName">Institution Name*</Label>
            <Input
              id="institutionName"
              value={formData.institutionName || ''}
              onChange={(e) => updateFormData('institutionName', e.target.value)}
              placeholder="e.g., Fidelity, Vanguard, Coinbase"
              required
            />
          </div>
          <div>
            <Label htmlFor="currentValue">Current Value*</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="currentValue"
                type="text"
                value={formatAmountField('currentValue', formData.currentValue, focusedFields.currentValue)}
                onChange={(e) => handleAmountChange('currentValue', e.target.value)}
                onFocus={() => setFocusedFields(prev => ({ ...prev, currentValue: true }))}
                onBlur={(e) => handleAmountBlur('currentValue', e.target.value)}
                placeholder="0.00"
                className="pl-7"
                required
              />
            </div>
          </div>
        </div>
      );
    } else if (selectedCard.id === 'loans') {
      return (
        <div className="space-y-5 max-w-lg mx-auto">
          <div>
            <Label htmlFor="name">Loan Name*</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="e.g., Student Loan - Navient, Personal Loan - Wells Fargo"
              required
            />
          </div>
          <div>
            <Label htmlFor="currentBalance">Current Balance*</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="currentBalance"
                type="text"
                value={formatAmountField('currentBalance', formData.currentBalance, focusedFields.currentBalance)}
                onChange={(e) => handleAmountChange('currentBalance', e.target.value)}
                onFocus={() => setFocusedFields(prev => ({ ...prev, currentBalance: true }))}
                onBlur={(e) => handleAmountBlur('currentBalance', e.target.value)}
                placeholder="0.00"
                className="pl-7"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="lenderName">Lender/Creditor Name*</Label>
            <Input
              id="lenderName"
              value={formData.lenderName || ''}
              onChange={(e) => updateFormData('lenderName', e.target.value)}
              placeholder="e.g., Navient, Wells Fargo"
              required
            />
          </div>
        </div>
      );
    } else if (selectedCard.id === 'budget') {
      return (
        <div className="space-y-5 max-w-lg mx-auto">
          <div>
            <Label htmlFor="name">Category Name*</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="e.g., Freelance Income, Groceries"
              required
            />
          </div>
        </div>
      );
    }
  };

  const renderBalanceStep = () => (
    <div className="space-y-5 max-w-lg mx-auto">
      <div>
        <Label htmlFor="balance">Starting Balance</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
          <Input
            id="balance"
            type="text"
            value={formatAmountField('balance', formData.balance, focusedFields.balance)}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9.-]/g, '');
              updateFormData('balance', cleaned);
            }}
            onFocus={() => setFocusedFields(prev => ({ ...prev, balance: true }))}
            onBlur={(e) => handleAmountBlur('balance', e.target.value)}
            placeholder="0.00"
            className="pl-7"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="startDate">Starting Date</Label>
        <Input
          id="startDate"
          type="date"
          value={formData.startDate || ''}
          onChange={(e) => updateFormData('startDate', e.target.value)}
        />
      </div>
    </div>
  );

  const renderLoanDetailsStep = () => (
    <div className="space-y-4 max-w-lg mx-auto">
      <div>
        <Label htmlFor="loanInstitution">Lender Name*</Label>
        <Input
          id="loanInstitution"
          value={formData.loanInstitution || ''}
          onChange={(e) => updateFormData('loanInstitution', e.target.value)}
          placeholder="e.g., Wells Fargo, Chase Auto Finance"
          required
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="loanBalance">Current Balance*</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <Input
              id="loanBalance"
              type="text"
              value={formatAmountField('loanBalance', formData.loanBalance, focusedFields.loanBalance)}
              onChange={(e) => handleAmountChange('loanBalance', e.target.value)}
              onFocus={() => setFocusedFields(prev => ({ ...prev, loanBalance: true }))}
              onBlur={(e) => handleAmountBlur('loanBalance', e.target.value)}
              placeholder="0.00"
              className="pl-7"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="originalLoanAmount">Original Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <Input
              id="originalLoanAmount"
              type="text"
              value={formatAmountField('originalLoanAmount', formData.originalLoanAmount, focusedFields.originalLoanAmount)}
              onChange={(e) => handleAmountChange('originalLoanAmount', e.target.value)}
              onFocus={() => setFocusedFields(prev => ({ ...prev, originalLoanAmount: true }))}
              onBlur={(e) => handleAmountBlur('originalLoanAmount', e.target.value)}
              placeholder="0.00"
              className="pl-7"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="interestRate">Interest Rate (%)</Label>
          <div className="relative">
            <Input
              id="interestRate"
              type="text"
              value={formData.interestRate || ''}
              onChange={(e) => updateFormData('interestRate', e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              className="pr-7"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="monthlyPayment">Monthly Payment</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <Input
              id="monthlyPayment"
              type="text"
              value={formData.monthlyPayment || ''}
              onChange={(e) => updateFormData('monthlyPayment', e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              className="pl-7"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="paymentDueDate">Due Date (Day)</Label>
          <Input
            id="paymentDueDate"
            type="number"
            value={formData.paymentDueDate || ''}
            onChange={(e) => updateFormData('paymentDueDate', e.target.value)}
            placeholder="15"
            min="1"
            max="31"
          />
        </div>
        <div>
          <Label htmlFor="loanStartDate">Loan Start Date</Label>
          <Input
            id="loanStartDate"
            type="date"
            value={formData.loanStartDate || ''}
            onChange={(e) => updateFormData('loanStartDate', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Review Your {selectedCard.title}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Type:</span>
            <span className="font-medium">{selectedSubtype.label}</span>
          </div>
          {(formData.displayName || formData.name) && (
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium">{formData.displayName || formData.name}</span>
            </div>
          )}
          {formData.institutionName && (
            <div className="flex justify-between">
              <span className="text-gray-600">Institution:</span>
              <span className="font-medium">{formData.institutionName}</span>
            </div>
          )}
          {formData.lenderName && (
            <div className="flex justify-between">
              <span className="text-gray-600">Lender:</span>
              <span className="font-medium">{formData.lenderName}</span>
            </div>
          )}
          {formData.balance && (
            <div className="flex justify-between">
              <span className="text-gray-600">Balance:</span>
              <span className="font-medium">${parseFloat(formData.balance).toLocaleString()}</span>
            </div>
          )}
          {formData.currentValue && (
            <div className="flex justify-between">
              <span className="text-gray-600">Value:</span>
              <span className="font-medium">${parseFloat(formData.currentValue).toLocaleString()}</span>
            </div>
          )}
          {formData.currentBalance && (
            <div className="flex justify-between">
              <span className="text-gray-600">Balance:</span>
              <span className="font-medium">${parseFloat(formData.currentBalance).toLocaleString()}</span>
            </div>
          )}
          {formData.loanBalance && (
            <div className="flex justify-between">
              <span className="text-gray-600">Loan Balance:</span>
              <span className="font-medium">${parseFloat(formData.loanBalance).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderBankSearchStep = () => (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bankSearch">Search for your bank</Label>
          <div className="relative">
            <Input
              id="bankSearch"
              placeholder="Search for Chase, Wells Fargo, Bank of America..."
              disabled
              className="pl-3"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Institution integration coming soon.
          </p>
        </div>

        <div className="text-center">
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleBankSimulation}
          >
            Bank Simulation
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <div className="text-center">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-xs"
            onClick={handleNext}
          >
            Add Manually
          </Button>
        </div>
      </div>
    </div>
  );

  const renderLoanSearchStep = () => (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Search for your lender to securely connect your account
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lenderSearch">Search for your lender</Label>
          <div className="relative">
            <Input
              id="lenderSearch"
              placeholder="Search for Chase, Wells Fargo, etc..."
              disabled
              className="pl-3"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Institution integration coming soon.
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <div className="text-center">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-xs"
            onClick={handleNext}
          >
            Add Manually
          </Button>
        </div>
      </div>
    </div>
  );

  const renderConnectionModal = () => (
    <Dialog open={showConnectionModal} onOpenChange={() => {}}>
      <DialogContent className="w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-center">
            {connectionStatus === 'success' ? 'Connected Successfully!' : 'Connecting to Chase'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-8 flex flex-col items-center space-y-4">
          {connectionStatus === 'connecting' && (
            <>
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
              <p className="text-sm text-muted-foreground">Connecting to Chase Bank...</p>
            </>
          )}

          {connectionStatus === 'authenticating' && (
            <>
              <div className="relative">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
                <ShieldCheck className="w-8 h-8 text-green-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-sm text-muted-foreground">Authenticating your credentials...</p>
              <Progress value={66} className="w-full" />
            </>
          )}

          {connectionStatus === 'success' && (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-600" />
              <p className="text-sm text-muted-foreground">Successfully connected to Chase!</p>
              <Button
                className="mt-4 bg-blue-600 hover:bg-blue-700"
                onClick={handleConnectionContinue}
              >
                Continue
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderConfigureAccountsStep = () => {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="space-y-3">
          {mockBankAccounts.map(account => {
            const isChecked = checkedAccountIds.includes(account.id);
            const config = accountConfigurations[account.id];

            return (
              <Card key={account.id} className={isChecked ? 'border-blue-500' : ''}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={`account-${account.id}`}
                      checked={isChecked}
                      onCheckedChange={() => handleToggleAccount(account.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`account-${account.id}`}
                          className="text-base font-medium cursor-pointer"
                        >
                          {account.name} ...{account.last4}
                        </Label>
                        <span className={`text-sm font-medium ${account.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          ${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {isChecked && config && (
                        <div className="mt-4 space-y-3 pl-1">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label htmlFor={`displayName-${account.id}`} className="text-sm">Display Name*</Label>
                              <Input
                                id={`displayName-${account.id}`}
                                value={config.displayName}
                                onChange={(e) => updateAccountConfiguration(account.id, 'displayName', e.target.value)}
                                placeholder="Account name"
                                className="h-9 mt-1"
                              />
                            </div>

                            <div>
                              <Label htmlFor={`chart-account-${account.id}`} className="text-sm">
                                Chart of Accounts<span className="text-red-500">*</span>
                              </Label>
                              <div className="mt-1">
                                <ChartAccountDropdown
                                  value={config.chart_account_id || ''}
                                  onValueChange={(value) => updateAccountConfiguration(account.id, 'chart_account_id', value)}
                                  accountTypes={['asset', 'liability']}
                                  placeholder="Select account classification"
                                  triggerClassName="h-9"
                                  showAccountNumbers={true}
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm">Start Date*</Label>
                            <div className="flex gap-2 mt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant={config.startDatePreset === 'last_30' ? 'default' : 'outline'}
                                onClick={() => updateAccountConfiguration(account.id, 'startDatePreset', 'last_30')}
                                className="flex-1 h-9"
                              >
                                Last 30 days
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={config.startDatePreset === 'last_60' ? 'default' : 'outline'}
                                onClick={() => updateAccountConfiguration(account.id, 'startDatePreset', 'last_60')}
                                className="flex-1 h-9"
                              >
                                Last 60 days
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={config.startDatePreset === 'last_90' ? 'default' : 'outline'}
                                onClick={() => updateAccountConfiguration(account.id, 'startDatePreset', 'last_90')}
                                className="flex-1 h-9"
                              >
                                Last 90 days
                              </Button>
                            </div>
                            {config.startDatePreset === 'custom' && (
                              <Input
                                type="date"
                                value={config.startDate}
                                onChange={(e) => updateAccountConfiguration(account.id, 'startDate', e.target.value)}
                                className="h-9 mt-2"
                              />
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant={config.startDatePreset === 'custom' ? 'default' : 'outline'}
                              onClick={() => updateAccountConfiguration(account.id, 'startDatePreset', 'custom')}
                              className="w-full mt-2 h-9"
                            >
                              Custom date
                            </Button>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`goLiveDate-${account.id}`} className="text-sm">Go Live Date*</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-xs">
                                      Transactions before this date will be posted automatically. After this date, transactions will remain pending.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id={`goLiveDate-${account.id}`}
                              type="date"
                              value={config.goLiveDate}
                              onChange={(e) => updateAccountConfiguration(account.id, 'goLiveDate', e.target.value)}
                              className="h-9 mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select-type':
        return renderSelectType();
      case 'bank-search':
        return renderBankSearchStep();
      case 'configure-accounts':
        return renderConfigureAccountsStep();
      case 'select-subtype':
        return renderSelectSubtype();
      case 'details':
        return renderDetailsStep();
      case 'balance':
        return renderBalanceStep();
      case 'loan-search':
        return renderLoanSearchStep();
      case 'loan-details':
        return renderLoanDetailsStep();
      case 'review':
        return renderReviewStep();
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    if (currentStep === 'select-type') return 'Select Account Type';
    if (currentStep === 'bank-search') return 'Connect Bank Account';
    if (currentStep === 'configure-accounts') return 'Configure Accounts to Import';
    if (currentStep === 'select-subtype') return `Select ${selectedCard?.title} Type`;
    if (currentStep === 'details') {
      if (selectedCard?.id === 'banking') return 'Account Details';
      if (selectedCard?.id === 'vehicle') return 'Vehicle Details';
      if (selectedCard?.id === 'property') return 'Property Details';
      if (selectedCard?.id === 'investments') return 'Investment Details';
      if (selectedCard?.id === 'loans') return 'Loan Details';
      if (selectedCard?.id === 'budget') return 'Category Details';
    }
    if (currentStep === 'balance') return 'Starting Balance';
    if (currentStep === 'loan-search') return 'Connect Lender';
    if (currentStep === 'loan-details') {
      if (selectedCard?.id === 'property') return 'Mortgage Details';
      return 'Loan Details';
    }
    return '';
  };

  return (
    <>
      {renderConnectionModal()}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`${currentStep === 'configure-accounts' ? 'w-[800px] max-w-[90vw]' : 'w-[550px]'} p-0 ${(currentStep === 'select-type' || currentStep === 'select-subtype') ? 'bg-gradient-to-br from-slate-50 to-slate-100' : ''}`}>
          <div className={`relative flex flex-col ${currentStep === 'configure-accounts' ? 'h-[600px]' : 'h-[400px]'}`}>
            <DialogHeader className="pt-5 px-5 flex-shrink-0">
              <DialogTitle className="text-center text-xl">{getStepTitle()}</DialogTitle>
            </DialogHeader>

            <div className={`py-5 px-5 flex-1 overflow-y-auto ${(currentStep === 'select-type' || currentStep === 'select-subtype') ? 'flex items-center justify-center' : ''}`}>
              {renderCurrentStep()}
            </div>

            {currentStep !== 'select-type' && (
              <div className="flex justify-between gap-4 pt-4 pb-5 px-5 border-t flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="rounded-full px-6"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>

                {currentStep === 'bank-search' && <div />}

                {currentStep === 'select-subtype' && <div />}

                {currentStep === 'loan-search' && <div />}

                {currentStep === 'configure-accounts' && (
                  <Button
                    type="button"
                    className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                    onClick={handleNext}
                    disabled={!canProceed() || isLoading}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Finish
                  </Button>
                )}

              {currentStep === 'details' && (
                <Button
                  type="button"
                  className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                  onClick={handleNext}
                  disabled={!canProceed() || isLoading}
                >
                  {(selectedCard?.id === 'vehicle' && formData.skipLoanDetails) ||
                   (selectedCard?.id === 'property' && formData.skipMortgageDetails) ||
                   selectedCard?.id === 'investments' ||
                   selectedCard?.id === 'loans' ||
                   selectedCard?.id === 'budget' ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Finish
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              )}

              {currentStep === 'balance' && (
                <Button
                  type="button"
                  className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                  onClick={handleNext}
                  disabled={!canProceed() || isLoading}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Finish
                </Button>
              )}

              {currentStep === 'loan-details' && (
                <Button
                  type="button"
                  className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                  onClick={handleNext}
                  disabled={!canProceed() || isLoading}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Finish
                </Button>
              )}
            </div>
          )}

          {renderProgressBar()}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
