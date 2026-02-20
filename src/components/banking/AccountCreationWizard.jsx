import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { validateAmount } from '../utils/validation';
import { withRetry, showErrorToast, logError } from '../utils/errorHandler';
import { formatLabel, formatCurrency } from '../utils/formatters';
import { toast } from 'sonner';
import { createVehicleAsset, createAutoLoan, createAssetLiabilityLink } from '@/api/vehiclesAndLoans';
import { createPropertyAsset, createMortgage } from '@/api/propertiesAndMortgages';
import { activateTemplateAccount } from '@/api/chartOfAccounts';
import TypeDetailSelector from '@/components/common/TypeDetailSelector';
import AppearancePicker from '@/components/common/AppearancePicker';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { getIconComponent, suggestIconForName } from '../utils/iconMapper';
import { useTemplateAccountTypesByClass, useTemplateAccountDetailsByType } from '@/hooks/useChartOfAccounts';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery } from '@tanstack/react-query';
import CalculatorAmountInput from '@/components/common/CalculatorAmountInput';
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
  ChevronDown,
  Check,
  PiggyBank,
  Landmark,
  BadgeDollarSign,
  Receipt,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Info,
  Upload,
  FileUp,
  X,
  Search,
  Building,
  AlertCircle,
  Circle,
  RefreshCw
} from 'lucide-react';
import { processStatementFile, mapCsvToTransactions, calculateBeginningBalanceFromCurrent, parseDate } from './StatementProcessor';
import CsvColumnMapper from './CsvColumnMapper';
import AccountCombobox from '../common/AccountCombobox';
import { getTransactionDateRange } from '@/api/duplicateDetection';
import TransactionDateRangeSelector from './TransactionDateRangeSelector';
import {
  getAvailableInstitutions,
  simulateConnection,
  getInstitutionAccounts,
  getAccountTransactions
} from '@/api/bankSimulation';
import { createJournalEntry, createOpeningBalanceJournalEntry } from '@/api/journalEntries';
import { transferAutoDetectionAPI } from '@/api/transferAutoDetection';

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

const buildAccountTypeCardsFromTemplates = (templates) => {
  if (!templates || templates.length === 0) {
    return [];
  }

  const cards = [];

  const bankingSubtypes = [];
  const checkingTemplate = templates.find(t => t.account_detail === 'checking_account');
  if (checkingTemplate) {
    bankingSubtypes.push({
      value: 'checking',
      label: checkingTemplate.display_name,
      icon: Wallet,
      templateId: checkingTemplate.id
    });
  }

  const savingsTemplate = templates.find(t => t.account_detail === 'savings_account');
  if (savingsTemplate) {
    bankingSubtypes.push({
      value: 'savings',
      label: savingsTemplate.display_name,
      icon: PiggyBank,
      templateId: savingsTemplate.id
    });
  }

  const creditCardTemplate = templates.find(t => t.account_detail === 'personal_credit_card');
  if (creditCardTemplate) {
    bankingSubtypes.push({
      value: 'credit_card',
      label: creditCardTemplate.display_name,
      icon: CreditCard,
      templateId: creditCardTemplate.id
    });
  }

  if (bankingSubtypes.length > 0) {
    cards.push({
      id: 'banking',
      title: 'Banking',
      icon: Building2,
      bgColor: '#52A5CE',
      iconColor: 'text-white',
      subtypes: bankingSubtypes
    });
  }

  const hasVehicles = templates.some(t => t.account_type === 'vehicle');
  if (hasVehicles) {
    cards.push({
      id: 'vehicle',
      title: 'Vehicle',
      icon: Car,
      bgColor: '#AACC96',
      iconColor: 'text-white',
      subtypes: []
    });
  }

  const hasRealEstate = templates.some(t => t.account_type === 'real_estate');
  if (hasRealEstate) {
    cards.push({
      id: 'property',
      title: 'Property',
      icon: Home,
      bgColor: '#EF6F3C',
      iconColor: 'text-white',
      subtypes: []
    });
  }

  const investmentSubtypes = [];
  const investmentTemplates = templates.filter(t =>
    t.account_type === 'investments' &&
    !['primary_residence', 'secondary_residence', 'land', 'other_real_estate'].includes(t.account_detail)
  );

  investmentTemplates.forEach(template => {
    if (template.account_detail === 'account_401k' ||
        template.account_detail === 'traditional_ira' ||
        template.account_detail === 'roth_ira') {
      investmentSubtypes.push({
        value: 'retirement',
        label: template.display_name,
        icon: Landmark,
        templateId: template.id,
        accountDetail: template.account_detail
      });
    } else if (template.account_detail === 'crypto_wallet') {
      investmentSubtypes.push({
        value: 'crypto',
        label: template.display_name,
        icon: BadgeDollarSign,
        templateId: template.id,
        accountDetail: template.account_detail
      });
    } else if (template.account_detail === 'brokerage_account') {
      investmentSubtypes.push({
        value: 'stocks',
        label: template.display_name,
        icon: TrendingUp,
        templateId: template.id,
        accountDetail: template.account_detail
      });
    } else {
      investmentSubtypes.push({
        value: 'investment',
        label: template.display_name,
        icon: TrendingUp,
        templateId: template.id,
        accountDetail: template.account_detail
      });
    }
  });

  if (investmentSubtypes.length > 0) {
    cards.push({
      id: 'investments',
      title: 'Investments',
      icon: TrendingUp,
      bgColor: '#FF7BAC',
      iconColor: 'text-white',
      subtypes: investmentSubtypes
    });
  }

  const loanSubtypes = [];
  const loanTemplates = templates.filter(t =>
    t.account_type === 'loans' &&
    !['mortgage_primary', 'mortgage_secondary', 'auto_loan', 'rv_loan'].includes(t.account_detail)
  );

  loanTemplates.forEach(template => {
    let icon = FileText;
    let value = template.account_detail;

    if (template.account_detail === 'personal_loan') {
      icon = FileText;
      value = 'personal_loan';
    } else if (template.account_detail === 'student_loan') {
      icon = FileText;
      value = 'student_loan';
    } else if (template.account_detail === 'medical_debt') {
      icon = FileText;
      value = 'medical_debt';
    }

    loanSubtypes.push({
      value,
      label: template.display_name,
      icon,
      templateId: template.id,
      accountDetail: template.account_detail
    });
  });

  if (loanSubtypes.length > 0) {
    cards.push({
      id: 'loans',
      title: 'Loans & Debts',
      icon: FileText,
      bgColor: '#6D1F42',
      iconColor: 'text-white',
      subtypes: loanSubtypes
    });
  }

  const hasIncome = templates.some(t => t.class === 'income');
  const hasExpense = templates.some(t => t.class === 'expense');

  if (hasIncome || hasExpense) {
    cards.push({
      id: 'budget',
      title: 'Budget Category',
      icon: DollarSign,
      bgColor: '#EFCE7B',
      iconColor: 'text-white',
      subtypes: []
    });
  }

  return cards;
};

const formatAccountDisplayLabel = (displayName, last4, showSuffix) => {
  if (!displayName || !displayName.trim()) {
    return '';
  }

  if (!showSuffix) {
    return displayName;
  }

  if (!last4 || last4.trim() === '') {
    return displayName;
  }

  return `${displayName} (${last4})`;
};

const getNextAccountNumber = async (profileId, templateAccountNumber) => {
  const { data: existingAccounts, error } = await firstsavvy
    .from('user_chart_of_accounts')
    .select('account_number')
    .eq('profile_id', profileId)
    .eq('template_account_number', templateAccountNumber)
    .order('account_number', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching existing accounts:', error);
    return templateAccountNumber;
  }

  if (!existingAccounts || existingAccounts.length === 0) {
    return templateAccountNumber;
  }

  return existingAccounts[0].account_number + 1;
};

export default function AccountCreationWizard({
  open,
  onOpenChange,
  onAccountCreated,
  initialAccountType = null,
  initialSubtype = null,
  initialCategoryName = null,
  initialClass = null,
  editingCategory = null
}) {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [currentStep, setCurrentStep] = useState('select-type');
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedSubtype, setSelectedSubtype] = useState(null);
  const [formData, setFormData] = useState({});
  const [focusedFields, setFocusedFields] = useState({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const newItemRef = useRef(null);
  const balanceCsvFileInputRef = useRef(null);
  const csvMapperRef = useRef(null);
  const [mappedTransactions, setMappedTransactions] = useState([]);
  const [csvValidation, setCsvValidation] = useState({ isValid: false, transactionCount: 0, isBalanceExtraction: false });
  const [balanceData, setBalanceData] = useState(null);
  const [showBalanceImportDialog, setShowBalanceImportDialog] = useState(false);
  const [balanceImportStep, setBalanceImportStep] = useState('upload');
  const [balanceProcessedData, setBalanceProcessedData] = useState(null);
  const [isProcessingBalance, setIsProcessingBalance] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [showMappingSuccess, setShowMappingSuccess] = useState(false);

  const [csvHadBalanceColumn, setCsvHadBalanceColumn] = useState(false);
  const [csvMappingConfig, setCsvMappingConfig] = useState(null);
  const [calculationDiagnostics, setCalculationDiagnostics] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedAccountName, setSelectedAccountName] = useState('');
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [selectedCachedAccount, setSelectedCachedAccount] = useState(null);
  const [selectedStatements, setSelectedStatements] = useState([]);
  const [cacheImportMode, setCacheImportMode] = useState(false);

  // Category Management state
  const [selectedCategoryIdForTransaction, setSelectedCategoryIdForTransaction] = useState(null);
  const [currentlyEditingCategoryId, setCurrentlyEditingCategoryId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [justSavedCategoryId, setJustSavedCategoryId] = useState(null);

  const { data: chartAccounts = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['chart-accounts-templates'],
    queryFn: async () => {
      const { data, error } = await firstsavvy
        .from('chart_of_accounts_templates')
        .select('*')
        .order('class, sort_order, account_number');
      if (error) {
        console.error('Error fetching chart account templates:', error);
        return [];
      }
      return data || [];
    },
    enabled: open && !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });

  const accountTypeCards = React.useMemo(() => {
    return buildAccountTypeCardsFromTemplates(chartAccounts);
  }, [chartAccounts]);

  const { data: userChartAccounts = [] } = useQuery({
    queryKey: ['user-chart-accounts', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const { data, error } = await firstsavvy
        .from('user_chart_of_accounts')
        .select('*')
        .eq('profile_id', activeProfile.id)
        .order('account_number');
      if (error) {
        console.error('Error fetching user chart accounts:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!activeProfile?.id && open,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });

  const { data: existingAccounts = [] } = useQuery({
    queryKey: ['existing-bank-accounts', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const { data, error } = await firstsavvy
        .from('user_chart_of_accounts')
        .select('id, display_name, account_detail, institution_name, account_number_last4')
        .eq('profile_id', activeProfile.id)
        .in('account_detail', ['checking_account', 'savings_account', 'credit_card'])
        .order('display_name');
      if (error) {
        console.error('Error fetching existing accounts:', error);
        return [];
      }
      return (data || []).map(account => ({
        ...account,
        account_name: account.display_name,
        account_type: account.account_detail
      }));
    },
    enabled: !!activeProfile?.id && open,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (!open) {
      resetWizard();
      return;
    }

    if (initialAccountType && accountTypeCards.length > 0) {
      const card = accountTypeCards.find(c => c.id === initialAccountType);
      if (!card) return;

      setSelectedCard(card);

      if (initialAccountType === 'budget') {
        const classValue = initialClass || initialSubtype || null;
        setFormData({
          name: initialCategoryName || '',
          categoryClass: classValue,
          ...(editingCategory ? {
            name: editingCategory.display_name || editingCategory.account_detail || '',
            categoryClass: editingCategory.class || classValue,
            accountDetail: editingCategory.account_detail || '',
            parentAccountId: editingCategory.parent_account_id || null,
            icon: editingCategory.icon || '',
            color: editingCategory.color || '#52A5CE',
            iconManuallySet: true,
            isEditing: true,
            editingId: editingCategory.id
          } : {})
        });
        setCurrentStep('details');
      } else if (initialSubtype && card.subtypes) {
        const subtype = card.subtypes.find(s => s.value === initialSubtype);
        if (subtype) {
          setSelectedSubtype(subtype);
          setFormData(prev => {
            if (prev.name === initialCategoryName && prev.subtype === subtype.value) {
              return prev;
            }
            return {
              subtype: subtype.value,
              name: initialCategoryName || ''
            };
          });
          setCurrentStep('details');
        }
      }
    }
  }, [open, initialAccountType, initialSubtype, initialCategoryName, accountTypeCards.length]);

  // Set isDirty when creating new category with initial data
  useEffect(() => {
    if (selectedCard?.id === 'budget' && currentStep === 'details' && initialCategoryName && !currentlyEditingCategoryId) {
      setIsDirty(true);
    }
  }, [selectedCard?.id, currentStep, initialCategoryName, currentlyEditingCategoryId]);

  const resetWizard = () => {
    setCurrentStep('select-type');
    setSelectedCard(null);
    setSelectedSubtype(null);
    setFormData({});
    setSelectedCategoryIdForTransaction(null);
    setCurrentlyEditingCategoryId(null);
    setIsDirty(false);
    setJustSavedCategoryId(null);
    setMappedTransactions([]);
    setUploadedFile(null);
    setProcessedData(null);
    setProcessingStatus(null);
    setShowMappingSuccess(false);
    setCsvHadBalanceColumn(false);
    setCsvMappingConfig(null);
  };


  // Scroll to new item in budget category preview
  useEffect(() => {
    if (selectedCard?.id === 'budget' && currentStep === 'details' && formData.name && newItemRef.current) {
      setTimeout(() => {
        newItemRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
    }
  }, [formData.name, selectedCard?.id, currentStep]);

  // Auto-recalculate beginning balance when ending balance changes in bank-info or details step
  useEffect(() => {
    if ((currentStep === 'bank-info' || currentStep === 'details') && selectedSubtype?.value === 'credit_card' && formData.endingBalance && mappedTransactions.length > 0) {
      const endingBalance = parseFloat(formData.endingBalance) || 0;
      const beginningDate = formData.beginningBalanceDate;
      const endingDate = formData.endingBalanceDate;

      // Filter transactions within the date range if dates are available
      let transactionsToCalculate = mappedTransactions;
      if (beginningDate && endingDate) {
        const startDate = new Date(beginningDate);
        const endDate = new Date(endingDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        transactionsToCalculate = mappedTransactions.filter(txn => {
          const txnDate = new Date(txn.date);
          txnDate.setHours(0, 0, 0, 0);
          return txnDate >= startDate && txnDate <= endDate;
        });
      }

      // Calculate total charges and payments
      let totalCharges = 0;
      let totalPayments = 0;

      transactionsToCalculate.forEach(txn => {
        if (txn.type === 'expense') {
          totalCharges += txn.amount;
        } else if (txn.type === 'income') {
          totalPayments += txn.amount;
        }
      });

      // For credit cards: Beginning = Ending + Charges - Payments
      const beginningBalance = endingBalance + totalCharges - totalPayments;
      updateFormData('beginningBalance', beginningBalance.toFixed(2));
    }
  }, [formData.endingBalance, formData.beginningBalanceDate, formData.endingBalanceDate, currentStep, selectedSubtype?.value, mappedTransactions]);

  const handleCardSelect = (card) => {
    setSelectedCard(card);

    if (card.id === 'banking') {
      const defaultSubtype = card.subtypes?.[0] || { value: 'checking', label: 'Checking Account' };
      setSelectedSubtype(defaultSubtype);
      setFormData({ subtype: defaultSubtype.value });
      setCurrentStep('connect-bank');
      return;
    }

    if (card.subtypes && card.subtypes.length > 0) {
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
    if (currentStep === 'connect-bank') {
      setCurrentStep('select-type');
      setSelectedCard(null);
    } else if (currentStep === 'csv-mapping') {
      setCurrentStep('details');
      setProcessedData(null);
    } else if (currentStep === 'bank-info') {
      setCurrentStep('details');
    } else if (currentStep === 'select-subtype') {
      setCurrentStep('select-type');
      setSelectedCard(null);
    } else if (currentStep === 'details') {
      if (selectedCard?.id === 'banking') {
        setCurrentStep('connect-bank');
        setSelectedCachedAccount(null);
        setSelectedStatements([]);
        setCacheImportMode(false);
      } else if (selectedCard?.id === 'budget') {
        setCurrentStep('select-type');
        setSelectedCard(null);
        setSelectedSubtype(null);
        setFormData({});
      } else if (selectedCard?.subtypes && selectedCard.subtypes.length > 0) {
        setCurrentStep('select-subtype');
        setSelectedSubtype(null);
        setFormData({});
        setSelectedCachedAccount(null);
        setSelectedStatements([]);
        setCacheImportMode(false);
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

    // Mark form as dirty when budget category fields are changed
    if (selectedCard?.id === 'budget' && ['name', 'categoryClass', 'accountDetail', 'parentAccountId', 'icon', 'color'].includes(field)) {
      setIsDirty(true);
    }
  };

  const calculateBeginningBalanceFromEnding = () => {
    if (csvHadBalanceColumn) {
      setCalculationDiagnostics(null);
      return;
    }

    if (!mappedTransactions || mappedTransactions.length === 0) {
      setCalculationDiagnostics(null);
      return;
    }

    const endingBalance = parseFloat(formData.endingBalance) || 0;
    const asOfDate = formData.asOfDate;
    const endingDate = formData.endingDate;

    if (!asOfDate || !endingDate) {
      setCalculationDiagnostics(null);
      return;
    }

    const startDate = new Date(asOfDate);
    const endDate = new Date(endingDate);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const isLiability = selectedSubtype?.value === 'credit_card';

    const transactionsInRange = mappedTransactions.filter(txn => {
      const txnDate = new Date(txn.date);
      txnDate.setHours(0, 0, 0, 0);
      return txnDate >= startDate && txnDate <= endDate;
    });

    let calculatedBeginningBalance = endingBalance;
    let totalExpenses = 0;
    let totalIncome = 0;
    let expenseCount = 0;
    let incomeCount = 0;

    transactionsInRange.forEach(txn => {
      if (isLiability) {
        // Working backwards from ending balance for liabilities (credit cards):
        // - Expense: subtract (you hadn't made that purchase yet, so you owed less)
        // - Income/Payment: add (you hadn't made that payment yet, so you owed more)
        if (txn.type === 'expense') {
          calculatedBeginningBalance -= txn.amount;
          totalExpenses += txn.amount;
          expenseCount++;
        } else if (txn.type === 'income') {
          calculatedBeginningBalance += txn.amount;
          totalIncome += txn.amount;
          incomeCount++;
        }
      } else {
        // Working backwards from ending balance for assets (bank accounts):
        // - Expense: add (you hadn't spent that money yet, so you had more)
        // - Income: subtract (you hadn't received that money yet, so you had less)
        if (txn.type === 'expense') {
          calculatedBeginningBalance += txn.amount;
          totalExpenses += txn.amount;
          expenseCount++;
        } else if (txn.type === 'income') {
          calculatedBeginningBalance -= txn.amount;
          totalIncome += txn.amount;
          incomeCount++;
        }
      }
    });

    setCalculationDiagnostics({
      transactionCount: transactionsInRange.length,
      expenseCount,
      incomeCount,
      totalExpenses,
      totalIncome,
      endingBalance,
      calculatedBeginningBalance,
      isLiability,
      dateRange: { startDate: asOfDate, endDate: endingDate }
    });

    updateFormData('beginningBalance', calculatedBeginningBalance.toFixed(2));
  };



  const handleBalanceCsvUpload = async (file) => {
    if (!file) return;

    setIsProcessingBalance(true);
    try {
      const result = await processStatementFile(file);

      setBalanceProcessedData(result);

      if (result.type === 'transactions') {
        const transactions = result.transactions || [];
        if (transactions.length > 0) {
          const firstTxn = transactions[0];
          const lastTxn = transactions[transactions.length - 1];

          const beginningBal = result.beginningBalance ?? 0;
          const endingBal = result.endingBalance ?? result.newBalance ?? 0;
          const startDate = result.statementStartDate ?? parseDate(firstTxn.date);
          const endDate = result.statementEndDate ?? parseDate(lastTxn.date);

          setBalanceData({
            beginningBalance: beginningBal,
            endingBalance: endingBal,
            beginningDate: startDate,
            endingDate: endDate,
            fileName: file.name
          });

          updateFormData('beginningBalance', beginningBal.toFixed(2));
          updateFormData('asOfDate', startDate);
          updateFormData('endingBalance', endingBal.toFixed(2));
          updateFormData('endingDate', endDate);

          if (result.institutionName) {
            updateFormData('bankName', result.institutionName);
          }

          if (result.accountNumber) {
            updateFormData('accountNumberLast4', result.accountNumber);
          }

          const extractedFields = [];
          if (result.beginningBalance !== undefined) extractedFields.push('previous balance');
          if (result.endingBalance !== undefined) extractedFields.push('new balance');
          if (result.statementStartDate) extractedFields.push('statement start date');
          if (result.statementEndDate) extractedFields.push('statement end date');
          if (result.institutionName) extractedFields.push('institution name');
          if (result.accountNumber) extractedFields.push('account number');

          const message = extractedFields.length > 0
            ? `Extracted ${extractedFields.join(', ')} from statement`
            : 'Balance information extracted from file';

          toast.success(message);
          setShowBalanceImportDialog(false);
        }
      } else {
        setBalanceImportStep('mapping');
      }
    } catch (error) {
      console.error('Error processing balance file:', error);
      toast.error(error.message || 'Failed to process file');
    } finally {
      setIsProcessingBalance(false);
    }
  };

  const handleBalanceCsvMapping = async (mappingConfig) => {
    const { columnMappings, amountType, debitColumn, creditColumn } = mappingConfig;

    const accountClass = (selectedSubtype?.value === 'credit_card' || selectedCard?.id === 'loans') ? 'liability' : 'asset';

    const transactions = mapCsvToTransactions(
      balanceProcessedData,
      columnMappings,
      amountType,
      debitColumn,
      creditColumn,
      accountClass
    );

    if (transactions.length === 0) {
      toast.error('No transactions found in CSV');
      return;
    }

    const sortedTransactions = [...transactions].sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    const firstTxn = sortedTransactions[0];
    const lastTxn = sortedTransactions[sortedTransactions.length - 1];

    updateFormData('asOfDate', firstTxn.date);
    updateFormData('endingDate', lastTxn.date);
    updateFormData('beginningBalance', '0.00');
    updateFormData('endingBalance', '0.00');
    updateFormData('balance', '0.00');

    setBalanceData({
      beginningBalance: 0,
      endingBalance: 0,
      beginningDate: firstTxn.date,
      endingDate: lastTxn.date,
      fileName: balanceProcessedData.fileName || 'statement.csv'
    });

    setCsvHadBalanceColumn(false);
    setCsvMappingConfig(mappingConfig);
    setMappedTransactions(sortedTransactions);
    setProcessedData(balanceProcessedData);
    setProcessingStatus('success');

    toast.success(`${transactions.length} transactions ready to import. Please enter your ending balance to calculate the beginning balance.`);
    setShowBalanceImportDialog(false);
    setBalanceImportStep('upload');
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    setProcessingStatus('processing');
    setUploadedFile(file);
    setShowMappingSuccess(false);

    try {
      const result = await processStatementFile(file);
      setProcessedData(result);

      if (result.type === 'csv') {
        setCurrentStep('csv-mapping');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(error.message || 'Failed to process file');
      setUploadedFile(null);
      setProcessedData(null);
      setProcessingStatus(null);
      setCsvHadBalanceColumn(false);
      setCsvMappingConfig(null);
    }
  };

  const handleCsvMapping = async (mappingConfig) => {
    const { columnMappings, amountType, debitColumn, creditColumn, balanceColumn } = mappingConfig;

    const accountClass = (selectedSubtype?.value === 'credit_card' || selectedCard?.id === 'loans') ? 'liability' : 'asset';

    const transactions = mapCsvToTransactions(
      processedData,
      columnMappings,
      amountType,
      debitColumn,
      creditColumn,
      accountClass
    );

    if (transactions.length === 0) {
      toast.error('No transactions found in CSV');
      return;
    }

    setCsvHadBalanceColumn(!!balanceColumn);
    setCsvMappingConfig(mappingConfig);
    setMappedTransactions(transactions);
    setProcessingStatus('success');
    setShowMappingSuccess(true);

    // Auto-calculate dates and beginning balance for credit card accounts
    if (selectedSubtype?.value === 'credit_card' && transactions.length > 0) {
      const dateRange = getTransactionDateRange(transactions);
      updateFormData('beginningBalanceDate', dateRange.startDate);
      updateFormData('endingBalanceDate', dateRange.endDate);

      // If ending balance is already set, calculate beginning balance
      if (formData.endingBalance) {
        const endingBalance = parseFloat(formData.endingBalance) || 0;

        // Filter transactions within the date range
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const transactionsInRange = transactions.filter(txn => {
          const txnDate = new Date(txn.date);
          txnDate.setHours(0, 0, 0, 0);
          return txnDate >= startDate && txnDate <= endDate;
        });

        // Calculate total charges and payments
        let totalCharges = 0;
        let totalPayments = 0;

        transactionsInRange.forEach(txn => {
          if (txn.type === 'expense') {
            totalCharges += txn.amount;
          } else if (txn.type === 'income') {
            totalPayments += txn.amount;
          }
        });

        // For credit cards: Beginning = Ending + Charges - Payments
        const beginningBalance = endingBalance + totalCharges - totalPayments;
        updateFormData('beginningBalance', beginningBalance.toFixed(2));
      }
    }

    setCurrentStep('details');

    toast.success(`Successfully mapped ${transactions.length} transactions`);
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
    mutationFn: async (data) => {
      const detailMap = {
        'checking': 'checking_account',
        'savings': 'savings_account',
        'credit_card': 'personal_credit_card',
      };
      const accountDetail = detailMap[data.account_type] || data.account_type;

      const templateAccount = chartAccounts.find(a => a.account_detail === accountDetail);
      if (!templateAccount) {
        throw new Error(`No template found for type: ${accountDetail}`);
      }

      const existingAccount = userChartAccounts.find(
        a => a.template_account_number === templateAccount.account_number && a.is_active
      );

      if (!existingAccount) {
        const accountId = await activateTemplateAccount(activeProfile.id, templateAccount.account_number, {
          customDisplayName: data.account_name,
          initialBalance: data.current_balance,
          institutionName: data.institution_name,
          accountNumberLast4: data.account_number_last4,
          openingBalanceDate: data.as_of_date || new Date().toISOString().split('T')[0]
        });

        const { data: newAccount, error } = await firstsavvy
          .from('user_chart_of_accounts')
          .select()
          .eq('id', accountId)
          .single();

        if (error) throw error;
        return { ...newAccount, _usedActivateTemplate: true };
      } else {
        const accountNumber = await getNextAccountNumber(activeProfile.id, templateAccount.account_number);

        const { data: newAccount, error } = await firstsavvy
          .from('user_chart_of_accounts')
          .insert({
            profile_id: activeProfile.id,
            template_account_number: templateAccount.account_number,
            account_number: accountNumber,
            display_name: data.account_name,
            class: templateAccount.class,
            account_detail: templateAccount.account_detail,
            account_type: templateAccount.account_type,
            icon: templateAccount.icon,
            color: templateAccount.color,
            current_balance: data.current_balance,
            institution_name: data.institution_name,
            account_number_last4: data.account_number_last4,
            is_active: true,
            is_user_created: true
          })
          .select()
          .single();

        if (error) throw error;
        return { ...newAccount, _usedActivateTemplate: false };
      }
    },
    onSuccess: async (newAccount) => {
      // Create opening balance journal entry if there's an opening balance
      // current_balance contains the beginning balance (before imported transactions)
      if (newAccount.current_balance && newAccount.current_balance !== 0 && !newAccount._usedActivateTemplate) {
        try {
          const openingDate = formData.beginningBalanceDate || formData.asOfDate || new Date().toISOString().split('T')[0];
          await createOpeningBalanceJournalEntry({
            profileId: activeProfile.id,
            userId: user?.id,
            accountId: newAccount.id,
            openingBalance: newAccount.current_balance,
            openingDate: openingDate,
            accountName: newAccount.display_name,
            accountClass: newAccount.class
          });
        } catch (error) {
          console.error('Failed to create opening balance journal entry:', error);
          toast.error('Account created but failed to create opening balance entry');
        }
      }

      if (mappedTransactions.length > 0) {
        try {
          const startDate = formData.asOfDate;
          const transactionsToImport = startDate
            ? mappedTransactions.filter(txn => new Date(txn.date) >= new Date(startDate))
            : mappedTransactions;

          if (transactionsToImport.length > 0) {
            const transactionsWithAccount = transactionsToImport.map(txn => ({
              profile_id: activeProfile.id,
              user_id: user?.id,
              bank_account_id: newAccount.id,
              date: txn.date,
              description: txn.description,
              original_description: txn.original_description || txn.description,
              amount: txn.type === 'expense' ? -Math.abs(txn.amount) : Math.abs(txn.amount),
              type: txn.type,
              status: 'pending',
              source: 'csv',
              include_in_reports: true
            }));

            const { error: importError } = await firstsavvy
              .from('transactions')
              .insert(transactionsWithAccount);

            if (importError) {
              console.error('Failed to import transactions:', importError);
              toast.error(`Account created but failed to import ${transactionsToImport.length} transactions`);
            } else {
              const endingBalanceValue = parseFloat(formData.endingBalance);
              if (!isNaN(endingBalanceValue)) {
                const updateData = {
                  bank_balance: endingBalanceValue,
                  last_synced_at: new Date().toISOString()
                };

                if (formData.endingDate) {
                  updateData.last_statement_date = formData.endingDate;
                }

                const { error: balanceError } = await firstsavvy
                  .from('user_chart_of_accounts')
                  .update(updateData)
                  .eq('id', newAccount.id);

                if (balanceError) {
                  console.error('Error updating bank balance:', balanceError);
                }
              }

              toast.success(`Account created with ${transactionsToImport.length} transactions imported!`);
            }
          } else {
            toast.warning(`Account created but no transactions matched the date filter. ${mappedTransactions.length} transactions were before ${startDate}`);
          }
        } catch (error) {
          console.error('Error importing transactions:', error);
          toast.error('Account created but transaction import failed');
        }
      } else {
        toast.success('Account created successfully!');
      }

      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-lines-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['activeAccounts'] });
      onAccountCreated?.({ type: newAccount.account_type, account: newAccount });
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
    mutationFn: async (data) => {
      throw new Error('Asset creation should use createVehicleAsset or createPropertyAsset');
    },
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
    mutationFn: async (data) => {
      throw new Error('Liability creation should use createAutoLoan or createMortgage');
    },
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

  const saveCategoryMutation = useMutation({
    mutationFn: async (data) => {
      const template = chartAccounts.find(t => t.account_detail === data.accountDetail);
      if (!template) {
        throw new Error(`No template found for account detail: ${data.accountDetail}`);
      }

      // Check if we're updating an existing category or creating a new one
      if (data.categoryId) {
        // Update existing category
        const { data: updatedCategory, error } = await firstsavvy
          .from('user_chart_of_accounts')
          .update({
            display_name: data.name,
            parent_account_id: data.parentAccountId || null,
            icon: data.icon || template.icon,
            color: data.color || template.color,
            account_detail: template.account_detail
          })
          .eq('id', data.categoryId)
          .eq('profile_id', activeProfile.id)
          .select()
          .single();

        if (error) throw error;
        return { category: updatedCategory, isUpdate: true };
      } else {
        // Create new category
        const accountNumber = await getNextAccountNumber(activeProfile.id, template.account_number);

        const { data: newCategory, error } = await firstsavvy
          .from('user_chart_of_accounts')
          .insert({
            profile_id: activeProfile.id,
            template_account_number: template.account_number,
            account_number: accountNumber,
            display_name: data.name,
            class: template.class,
            account_detail: template.account_detail,
            account_type: template.account_type,
            parent_account_id: data.parentAccountId || null,
            icon: data.icon || template.icon,
            color: data.color || template.color,
            is_active: true,
            is_user_created: true
          })
          .select()
          .single();

        if (error) throw error;
        return { category: newCategory, isUpdate: false };
      }
    },
    onSuccess: async ({ category, isUpdate }) => {
      // Refetch queries to update the preview list
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['user-chart-accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['chart-accounts'] })
      ]);

      toast.success(isUpdate ? 'Category updated successfully!' : 'Category created successfully!');

      // Set the saved category as selected and mark it as just saved
      setSelectedCategoryIdForTransaction(category.id);
      setCurrentlyEditingCategoryId(category.id);
      setJustSavedCategoryId(category.id);
      setIsDirty(false);

      // Clear the "just saved" highlight after 3 seconds
      setTimeout(() => {
        setJustSavedCategoryId(null);
      }, 3000);

      // DO NOT close the modal - keep it open for continued editing
    },
    onError: (error) => {
      logError(error, { action: 'saveCategory' });
      showErrorToast(error);
    }
  });

  const handleSubmit = async () => {
    if (!selectedCard) return;
    if (selectedCard.id !== 'budget' && !selectedSubtype) return;

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

        // For accounts with transactions, use beginningBalance as the opening balance
        // For accounts without transactions, use the balance field
        const openingBalance = (mappedTransactions.length > 0 && formData.beginningBalance)
          ? parseFloat(formData.beginningBalance)
          : balanceValidation.value;

        await createAccountMutation.mutateAsync({
          account_name: formData.name,
          account_type: selectedSubtype.value,
          current_balance: openingBalance,
          institution_name: formData.institutionName || null,
          account_number_last4: formData.last4 || null,
          as_of_date: formData.beginningBalanceDate || formData.asOfDate || new Date().toISOString().split('T')[0],
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

        const newAsset = await createVehicleAsset(vehicleData, activeProfile.id);
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

          const newLoan = await createAutoLoan(loanData, activeProfile.id);
          await createAssetLiabilityLink(newAsset.id, newLoan.id, activeProfile.id);
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

        const newAsset = await createPropertyAsset(propertyData, activeProfile.id);
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

          const newMortgage = await createMortgage(mortgageData, activeProfile.id);
          await createAssetLiabilityLink(newAsset.id, newMortgage.id, activeProfile.id);
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
          current_balance: Math.abs(balanceValidation.value),
          institution: formData.lenderName || null,
          is_active: true
        });
      } else if (selectedCard.id === 'budget') {
        if (!formData.categoryClass) {
          toast.error('Please select Income or Expense');
          return;
        }
        if (!formData.accountDetail) {
          toast.error('Please select a category type');
          return;
        }
        await saveCategoryMutation.mutateAsync({
          categoryId: currentlyEditingCategoryId,
          name: formData.name,
          accountDetail: formData.accountDetail,
          type: formData.categoryClass,
          parentAccountId: formData.parentAccountId || null,
          icon: formData.icon || suggestIconForName(formData.name) || 'Circle',
          color: formData.color || '#52A5CE'
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
    saveCategoryMutation.isPending ||
    isCreatingAccount;

  const getTotalSteps = () => {
    if (currentStep === 'select-type') return 5;
    if (!selectedCard) return 5;
    if (currentStep === 'bank-search') return 5;
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
        'connect-bank': 1,
        'manual-entry': 2,
        'bank-search': 1,
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
    if (currentStep === 'details') {
      if (selectedCard.id === 'banking') {
        return (formData.displayName && formData.displayName.trim() &&
                uploadedFile &&
                mappedTransactions.length > 0 &&
                processingStatus === 'success');
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
        return formData.name && formData.name.trim() && formData.categoryClass && formData.accountDetail;
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

  const handleCreateAccountAndImportTransactions = async () => {
    if (!formData.displayName || mappedTransactions.length === 0) {
      toast.error('Display name and transactions are required');
      return;
    }

    setIsCreatingAccount(true);

    try {
      // Step 1: Create the account
      const balanceValidation = validateAmount(formData.beginningBalance || '0', {
        allowZero: true,
        allowNegative: true
      });
      if (!balanceValidation.valid) {
        toast.error(balanceValidation.error);
        setIsCreatingAccount(false);
        return;
      }

      const detailMap = {
        'checking': 'checking_account',
        'savings': 'savings_account',
        'credit_card': 'personal_credit_card',
      };
      const accountDetail = detailMap[selectedSubtype.value] || selectedSubtype.value;

      const templateAccount = chartAccounts.find(a => a.account_detail === accountDetail);
      if (!templateAccount) {
        throw new Error(`No template found for type: ${accountDetail}`);
      }

      const accountId = await activateTemplateAccount(activeProfile.id, templateAccount.account_number, {
        customDisplayName: formData.displayName,
        initialBalance: balanceValidation.value,
        institutionName: formData.institutionName || null,
        accountNumberLast4: formData.last4 || null,
        openingBalanceDate: formData.beginningBalanceDate || new Date().toISOString().split('T')[0]
      });

      const { data: newAccount, error: accountError } = await firstsavvy
        .from('user_chart_of_accounts')
        .select()
        .eq('id', accountId)
        .single();

      if (accountError) throw accountError;

      // Step 2: Update account with ending balance in bank_balance field
      if (formData.endingBalance) {
        await firstsavvy
          .from('user_chart_of_accounts')
          .update({ bank_balance: parseFloat(formData.endingBalance) })
          .eq('id', newAccount.id);
      }

      // Step 3: Opening balance journal entry is already created by activate_template_account
      // No need to create it again here

      // Step 4: Import all transactions as pending
      const pendingTransactions = mappedTransactions.map(txn => ({
        profile_id: activeProfile.id,
        user_id: user.id,
        bank_account_id: newAccount.id,
        date: txn.date,
        description: txn.description,
        original_description: txn.description,
        amount: txn.amount,
        type: txn.type,
        status: 'pending',
        source: 'csv',
        cleared_status: 'uncleared'
      }));

      const { error: insertError } = await firstsavvy
        .from('transactions')
        .insert(pendingTransactions);

      if (insertError) throw insertError;

      // Step 5: Invalidate queries and close dialog
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['account-journal-lines'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      toast.success(`Account created with ${mappedTransactions.length} transactions imported!`);
      onAccountCreated?.({ type: 'account', account: newAccount });
      onOpenChange(false);

      setTimeout(() => {
        navigate(`/Banking/account/${newAccount.id}`);
      }, 100);
    } catch (error) {
      console.error('Error creating account and importing transactions:', error);
      showErrorToast(error);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleNext = async () => {
    if (selectedCard.id === 'banking') {
      if (currentStep === 'bank-search') {
        setCurrentStep('details');
      } else if (currentStep === 'details') {
        if (!selectedAccountName || !uploadedFile || mappedTransactions.length === 0) {
          toast.error('Please select or enter an account name and upload a statement');
          return;
        }

        if (isExistingAccount) {
          await handleImportTransactions();
        } else {
          setCurrentStep('bank-info');
        }
      } else if (currentStep === 'bank-info') {
        await handleImportTransactions();
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

  const renderConnectBankStep = () => {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">
                  Plaid Integration Coming Soon!
                </h3>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 mt-1">
                  <Info className="w-3 h-3 mr-1" />
                  In Development
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-slate-500 mb-3">Add Manually</p>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            {selectedCard.subtypes.map(subtype => {
              const IconComponent = subtype.icon || selectedCard.icon;
              return (
                <div
                  key={subtype.value}
                  className="flex flex-col items-center cursor-pointer transition-all hover:scale-105"
                  onClick={() => {
                    setSelectedSubtype(subtype);
                    setFormData({ subtype: subtype.value });
                    setCurrentStep('details');
                  }}
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
        </div>
      </div>
    );
  };


  const renderSelectType = () => {
    if (isLoadingTemplates) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      );
    }

    if (accountTypeCards.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          No account types available. Please contact support.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
        {accountTypeCards.map(card => {
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
  };

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
      const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
      };

      const handleDragOver = (e) => {
        e.preventDefault();
      };

      const existingAccounts = userChartAccounts?.filter(acc =>
        acc.account_detail === (selectedSubtype?.value === 'checking' ? 'checking_account' :
                                selectedSubtype?.value === 'savings' ? 'savings_account' :
                                selectedSubtype?.value === 'credit_card' ? 'personal_credit_card' : '') &&
        acc.is_active === true
      ) || [];

      return (
        <div className="space-y-4 max-w-lg mx-auto">
          <div>
            <Label htmlFor="displayName">Display Name*</Label>
            <Input
              id="displayName"
              value={selectedAccountName || ''}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedAccountName(value);
                setSelectedAccountId(null);
                setIsExistingAccount(false);
                updateFormData('displayName', value);
              }}
              placeholder="Enter account name..."
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="institutionName">Bank/Institution</Label>
              <Input
                id="institutionName"
                value={formData.institutionName || ''}
                onChange={(e) => updateFormData('institutionName', e.target.value)}
                placeholder="e.g., Chase, Bank of America"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="last4">Last 4 Digits</Label>
              <Input
                id="last4"
                value={formData.last4 || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  updateFormData('last4', value);
                }}
                placeholder="1234"
                maxLength={4}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="endingBalance">Ending Balance</Label>
              <Input
                id="endingBalance"
                type="text"
                value={formData.endingBalance ? formatCurrency(parseFloat(formData.endingBalance)) : '$0.00'}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const digitsOnly = inputValue.replace(/\D/g, '');

                  if (digitsOnly === '') {
                    updateFormData('endingBalance', '0');
                    return;
                  }

                  const cents = parseInt(digitsOnly, 10);
                  const dollars = (cents / 100).toFixed(2);
                  updateFormData('endingBalance', dollars);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace') {
                    e.preventDefault();
                    const currentValue = formData.endingBalance || '0';
                    const cents = Math.floor(parseFloat(currentValue) * 100);
                    const newCents = Math.floor(cents / 10);
                    const newDollars = (newCents / 100).toFixed(2);
                    updateFormData('endingBalance', newDollars);
                  }
                }}
                placeholder="$0.00"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="endingBalanceDate">Ending Balance Date</Label>
              <Input
                id="endingBalanceDate"
                type="date"
                value={formData.endingBalanceDate || ''}
                onChange={(e) => updateFormData('endingBalanceDate', e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Beginning Balance</Label>
              <div className="text-sm text-muted-foreground mt-2">
                ${formData.beginningBalance || '0.00'}
              </div>
            </div>
            <div>
              <Label htmlFor="beginningBalanceDate">As of Date</Label>
              <Input
                id="beginningBalanceDate"
                type="date"
                value={formData.beginningBalanceDate || ''}
                onChange={(e) => updateFormData('beginningBalanceDate', e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => !uploadedFile && document.getElementById('file-upload-details')?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-500 transition-colors cursor-pointer"
          >
            {processingStatus === 'processing' || processingStatus === 'uploading' || processingStatus === 'extracting' ? (
              <div className="space-y-1.5">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
                <div className="text-xs text-muted-foreground">
                  {processingStatus === 'uploading' && 'Uploading file...'}
                  {processingStatus === 'extracting' && 'Extracting transactions...'}
                  {processingStatus === 'processing' && 'Processing file...'}
                </div>
              </div>
            ) : uploadedFile ? (
              <div className="flex items-center justify-between gap-2 py-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {showMappingSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <FileUp className="w-4 h-4 text-green-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-medium truncate">{uploadedFile.name}</div>
                    {showMappingSuccess && mappedTransactions.length > 0 && (
                      <div className="text-[10px] text-green-600">
                        {mappedTransactions.length} transactions • {getTransactionDateRange(mappedTransactions).startDate} to {getTransactionDateRange(mappedTransactions).endDate}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadedFile(null);
                    setProcessingStatus(null);
                    setProcessedData(null);
                    setMappedTransactions([]);
                    setShowMappingSuccess(false);
                    setCsvHadBalanceColumn(false);
                    setCsvMappingConfig(null);
                  }}
                  className="h-6 px-2 text-xs hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
                <p className="text-xs font-medium mb-0.5">Upload Bank Statement</p>
                <p className="text-xs text-muted-foreground">
                  Drag and drop or click to upload CSV
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  id="file-upload-details"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
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
              <CalculatorAmountInput
                value={parseFloat(formData.currentValue) || 0}
                onChange={(value) => updateFormData('currentValue', value.toFixed(2))}
                placeholder="0.00"
                className="h-9"
              />
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
              <CalculatorAmountInput
                value={parseFloat(formData.currentValue) || 0}
                onChange={(value) => updateFormData('currentValue', value.toFixed(2))}
                placeholder="0.00"
                className="h-9"
              />
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
            <CalculatorAmountInput
              value={parseFloat(formData.currentValue) || 0}
              onChange={(value) => updateFormData('currentValue', value.toFixed(2))}
              placeholder="0.00"
            />
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
            <CalculatorAmountInput
              value={parseFloat(formData.currentBalance) || 0}
              onChange={(value) => updateFormData('currentBalance', value.toFixed(2))}
              placeholder="0.00"
            />
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
      const INCOME_TYPES = [
        { value: 'earned_income', label: 'Earned Income' },
        { value: 'passive_income', label: 'Passive Income' },
      ];

      const EXPENSE_TYPES = [
        { value: 'housing', label: 'Housing' },
        { value: 'utilities', label: 'Utilities' },
        { value: 'food_dining', label: 'Food & Dining' },
        { value: 'transportation', label: 'Transportation' },
        { value: 'insurance', label: 'Insurance' },
        { value: 'healthcare', label: 'Healthcare' },
        { value: 'kids_family', label: 'Kids & Family' },
        { value: 'education', label: 'Education' },
        { value: 'subscriptions', label: 'Subscriptions' },
        { value: 'shopping', label: 'Shopping' },
        { value: 'travel', label: 'Travel' },
        { value: 'lifestyle', label: 'Lifestyle' },
        { value: 'personal_care', label: 'Personal Care' },
        { value: 'professional_services', label: 'Professional Services' },
        { value: 'pets', label: 'Pets' },
        { value: 'financial', label: 'Financial' },
        { value: 'giving', label: 'Giving' },
        { value: 'taxes', label: 'Taxes' },
      ];

      const CLASS_OPTIONS = [
        { value: 'income', label: 'Income' },
        { value: 'expense', label: 'Expense' },
      ];

      const selectedClass = formData.categoryClass || '';
      const categoryTypes = selectedClass === 'income' ? INCOME_TYPES : selectedClass === 'expense' ? EXPENSE_TYPES : [];

      const allIncomeCategories = userChartAccounts.filter(acc => acc.class === 'income');
      const allExpenseCategories = userChartAccounts.filter(acc => acc.class === 'expense');
      const existingCategoriesByClass = selectedClass === 'income' ? allIncomeCategories : selectedClass === 'expense' ? allExpenseCategories : [];

      const getDisplayName = (cat) => cat.display_name || cat.account_detail || 'Unnamed';

      const parentCategories = existingCategoriesByClass.filter(cat => !cat.parent_account_id);

      const currentIcon = formData.icon || suggestIconForName(formData.name) || 'Circle';
      const currentColor = formData.color || '#52A5CE';

      const isDuplicate = existingCategoriesByClass.some(
        cat => getDisplayName(cat).toLowerCase() === (formData.name || '').toLowerCase().trim() && cat.id !== currentlyEditingCategoryId
      );

      // Only show preview if we're creating new (not editing existing) or if form has been modified
      const previewCategory = formData.name && formData.name.trim() && selectedClass && !currentlyEditingCategoryId ? {
        id: 'preview',
        displayName: formData.name.trim(),
        icon: currentIcon,
        color: currentColor,
        class: selectedClass,
        parent_account_id: formData.parentAccountId || null,
        isNew: true,
        isDuplicate
      } : null;

      const buildSectionHierarchy = (cats, sectionClass) => {
        const parents = cats.filter(c => !c.parent_account_id);
        let hierarchy = parents.map(parent => ({
          ...parent,
          displayName: getDisplayName(parent),
          children: cats.filter(c => c.parent_account_id === parent.id).map(child => ({
            ...child,
            displayName: getDisplayName(child)
          }))
        })).sort((a, b) => a.displayName.localeCompare(b.displayName));

        if (previewCategory && previewCategory.class === sectionClass) {
          if (previewCategory.parent_account_id) {
            hierarchy = hierarchy.map(parent => {
              if (parent.id === previewCategory.parent_account_id) {
                return {
                  ...parent,
                  children: [...parent.children, previewCategory].sort((a, b) =>
                    (a.displayName || '').localeCompare(b.displayName || '')
                  )
                };
              }
              return parent;
            });
          } else {
            hierarchy.push({ ...previewCategory, children: [] });
            hierarchy.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
          }
        }
        return hierarchy;
      };

      const incomeHierarchy = buildSectionHierarchy(allIncomeCategories, 'income');
      const expenseHierarchy = buildSectionHierarchy(allExpenseCategories, 'expense');

      const handleCategoryClick = (category) => {
        if (category.isNew || category.isDuplicate) return;

        // Load category into form for editing
        setCurrentlyEditingCategoryId(category.id);
        setSelectedCategoryIdForTransaction(category.id);

        // Populate form with category data
        updateFormData('name', category.displayName);
        updateFormData('categoryClass', category.class);
        updateFormData('accountDetail', category.account_detail);
        updateFormData('parentAccountId', category.parent_account_id);
        updateFormData('icon', category.icon);
        updateFormData('color', category.color);
        updateFormData('iconManuallySet', false);

        // Reset dirty flag since we just loaded fresh data
        setIsDirty(false);
      };

      const renderCategoryRow = (category, indent = false) => {
        const IconComponent = getIconComponent(category.icon);
        const isSelected = selectedCategoryIdForTransaction === category.id;
        const isJustSaved = justSavedCategoryId === category.id;

        return (
          <div key={category.id}>
            <div
              ref={category.isNew ? newItemRef : null}
              onClick={() => !category.isNew && !category.isDuplicate && handleCategoryClick(category)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                indent ? 'ml-4' : ''
              } ${
                category.isNew
                  ? category.isDuplicate
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-blue-50 border border-blue-200'
                  : isSelected
                    ? 'bg-blue-100 border border-blue-300 cursor-pointer'
                    : isJustSaved
                      ? 'bg-green-50 border border-green-200 cursor-pointer'
                      : 'hover:bg-slate-50 cursor-pointer'
              }`}
            >
              <IconComponent
                className="w-3 h-3 flex-shrink-0"
                style={{ color: category.color }}
              />
              <span className={`truncate ${category.isNew || isSelected ? 'font-medium' : ''}`}>
                {category.displayName}
              </span>
              {category.isNew && category.isDuplicate && (
                <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0 ml-auto" />
              )}
              {isSelected && !category.isNew && (
                <Check className="w-3 h-3 text-blue-600 flex-shrink-0 ml-auto" />
              )}
            </div>
            {category.children && category.children.length > 0 && (
              <div className="space-y-0.5 mt-0.5">
                {category.children.map(child => renderCategoryRow(child, true))}
              </div>
            )}
          </div>
        );
      };

      const handleCreateNew = () => {
        setCurrentlyEditingCategoryId(null);
        setSelectedCategoryIdForTransaction(null);
        setFormData({
          categoryClass: formData.categoryClass || initialClass || '',
          accountDetail: '',
          name: '',
          parentAccountId: null,
          icon: 'Circle',
          color: '#52A5CE',
          iconManuallySet: false
        });
        setIsDirty(false);
      };

      return (
        <div className="flex gap-3 h-full">
          <div className="w-[220px] flex-shrink-0 space-y-2">
            {currentlyEditingCategoryId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCreateNew}
                className="w-full h-7 text-xs"
              >
                + Create New Category
              </Button>
            )}
            <div>
              <Label htmlFor="name" className="text-xs mb-0.5">Category Name*</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => {
                  const newName = e.target.value;
                  updateFormData('name', newName);
                  if (!formData.iconManuallySet) {
                    updateFormData('icon', suggestIconForName(newName) || 'Circle');
                  }
                }}
                placeholder="e.g., Groceries"
                className="h-8 text-sm"
                required
              />
            </div>

            <div>
              <Label className="text-xs mb-0.5">Income or Expense*</Label>
              <ClickThroughSelect
                value={selectedClass}
                onValueChange={(val) => {
                  updateFormData('categoryClass', val);
                  updateFormData('accountDetail', '');
                  updateFormData('parentAccountId', null);
                }}
                placeholder="Select Income or Expense"
                triggerClassName="h-8 text-sm"
                enableSearch={true}
              >
                {CLASS_OPTIONS.map((opt) => (
                  <ClickThroughSelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>

            <div>
              <Label className="text-xs mb-0.5">Category Type*</Label>
              <ClickThroughSelect
                value={formData.accountDetail || ''}
                onValueChange={(val) => updateFormData('accountDetail', val)}
                placeholder="Select type"
                triggerClassName="h-8 text-sm"
                enableSearch={true}
                disabled={!selectedClass}
              >
                {categoryTypes.map((type) => (
                  <ClickThroughSelectItem key={type.value} value={type.value}>
                    {type.label}
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>

            <div>
              <Label className="text-xs mb-0.5">Parent (Optional)</Label>
              <ClickThroughSelect
                value={formData.parentAccountId || ''}
                onValueChange={(val) => updateFormData('parentAccountId', val || null)}
                placeholder="Select Parent"
                triggerClassName="h-8 text-sm"
                enableSearch={true}
                disabled={!selectedClass}
              >
                {parentCategories.map((cat) => (
                  <ClickThroughSelectItem key={cat.id} value={cat.id}>
                    {getDisplayName(cat)}
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>

            <div>
              <Label className="text-xs mb-0.5">Appearance</Label>
              <div className="flex items-center gap-2">
                <AppearancePicker
                  color={currentColor}
                  icon={currentIcon}
                  onColorChange={(color) => updateFormData('color', color)}
                  onIconChange={(icon) => {
                    updateFormData('icon', icon);
                    updateFormData('iconManuallySet', true);
                  }}
                />
                <span className="text-xs text-slate-500">Click to change</span>
              </div>
            </div>
          </div>

          <div className="flex-1 border-l border-slate-200 pl-3 flex flex-col min-w-0">
            <div className="mb-2">
              <div className="text-xs font-medium text-slate-700">Category Preview</div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-0.5">
              {incomeHierarchy.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1">Income</div>
                  {incomeHierarchy.map(cat => renderCategoryRow(cat))}
                </>
              )}
              {expenseHierarchy.length > 0 && (
                <>
                  <div className={`text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1 ${incomeHierarchy.length > 0 ? 'mt-2' : ''}`}>Expenses</div>
                  {expenseHierarchy.map(cat => renderCategoryRow(cat))}
                </>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  const renderCsvMappingStep = () => {
    return (
      <div className="space-y-4">
        <CsvColumnMapper
          ref={csvMapperRef}
          csvData={processedData}
          onMap={handleCsvMapping}
          onCancel={() => {
            setCurrentStep('details');
            setProcessedData(null);
            setUploadedFile(null);
            setProcessingStatus(null);
            setCsvHadBalanceColumn(false);
            setCsvMappingConfig(null);
          }}
          onValidationChange={setCsvValidation}
          hideFooter={true}
          profileId={activeProfile?.id}
          institutionName={formData.institutionName || 'Unknown Bank'}
        />
      </div>
    );
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
          <CalculatorAmountInput
            value={parseFloat(formData.loanBalance) || 0}
            onChange={(value) => updateFormData('loanBalance', value.toFixed(2))}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label htmlFor="originalLoanAmount">Original Amount</Label>
          <CalculatorAmountInput
            value={parseFloat(formData.originalLoanAmount) || 0}
            onChange={(value) => updateFormData('originalLoanAmount', value.toFixed(2))}
            placeholder="0.00"
          />
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
          <CalculatorAmountInput
            value={parseFloat(formData.monthlyPayment) || 0}
            onChange={(value) => updateFormData('monthlyPayment', value.toFixed(2))}
            placeholder="0.00"
          />
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

  const renderBankInfoStep = () => (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="institutionName">Bank/Institution</Label>
          <Input
            id="institutionName"
            value={formData.institutionName || ''}
            onChange={(e) => updateFormData('institutionName', e.target.value)}
            placeholder="e.g., Chase, Bank of America"
            className="h-9"
          />
        </div>
        <div>
          <Label htmlFor="last4">Last 4 Digits</Label>
          <Input
            id="last4"
            value={formData.last4 || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
              updateFormData('last4', value);
            }}
            placeholder="1234"
            maxLength={4}
            className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="endingBalance">Ending Balance*</Label>
          <Input
            id="endingBalance"
            type="text"
            value={formData.endingBalance ? formatCurrency(parseFloat(formData.endingBalance)) : '$0.00'}
            onChange={(e) => {
              const inputValue = e.target.value;
              const digitsOnly = inputValue.replace(/\D/g, '');

              if (digitsOnly === '') {
                updateFormData('endingBalance', '0');
                return;
              }

              const cents = parseInt(digitsOnly, 10);
              const dollars = (cents / 100).toFixed(2);
              updateFormData('endingBalance', dollars);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace') {
                e.preventDefault();
                const currentValue = formData.endingBalance || '0';
                const cents = Math.floor(parseFloat(currentValue) * 100);
                const newCents = Math.floor(cents / 10);
                const newDollars = (newCents / 100).toFixed(2);
                updateFormData('endingBalance', newDollars);
              }
            }}
            placeholder="$0.00"
            className="h-9"
          />
        </div>
        <div>
          <Label htmlFor="endingBalanceDate">Ending Balance Date</Label>
          <Input
            id="endingBalanceDate"
            type="date"
            value={formData.endingBalanceDate || ''}
            onChange={(e) => updateFormData('endingBalanceDate', e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Beginning Balance</Label>
          <div className="text-sm text-muted-foreground mt-2">
            ${formData.beginningBalance || '0.00'}
          </div>
        </div>
        <div>
          <Label htmlFor="beginningBalanceDate">As of Date</Label>
          <Input
            id="beginningBalanceDate"
            type="date"
            value={formData.beginningBalanceDate || ''}
            onChange={(e) => updateFormData('beginningBalanceDate', e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {mappedTransactions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <div className="font-medium text-blue-900 mb-1">Transaction Summary</div>
          <div className="text-xs text-blue-700 space-y-0.5">
            <div>Total transactions: {mappedTransactions.length}</div>
            <div>Date range: {formData.beginningBalanceDate} to {formData.endingBalanceDate}</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select-type':
        return renderSelectType();
      case 'connect-bank':
        return renderConnectBankStep();
      case 'select-subtype':
        return renderSelectSubtype();
      case 'details':
        return renderDetailsStep();
      case 'csv-mapping':
        return renderCsvMappingStep();
      case 'bank-info':
        return renderBankInfoStep();
      case 'balance':
        return renderBalanceStep();
      case 'loan-search':
        return renderLoanSearchStep();
      case 'loan-details':
        return renderLoanDetailsStep();
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    if (currentStep === 'select-type') return 'Select Account Type';
    if (currentStep === 'connect-bank') return 'Connect Your Bank';
    if (currentStep === 'select-subtype') return `Select ${selectedCard?.title} Type`;
    if (currentStep === 'csv-mapping') return 'Map CSV Columns';
    if (currentStep === 'bank-info') {
      if (selectedSubtype?.value === 'credit_card') return 'Credit Card Details';
      return 'Account Information';
    }
    if (currentStep === 'details') {
      if (selectedCard?.id === 'banking') {
        if (selectedSubtype?.value === 'checking') return 'Checking Account Details';
        if (selectedSubtype?.value === 'savings') return 'Savings Account Details';
        if (selectedSubtype?.value === 'credit_card') return 'Credit Card Details';
        return 'Account Details';
      }
      if (selectedCard?.id === 'vehicle') return 'Vehicle Details';
      if (selectedCard?.id === 'property') return 'Property Details';
      if (selectedCard?.id === 'investments') return 'Investment Details';
      if (selectedCard?.id === 'loans') return 'Loan Details';
      if (selectedCard?.id === 'budget') return 'Category Management';
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`${currentStep === 'connect-bank' ? 'w-[500px] max-w-[90vw]' : 'w-[550px]'} p-0 ${(currentStep === 'select-type' || currentStep === 'select-subtype' || currentStep === 'connect-bank') ? 'bg-gradient-to-br from-slate-50 to-blue-50' : ''}`}>
          <div className={`relative flex flex-col ${currentStep === 'connect-bank' ? 'h-[380px]' : currentStep === 'bank-info' ? 'h-[480px]' : currentStep === 'details' && selectedCard?.id === 'banking' ? 'h-[520px]' : currentStep === 'details' ? 'h-[560px]' : 'h-[400px]'}`}>
            <DialogHeader className="pt-2.5 px-4 flex-shrink-0">
              <DialogTitle className="text-center text-base">{getStepTitle()}</DialogTitle>
            </DialogHeader>

            <div className={`py-4 px-4 flex-1 overflow-y-auto ${(currentStep === 'select-type' || currentStep === 'select-subtype' || currentStep === 'connect-bank') ? 'flex items-center justify-center' : ''}`}>
              {renderCurrentStep()}
            </div>

            {currentStep !== 'select-type' && (
              <div className="flex justify-between gap-4 pt-2 pb-2.5 px-4 flex-shrink-0">
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

                {currentStep === 'connect-bank' && <div />}

                {currentStep === 'bank-search' && <div />}

                {currentStep === 'select-subtype' && <div />}

                {currentStep === 'loan-search' && <div />}

                {currentStep === 'bank-info' && (
                  <Button
                    type="button"
                    className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                    onClick={handleNext}
                    disabled={isLoading || !formData.institutionName || !formData.beginningBalance}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Creating & Importing...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Create Account & Import
                      </>
                    )}
                  </Button>
                )}

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

                {currentStep === 'csv-mapping' && (
                  <Button
                    type="button"
                    className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                    onClick={() => csvMapperRef.current?.handleMap()}
                    disabled={!csvValidation.isValid || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Importing...
                      </>
                    ) : csvValidation.isBalanceExtraction ? (
                      'Done'
                    ) : (
                      `Import ${csvValidation.transactionCount} Transactions`
                    )}
                  </Button>
                )}

              {currentStep === 'details' && (
                <Button
                  type="button"
                  className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                  onClick={
                    selectedCard?.id === 'budget'
                      ? (isDirty ? handleSubmit : () => {
                          // Finish - apply selected category to transaction
                          if (selectedCategoryIdForTransaction && onAccountCreated) {
                            const selectedCategory = userChartAccounts.find(c => c.id === selectedCategoryIdForTransaction);
                            if (selectedCategory) {
                              onAccountCreated({ type: selectedCategory.class, account: selectedCategory });
                            }
                          }
                          onOpenChange(false);
                        })
                      : selectedCard?.id === 'banking' && selectedSubtype?.value === 'credit_card' && mappedTransactions.length > 0 && !isExistingAccount
                        ? handleCreateAccountAndImportTransactions
                        : handleNext
                  }
                  disabled={!canProceed() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      {selectedCard?.id === 'budget' ? 'Saving...' : selectedCard?.id === 'banking' && selectedSubtype?.value === 'credit_card' && mappedTransactions.length > 0 && !isExistingAccount ? 'Creating Account & Importing...' : selectedCard?.id === 'banking' && isExistingAccount ? 'Importing...' : 'Processing...'}
                    </>
                  ) : selectedCard?.id === 'budget' ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      {isDirty ? 'Save' : 'Finish'}
                    </>
                  ) : selectedCard?.id === 'banking' && selectedSubtype?.value === 'credit_card' && mappedTransactions.length > 0 && !isExistingAccount ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      {`Create Account & Import ${mappedTransactions.length} Transactions`}
                    </>
                  ) : selectedCard?.id === 'banking' && isExistingAccount ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      {`Import to ${selectedAccountName}`}
                    </>
                  ) : (selectedCard?.id === 'vehicle' && formData.skipLoanDetails) ||
                    (selectedCard?.id === 'property' && formData.skipMortgageDetails) ||
                    selectedCard?.id === 'investments' ||
                    selectedCard?.id === 'loans' ? (
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

    <Dialog open={showBalanceImportDialog} onOpenChange={setShowBalanceImportDialog}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {balanceImportStep === 'upload' && 'Upload Statement for Balance Information'}
            {balanceImportStep === 'mapping' && 'Map CSV Columns'}
          </DialogTitle>
        </DialogHeader>

        {balanceImportStep === 'upload' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Upload a CSV file to automatically extract beginning and ending balances with their dates.
            </div>
            <div
              onClick={() => document.getElementById('balance-import-file-input')?.click()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleBalanceCsvUpload(file);
              }}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
            >
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                CSV files supported
              </p>
              <input
                id="balance-import-file-input"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBalanceCsvUpload(file);
                }}
                className="hidden"
              />
            </div>
          </div>
        )}

        {balanceImportStep === 'mapping' && balanceProcessedData && (
          <CsvColumnMapper
            csvData={balanceProcessedData}
            onMap={handleBalanceCsvMapping}
            onCancel={() => {
              setBalanceImportStep('upload');
              setBalanceProcessedData(null);
            }}
            isImporting={isProcessingBalance}
            isBalanceExtraction={true}
            profileId={activeProfile?.id}
            institutionName={formData.institutionName || 'Unknown Bank'}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
