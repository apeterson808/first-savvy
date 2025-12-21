import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { validateAmount } from '../utils/validation';
import { withRetry, showErrorToast, logError } from '../utils/errorHandler';
import { toast } from 'sonner';
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
  Check
} from 'lucide-react';

const ACCOUNT_TYPE_CARDS = [
  {
    id: 'banking',
    title: 'Banking',
    icon: Building2,
    color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    iconColor: 'text-blue-600',
    subtypes: [
      { value: 'checking', label: 'Checking' },
      { value: 'savings', label: 'Savings' },
      { value: 'credit_card', label: 'Credit Card' }
    ]
  },
  {
    id: 'vehicle',
    title: 'Vehicle',
    icon: Car,
    color: 'bg-green-50 hover:bg-green-100 border-green-200',
    iconColor: 'text-green-600',
    subtypes: [
      { value: 'vehicle_with_loan', label: 'With Loan' },
      { value: 'vehicle_without_loan', label: 'Without Loan' }
    ]
  },
  {
    id: 'property',
    title: 'Property',
    icon: Home,
    color: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    iconColor: 'text-orange-600',
    subtypes: [
      { value: 'property_with_loan', label: 'With Loan' },
      { value: 'property_without_loan', label: 'Without Loan' }
    ]
  },
  {
    id: 'investments',
    title: 'Investments',
    icon: TrendingUp,
    color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    iconColor: 'text-purple-600',
    subtypes: [
      { value: 'retirement', label: 'Retirement Account (401k, IRA, Roth)' },
      { value: 'stocks', label: 'Stock' },
      { value: 'crypto', label: 'Crypto' },
      { value: 'investment', label: 'Other Investments' }
    ]
  },
  {
    id: 'loans',
    title: 'Loans & Debts',
    icon: FileText,
    color: 'bg-red-50 hover:bg-red-100 border-red-200',
    iconColor: 'text-red-600',
    subtypes: [
      { value: 'personal_loan', label: 'Personal' },
      { value: 'student_loan', label: 'Student' },
      { value: 'medical_debt', label: 'Medical' }
    ]
  },
  {
    id: 'budget',
    title: 'Budget Category',
    icon: DollarSign,
    color: 'bg-teal-50 hover:bg-teal-100 border-teal-200',
    iconColor: 'text-teal-600',
    subtypes: [
      { value: 'income', label: 'Income' },
      { value: 'expense', label: 'Expense' }
    ]
  }
];

export default function AccountCreationWizard({ open, onOpenChange, onAccountCreated }) {
  const [currentStep, setCurrentStep] = useState('select-type');
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedSubtype, setSelectedSubtype] = useState(null);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

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
  };

  const handleCardSelect = (card) => {
    setSelectedCard(card);
    setCurrentStep('select-subtype');
  };

  const handleSubtypeSelect = (subtype) => {
    setSelectedSubtype(subtype);
    setFormData({ subtype: subtype.value });
    setCurrentStep('details');
  };

  const handleBack = () => {
    if (currentStep === 'select-subtype') {
      setCurrentStep('select-type');
      setSelectedCard(null);
    } else if (currentStep === 'details') {
      setCurrentStep('select-subtype');
      setSelectedSubtype(null);
      setFormData({});
    } else if (currentStep === 'loan-details' || currentStep === 'balance') {
      setCurrentStep('details');
    } else if (currentStep === 'review') {
      if (selectedCard.id === 'vehicle' && selectedSubtype.value === 'vehicle_with_loan') {
        setCurrentStep('loan-details');
      } else if (selectedCard.id === 'property' && selectedSubtype.value === 'property_with_loan') {
        setCurrentStep('loan-details');
      } else {
        setCurrentStep('balance');
      }
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createAccountMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.Account.create(data)),
    onSuccess: (newAccount) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
      onAccountCreated?.({ type: newAccount.account_type, account: newAccount });
      toast.success('Account created successfully!');
      onOpenChange(false);
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
    },
    onError: (error) => {
      logError(error, { action: 'createCategory' });
      showErrorToast(error);
    }
  });

  const handleSubmit = async () => {
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

        const assetData = {
          name: formData.name,
          type: 'vehicle',
          current_balance: balanceValidation.value,
          description: formData.purchaseDate ? `Purchased: ${formData.purchaseDate}` : null,
          is_active: true
        };

        const newAsset = await createAssetMutation.mutateAsync(assetData);

        if (selectedSubtype.value === 'vehicle_with_loan' && formData.loanBalance) {
          const loanBalanceValidation = validateAmount(formData.loanBalance, {
            allowZero: false,
            allowNegative: false
          });
          if (!loanBalanceValidation.valid) {
            toast.error(loanBalanceValidation.error);
            return;
          }

          await createLiabilityMutation.mutateAsync({
            name: `${formData.name} Loan`,
            type: 'car_loan',
            current_balance: loanBalanceValidation.value,
            institution: formData.loanInstitution || null,
            is_active: true
          });
        }
      } else if (selectedCard.id === 'property') {
        const balanceValidation = validateAmount(formData.currentValue || '0', {
          allowZero: true,
          allowNegative: false
        });
        if (!balanceValidation.valid) {
          toast.error(balanceValidation.error);
          return;
        }

        const assetData = {
          name: formData.name,
          type: 'property',
          current_balance: balanceValidation.value,
          description: formData.purchaseDate ? `Purchased: ${formData.purchaseDate}` : null,
          is_active: true
        };

        const newAsset = await createAssetMutation.mutateAsync(assetData);

        if (selectedSubtype.value === 'property_with_loan' && formData.loanBalance) {
          const loanBalanceValidation = validateAmount(formData.loanBalance, {
            allowZero: false,
            allowNegative: false
          });
          if (!loanBalanceValidation.valid) {
            toast.error(loanBalanceValidation.error);
            return;
          }

          await createLiabilityMutation.mutateAsync({
            name: `${formData.name} Mortgage`,
            type: 'mortgage',
            current_balance: loanBalanceValidation.value,
            institution: formData.loanInstitution || null,
            is_active: true
          });
        }
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
    }
  };

  const isLoading =
    createAccountMutation.isPending ||
    createAssetMutation.isPending ||
    createLiabilityMutation.isPending ||
    createCategoryMutation.isPending;

  const getTotalSteps = () => {
    if (!selectedCard || !selectedSubtype) return 0;

    if (selectedCard.id === 'banking') return 3;
    if (selectedCard.id === 'vehicle' && selectedSubtype.value === 'vehicle_with_loan') return 4;
    if (selectedCard.id === 'vehicle' && selectedSubtype.value === 'vehicle_without_loan') return 3;
    if (selectedCard.id === 'property' && selectedSubtype.value === 'property_with_loan') return 4;
    if (selectedCard.id === 'property' && selectedSubtype.value === 'property_without_loan') return 3;
    if (selectedCard.id === 'investments') return 3;
    if (selectedCard.id === 'loans') return 3;
    if (selectedCard.id === 'budget') return 2;

    return 0;
  };

  const getCurrentStepNumber = () => {
    const stepMap = {
      'select-type': 0,
      'select-subtype': 1,
      'details': 2,
      'balance': 3,
      'loan-details': 3,
      'review': getTotalSteps()
    };
    return stepMap[currentStep] || 0;
  };

  const canProceed = () => {
    if (currentStep === 'details') {
      if (selectedCard.id === 'banking') {
        return formData.name && formData.name.trim();
      }
      if (selectedCard.id === 'vehicle' || selectedCard.id === 'property') {
        return formData.name && formData.name.trim() && formData.currentValue;
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

  const handleNext = () => {
    if (selectedCard.id === 'banking') {
      if (currentStep === 'details') {
        setCurrentStep('balance');
      } else if (currentStep === 'balance') {
        setCurrentStep('review');
      }
    } else if (selectedCard.id === 'vehicle') {
      if (currentStep === 'details') {
        if (selectedSubtype.value === 'vehicle_with_loan') {
          setCurrentStep('loan-details');
        } else {
          setCurrentStep('review');
        }
      } else if (currentStep === 'loan-details') {
        setCurrentStep('review');
      }
    } else if (selectedCard.id === 'property') {
      if (currentStep === 'details') {
        if (selectedSubtype.value === 'property_with_loan') {
          setCurrentStep('loan-details');
        } else {
          setCurrentStep('review');
        }
      } else if (currentStep === 'loan-details') {
        setCurrentStep('review');
      }
    } else if (selectedCard.id === 'investments' || selectedCard.id === 'loans') {
      if (currentStep === 'details') {
        setCurrentStep('review');
      }
    } else if (selectedCard.id === 'budget') {
      if (currentStep === 'details') {
        setCurrentStep('review');
      }
    }
  };

  const renderStepIndicator = () => {
    if (currentStep === 'select-type' || currentStep === 'select-subtype') return null;

    const total = getTotalSteps();
    const current = getCurrentStepNumber();

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {Array.from({ length: total }).map((_, idx) => (
          <div
            key={idx}
            className={`h-2 rounded-full transition-all ${
              idx < current
                ? 'w-8 bg-blue-600'
                : idx === current
                ? 'w-12 bg-blue-600'
                : 'w-8 bg-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  const renderSelectType = () => (
    <div className="grid grid-cols-2 gap-4">
      {ACCOUNT_TYPE_CARDS.map(card => {
        const IconComponent = card.icon;
        return (
          <Card
            key={card.id}
            className={`cursor-pointer transition-all ${card.color} border-2 hover:shadow-md`}
            onClick={() => handleCardSelect(card)}
          >
            <CardContent className="flex flex-col items-center justify-center p-6 min-h-[140px]">
              <IconComponent className={`w-10 h-10 mb-3 ${card.iconColor}`} />
              <h3 className="font-semibold text-gray-900 text-center">{card.title}</h3>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderSelectSubtype = () => (
    <div className="space-y-3">
      {selectedCard.subtypes.map(subtype => (
        <div
          key={subtype.value}
          className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
          onClick={() => handleSubtypeSelect(subtype)}
        >
          <span className="font-medium text-gray-700">{subtype.label}</span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      ))}
    </div>
  );

  const renderDetailsStep = () => {
    if (selectedCard.id === 'banking') {
      return (
        <div className="space-y-4">
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
    } else if (selectedCard.id === 'vehicle' || selectedCard.id === 'property') {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">{selectedCard.id === 'vehicle' ? 'Vehicle Name*' : 'Property Name*'}</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder={selectedCard.id === 'vehicle' ? 'e.g., 2018 Honda Civic' : 'e.g., Main Residence, Beach House'}
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
                value={formData.currentValue || ''}
                onChange={(e) => updateFormData('currentValue', e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                className="pl-7"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="purchaseDate">Purchase Date</Label>
            <Input
              id="purchaseDate"
              type="date"
              value={formData.purchaseDate || ''}
              onChange={(e) => updateFormData('purchaseDate', e.target.value)}
            />
          </div>
        </div>
      );
    } else if (selectedCard.id === 'investments') {
      return (
        <div className="space-y-4">
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
                value={formData.currentValue || ''}
                onChange={(e) => updateFormData('currentValue', e.target.value.replace(/[^0-9.]/g, ''))}
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
        <div className="space-y-4">
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
                value={formData.currentBalance || ''}
                onChange={(e) => updateFormData('currentBalance', e.target.value.replace(/[^0-9.]/g, ''))}
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
        <div className="space-y-4">
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
    <div className="space-y-4">
      <div>
        <Label htmlFor="balance">Starting Balance</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
          <Input
            id="balance"
            type="text"
            value={formData.balance || ''}
            onChange={(e) => updateFormData('balance', e.target.value.replace(/[^0-9.-]/g, ''))}
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
    <div className="space-y-4">
      <div>
        <Label htmlFor="loanBalance">Loan Balance*</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
          <Input
            id="loanBalance"
            type="text"
            value={formData.loanBalance || ''}
            onChange={(e) => updateFormData('loanBalance', e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="pl-7"
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="interestRate">Interest Rate (%)</Label>
        <Input
          id="interestRate"
          type="text"
          value={formData.interestRate || ''}
          onChange={(e) => updateFormData('interestRate', e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0.00"
        />
      </div>
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
        <Label htmlFor="loanInstitution">Lender Name*</Label>
        <Input
          id="loanInstitution"
          value={formData.loanInstitution || ''}
          onChange={(e) => updateFormData('loanInstitution', e.target.value)}
          placeholder="e.g., Wells Fargo, Chase"
          required
        />
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Review Your {selectedCard.title}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Type:</span>
            <span className="font-medium">{selectedSubtype.label}</span>
          </div>
          {formData.name && (
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium">{formData.name}</span>
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

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select-type':
        return renderSelectType();
      case 'select-subtype':
        return renderSelectSubtype();
      case 'details':
        return renderDetailsStep();
      case 'balance':
        return renderBalanceStep();
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
    if (currentStep === 'loan-details') return 'Loan Details';
    if (currentStep === 'review') return 'Review & Create';
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {renderStepIndicator()}
          {renderCurrentStep()}
        </div>

        <div className="flex justify-between gap-3 pt-4 border-t">
          {currentStep !== 'select-type' && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}

          {currentStep === 'select-type' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="ml-auto"
            >
              Cancel
            </Button>
          )}

          {currentStep !== 'select-type' && currentStep !== 'select-subtype' && currentStep !== 'review' && (
            <Button
              type="button"
              className="ml-auto bg-blue-600 hover:bg-blue-700"
              onClick={handleNext}
              disabled={!canProceed() || isLoading}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}

          {currentStep === 'review' && (
            <Button
              type="button"
              className="ml-auto bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              <Check className="w-4 h-4 mr-1" />
              Create
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
