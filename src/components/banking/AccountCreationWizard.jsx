import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { validateAmount } from '../utils/validation';
import { withRetry, showErrorToast, logError } from '../utils/errorHandler';
import { toast } from 'sonner';
import { createVehicleAsset, createAutoLoan, createAssetLiabilityLink } from '@/api/vehiclesAndLoans';
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
  ShieldCheck
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
    subtypes: [
      { value: 'property_with_loan', label: 'With Loan', icon: Receipt },
      { value: 'property_without_loan', label: 'Without Loan', icon: ShieldCheck }
    ]
  },
  {
    id: 'investments',
    title: 'Investments',
    icon: TrendingUp,
    bgColor: '#FF7BAC',
    iconColor: 'text-white',
    subtypes: [
      { value: 'retirement', label: 'Retirement Account (401k, IRA, Roth)', icon: Landmark },
      { value: 'stocks', label: 'Stock', icon: TrendingUp },
      { value: 'crypto', label: 'Crypto', icon: BadgeDollarSign },
      { value: 'investment', label: 'Other Investments', icon: TrendingUp }
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
    if (card.subtypes && card.subtypes.length > 0) {
      setCurrentStep('select-subtype');
    } else {
      setSelectedSubtype({ value: card.id, label: card.title });
      setFormData({ subtype: card.id });
      setCurrentStep('details');
    }
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
    } else if (currentStep === 'loan-details' || currentStep === 'balance') {
      setCurrentStep('details');
    } else if (currentStep === 'review') {
      if (selectedCard.id === 'vehicle' && !formData.skipLoanDetails) {
        setCurrentStep('loan-details');
      } else if (selectedCard.id === 'property' && selectedSubtype.value === 'property_with_loan') {
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

        const vehicleData = {
          name: `${formData.year} ${formData.make} ${formData.model}`,
          year: parseInt(formData.year),
          make: formData.make.trim(),
          model: formData.model.trim(),
          vehicleType: formData.vehicleType || 'Other',
          vin: formData.vin || null,
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
    if (currentStep === 'select-type') return 5;
    if (!selectedCard) return 5;
    if (currentStep === 'select-subtype' || !selectedSubtype) {
      return selectedCard.id === 'budget' ? 4 : 5;
    }

    if (selectedCard.id === 'banking') return 5;
    if (selectedCard.id === 'vehicle') {
      return formData.skipLoanDetails ? 2 : 4;
    }
    if (selectedCard.id === 'property' && selectedSubtype.value === 'property_with_loan') return 6;
    if (selectedCard.id === 'property' && selectedSubtype.value === 'property_without_loan') return 5;
    if (selectedCard.id === 'investments') return 5;
    if (selectedCard.id === 'loans') return 5;
    if (selectedCard.id === 'budget') return 4;

    return 5;
  };

  const getCurrentStepNumber = () => {
    if (selectedCard?.id === 'vehicle') {
      const vehicleStepMap = {
        'select-type': 0,
        'details': 1,
        'loan-details': 2,
        'review': 3
      };
      return vehicleStepMap[currentStep] || 0;
    }

    const stepMap = {
      'select-type': 0,
      'select-subtype': 1,
      'details': 2,
      'balance': 3,
      'loan-details': 3,
      'review': getTotalSteps() - 1
    };
    return stepMap[currentStep] || 0;
  };

  const canProceed = () => {
    if (currentStep === 'details') {
      if (selectedCard.id === 'banking') {
        return formData.name && formData.name.trim();
      }
      if (selectedCard.id === 'vehicle') {
        return formData.year && formData.make && formData.make.trim() && formData.model && formData.model.trim() && formData.currentValue;
      }
      if (selectedCard.id === 'property') {
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

  const handleNext = async () => {
    if (selectedCard.id === 'banking') {
      if (currentStep === 'details') {
        setCurrentStep('balance');
      } else if (currentStep === 'balance') {
        setCurrentStep('review');
      }
    } else if (selectedCard.id === 'vehicle') {
      if (currentStep === 'details') {
        if (formData.skipLoanDetails) {
          await handleSubmit();
        } else {
          setCurrentStep('loan-details');
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
    <div className="grid grid-cols-3 gap-[20px] max-w-md mx-auto">
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
      <div className="grid grid-cols-3 gap-[20px] max-w-md mx-auto">
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
        <div className="space-y-4 max-w-lg mx-auto">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="year">Year*</Label>
              <Input
                id="year"
                type="number"
                value={formData.year || ''}
                onChange={(e) => updateFormData('year', e.target.value)}
                placeholder="2024"
                min="1900"
                max={currentYear + 1}
                required
              />
            </div>
            <div>
              <Label htmlFor="make">Make*</Label>
              <Input
                id="make"
                value={formData.make || ''}
                onChange={(e) => updateFormData('make', e.target.value)}
                placeholder="Toyota"
                required
              />
            </div>
            <div>
              <Label htmlFor="model">Model*</Label>
              <Input
                id="model"
                value={formData.model || ''}
                onChange={(e) => updateFormData('model', e.target.value)}
                placeholder="Camry"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vin">VIN (Optional)</Label>
              <Input
                id="vin"
                value={formData.vin || ''}
                onChange={(e) => updateFormData('vin', e.target.value)}
                placeholder="1HGBH41JXMN109186"
                maxLength={17}
              />
            </div>
            <div>
              <Label htmlFor="currentValue">Estimated Value*</Label>
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
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="skipLoanDetails"
              checked={formData.skipLoanDetails || false}
              onCheckedChange={(checked) => updateFormData('skipLoanDetails', checked)}
            />
            <Label htmlFor="skipLoanDetails" className="cursor-pointer font-normal">
              Create without loan details
            </Label>
          </div>
        </div>
      );
    } else if (selectedCard.id === 'property') {
      return (
        <div className="space-y-5 max-w-lg mx-auto">
          <div>
            <Label htmlFor="name">Property Name*</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="e.g., Main Residence, Beach House"
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="loanBalance">Current Balance*</Label>
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
          <Label htmlFor="originalLoanAmount">Original Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <Input
              id="originalLoanAmount"
              type="text"
              value={formData.originalLoanAmount || ''}
              onChange={(e) => updateFormData('originalLoanAmount', e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              className="pl-7"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
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
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paymentDueDate">Payment Due Date (Day of Month)</Label>
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
      <DialogContent className={`w-[550px] p-0 ${(currentStep === 'select-type' || currentStep === 'select-subtype') ? 'bg-gradient-to-br from-slate-50 to-slate-100' : ''}`}>
        <div className="relative flex flex-col h-[400px]">
          <DialogHeader className="pt-5 px-5 flex-shrink-0">
            <DialogTitle className="text-center text-xl">{getStepTitle()}</DialogTitle>
          </DialogHeader>

          <div className="py-5 px-5 flex-1 overflow-y-auto flex flex-col justify-center">
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

              {currentStep === 'select-subtype' && <div />}

              {currentStep === 'details' && (
                <Button
                  type="button"
                  className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                  onClick={handleNext}
                  disabled={!canProceed() || isLoading}
                >
                  {selectedCard?.id === 'vehicle' && formData.skipLoanDetails ? 'Finish' : 'Next'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}

              {currentStep === 'balance' && (
                <Button
                  type="button"
                  className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                  onClick={handleNext}
                  disabled={!canProceed() || isLoading}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}

              {currentStep === 'loan-details' && (
                <Button
                  type="button"
                  className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
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
                  className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Create
                </Button>
              )}
            </div>
          )}

          {renderProgressBar()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
