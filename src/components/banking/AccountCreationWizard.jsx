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
import IconPicker from '@/components/common/IconPicker';
import ColorPicker from '@/components/common/ColorPicker';
import { getIconComponent, suggestIconForName } from '../utils/iconMapper';
import { useTemplateAccountTypesByClass, useTemplateAccountDetailsByType } from '@/hooks/useChartOfAccounts';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
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
import { createOpeningBalanceJournalEntry } from '@/api/journalEntries';
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
    const budgetSubtypes = [];
    if (hasIncome) {
      budgetSubtypes.push({
        value: 'income',
        label: 'Income',
        icon: BadgeDollarSign
      });
    }
    if (hasExpense) {
      budgetSubtypes.push({
        value: 'expense',
        label: 'Expense',
        icon: Receipt
      });
    }

    cards.push({
      id: 'budget',
      title: 'Budget Category',
      icon: DollarSign,
      bgColor: '#EFCE7B',
      iconColor: 'text-white',
      subtypes: budgetSubtypes
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
  initialCategoryName = null
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
  const [mappedTransactions, setMappedTransactions] = useState([]);
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
  const [selectedCachedAccount, setSelectedCachedAccount] = useState(null);
  const [selectedStatements, setSelectedStatements] = useState([]);
  const [cacheImportMode, setCacheImportMode] = useState(false);

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

      if (initialSubtype && card.subtypes) {
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
      } else if (initialAccountType === 'budget' && !initialSubtype) {
        // Skip type selection, go directly to subtype selection (income/expense)
        setCurrentStep('select-subtype');
      }
    }
  }, [open, initialAccountType, initialSubtype, initialCategoryName, accountTypeCards.length]);

  const resetWizard = () => {
    setCurrentStep('select-type');
    setSelectedCard(null);
    setSelectedSubtype(null);
    setFormData({});
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
      if (newAccount.current_balance && newAccount.current_balance !== 0 && !newAccount._usedActivateTemplate) {
        try {
          const openingDate = formData.asOfDate || new Date().toISOString().split('T')[0];
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
          console.log('Transaction import - mappedTransactions:', mappedTransactions.length, 'startDate:', startDate);
          const transactionsToImport = startDate
            ? mappedTransactions.filter(txn => new Date(txn.date) >= new Date(startDate))
            : mappedTransactions;

          console.log('Transaction import - after date filter:', transactionsToImport.length, 'transactions');
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
              console.log('Successfully imported', transactionsToImport.length, 'transactions');
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
            console.log('No transactions to import after date filtering');
            toast.warning(`Account created but no transactions matched the date filter. ${mappedTransactions.length} transactions were before ${startDate}`);
          }
        } catch (error) {
          console.error('Error importing transactions:', error);
          toast.error('Account created but transaction import failed');
        }
      } else {
        console.log('No mapped transactions available for import');
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

  const createCategoryMutation = useMutation({
    mutationFn: async (data) => {
      const template = chartAccounts.find(t => t.account_detail === data.accountDetail);
      if (!template) {
        throw new Error(`No template found for account detail: ${data.accountDetail}`);
      }

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
      return newCategory;
    },
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      toast.success('Category created successfully!');
      onOpenChange(false);

      const hasCallback = !!onAccountCreated;
      if (hasCallback) {
        onAccountCreated({ type: selectedSubtype?.value, account: newCategory });
      } else {
        setTimeout(() => {
          navigate(`/Banking/account/${newCategory.id}`);
        }, 100);
      }
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

        await createAccountMutation.mutateAsync({
          account_name: formData.name,
          account_type: selectedSubtype.value,
          current_balance: selectedSubtype.value === 'credit_card' ? Math.abs(balanceValidation.value) : balanceValidation.value,
          institution_name: formData.institutionName || null,
          account_number_last4: formData.last4 || null,
          as_of_date: formData.asOfDate || new Date().toISOString().split('T')[0],
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
        if (!formData.accountDetail) {
          toast.error('Please select a category type');
          return;
        }
        await createCategoryMutation.mutateAsync({
          name: formData.name,
          accountDetail: formData.accountDetail,
          type: selectedSubtype.value,
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
    createCategoryMutation.isPending;

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
        return (selectedAccountName && selectedAccountName.trim() &&
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
        return formData.name && formData.name.trim() && formData.accountDetail;
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
                updateFormData('name', value);
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
              <div className="space-y-1.5">
                {showMappingSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                ) : (
                  <FileUp className="w-5 h-5 text-green-600 mx-auto" />
                )}
                <div className="text-xs font-medium">{uploadedFile.name}</div>
                {showMappingSuccess && mappedTransactions.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-left">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs font-medium text-green-900">Mapping Complete</span>
                    </div>
                    <div className="text-xs text-green-700">
                      {mappedTransactions.length} transactions ready to import
                    </div>
                    {mappedTransactions.length > 0 && (
                      <div className="mt-1 text-xs text-green-700">
                        Date range: {getTransactionDateRange(mappedTransactions).startDate} to {getTransactionDateRange(mappedTransactions).endDate}
                      </div>
                    )}
                  </div>
                )}
                {!showMappingSuccess && (
                  <div className="text-xs text-muted-foreground">
                    {mappedTransactions.length > 0 && `${mappedTransactions.length} transactions found`}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
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
                  className="h-7 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Remove
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

      const categoryTypes = selectedSubtype?.value === 'income' ? INCOME_TYPES : EXPENSE_TYPES;

      // Filter existing categories by income/expense type
      const accountClass = selectedSubtype?.value === 'income' ? 'income' : 'expense';
      const existingCategories = userChartAccounts.filter(
        acc => acc.class === accountClass
      );

      // Get parent categories (those without parent_account_id)
      const parentCategories = existingCategories.filter(cat => !cat.parent_account_id);

      // Helper function to get display name
      const getDisplayName = (cat) => cat.display_name || cat.account_detail || 'Unnamed';

      // Build category hierarchy
      const categoryHierarchy = parentCategories.map(parent => ({
        ...parent,
        displayName: getDisplayName(parent),
        children: existingCategories.filter(cat => cat.parent_account_id === parent.id).map(child => ({
          ...child,
          displayName: getDisplayName(child)
        }))
      })).sort((a, b) => a.displayName.localeCompare(b.displayName));

      // Add categories without parents that aren't in the parent list
      const orphanCategories = existingCategories
        .filter(cat => !cat.parent_account_id && !parentCategories.find(p => p.id === cat.id))
        .map(cat => ({ ...cat, displayName: getDisplayName(cat) }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      // Set default icon and color if not set
      const currentIcon = formData.icon || suggestIconForName(formData.name) || 'Circle';
      const currentColor = formData.color || '#52A5CE';

      // Check for duplicate names
      const isDuplicate = existingCategories.some(
        cat => getDisplayName(cat).toLowerCase() === (formData.name || '').toLowerCase().trim()
      );

      // Create preview entry for the new category
      const previewCategory = formData.name && formData.name.trim() ? {
        id: 'preview',
        displayName: formData.name.trim(),
        icon: currentIcon,
        color: currentColor,
        parent_account_id: formData.parentAccountId || null,
        isNew: true,
        isDuplicate
      } : null;

      // Merge preview into the hierarchy
      let previewHierarchy = [...categoryHierarchy, ...orphanCategories.map(cat => ({ ...cat, children: [] }))];
      if (previewCategory) {
        if (previewCategory.parent_account_id) {
          // Add as child to parent
          previewHierarchy = previewHierarchy.map(parent => {
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
          // Add as top-level category
          previewHierarchy.push({ ...previewCategory, children: [] });
          previewHierarchy.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        }
      }

      return (
        <div className="flex gap-3 h-full">
          {/* Left Column - Compact Form */}
          <div className="w-[220px] flex-shrink-0 space-y-2">
            <div>
              <Label htmlFor="name" className="text-xs mb-0.5">Category Name*</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => {
                  const newName = e.target.value;
                  updateFormData('name', newName);
                  // Auto-suggest icon if not manually set
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
              <Label htmlFor="accountDetail" className="text-xs mb-0.5">Category Type*</Label>
              <Select
                value={formData.accountDetail || ''}
                onValueChange={(value) => updateFormData('accountDetail', value)}
                required
              >
                <SelectTrigger id="accountDetail" className="h-8 text-sm">
                  <SelectValue placeholder={`Select type`} />
                </SelectTrigger>
                <SelectContent>
                  {categoryTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="parentCategory" className="text-xs mb-0.5">Parent (Optional)</Label>
              <Select
                value={formData.parentAccountId || 'none'}
                onValueChange={(value) => updateFormData('parentAccountId', value === 'none' ? null : value)}
              >
                <SelectTrigger id="parentCategory" className="h-8 text-sm">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {existingCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {getDisplayName(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-0.5">Appearance</Label>
              <div className="flex items-center gap-2">
                <IconPicker
                  value={currentIcon}
                  onValueChange={(icon) => {
                    updateFormData('icon', icon);
                    updateFormData('iconManuallySet', true);
                  }}
                  triggerClassName="h-8 w-8"
                />
                <ColorPicker
                  value={currentColor}
                  onChange={(color) => updateFormData('color', color)}
                  showLabel={false}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Preview Panel */}
          <div className="flex-1 border-l border-slate-200 pl-3 flex flex-col min-w-0">
            <div className="mb-2">
              <div className="text-xs font-medium text-slate-700">Category Preview</div>
              <div className="text-xs text-slate-500">{existingCategories.length} existing</div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-0.5">
              {previewHierarchy.map((category) => {
                const IconComponent = getIconComponent(category.icon);
                return (
                  <div key={category.id}>
                    {/* Parent/Top-level category */}
                    <div
                      ref={category.isNew ? newItemRef : null}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                        category.isNew
                          ? category.isDuplicate
                            ? 'bg-red-50 border border-red-200'
                            : 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <IconComponent
                        className="w-3 h-3 flex-shrink-0"
                        style={{ color: category.color }}
                      />
                      <span className={`truncate ${category.isNew ? 'font-medium' : ''}`}>
                        {category.displayName}
                      </span>
                      {category.isNew && category.isDuplicate && (
                        <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0 ml-auto" />
                      )}
                    </div>

                    {/* Children */}
                    {category.children && category.children.length > 0 && (
                      <div className="ml-4 space-y-0.5 mt-0.5">
                        {category.children.map((child) => {
                          const ChildIcon = getIconComponent(child.icon);
                          return (
                            <div
                              key={child.id}
                              ref={child.isNew ? newItemRef : null}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                                child.isNew
                                  ? child.isDuplicate
                                    ? 'bg-red-50 border border-red-200'
                                    : 'bg-blue-50 border border-blue-200'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <ChildIcon
                                className="w-3 h-3 flex-shrink-0"
                                style={{ color: child.color }}
                              />
                              <span className={`truncate ${child.isNew ? 'font-medium' : ''}`}>
                                {child.displayName}
                              </span>
                              {child.isNew && child.isDuplicate && (
                                <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0 ml-auto" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`${currentStep === 'connect-bank' ? 'w-[500px] max-w-[90vw]' : 'w-[550px]'} p-0 ${(currentStep === 'select-type' || currentStep === 'select-subtype' || currentStep === 'connect-bank') ? 'bg-gradient-to-br from-slate-50 to-blue-50' : ''}`}>
          <div className={`relative flex flex-col ${currentStep === 'connect-bank' ? 'h-[380px]' : currentStep === 'details' && selectedCard?.id === 'banking' ? 'h-[600px]' : currentStep === 'details' ? 'h-[560px]' : 'h-[400px]'}`}>
            <DialogHeader className="pt-2.5 px-4 flex-shrink-0">
              <DialogTitle className="text-center text-base">{getStepTitle()}</DialogTitle>
            </DialogHeader>

            <div className={`py-4 px-4 flex-1 overflow-y-auto ${(currentStep === 'select-type' || currentStep === 'select-subtype' || currentStep === 'connect-bank') ? 'flex items-center justify-center' : ''}`}>
              {renderCurrentStep()}
            </div>

            {currentStep !== 'select-type' && (
              <div className="flex justify-between gap-4 pt-2 pb-2.5 px-4 border-t flex-shrink-0">
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

              {currentStep === 'details' && (
                <Button
                  type="button"
                  className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                  onClick={handleNext}
                  disabled={!canProceed() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      {selectedCard?.id === 'banking' && isExistingAccount ? 'Importing...' : 'Processing...'}
                    </>
                  ) : selectedCard?.id === 'banking' && isExistingAccount ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      {`Import to ${selectedAccountName}`}
                    </>
                  ) : (selectedCard?.id === 'vehicle' && formData.skipLoanDetails) ||
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
