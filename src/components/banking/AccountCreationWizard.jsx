import React, { useState, useEffect } from 'react';
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
import { formatLabel } from '../utils/formatters';
import { toast } from 'sonner';
import { createVehicleAsset, createAutoLoan, createAssetLiabilityLink } from '@/api/vehiclesAndLoans';
import { createPropertyAsset, createMortgage } from '@/api/propertiesAndMortgages';
import { activateTemplateAccount } from '@/api/chartOfAccounts';
import TypeDetailSelector from '@/components/common/TypeDetailSelector';
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
  AlertCircle
} from 'lucide-react';
import { processStatementFile, mapCsvToTransactions, autoMatchTransfers, calculateOpeningBalanceForDate, calculateBeginningBalanceFromCurrent, parseDate } from './StatementProcessor';
import CsvColumnMapper from './CsvColumnMapper';
import AccountCombobox from '../common/AccountCombobox';
import { detectDuplicateTransactions, getTransactionDateRange } from '@/api/duplicateDetection';
import TransactionDateRangeSelector from './TransactionDateRangeSelector';
import {
  getAvailableInstitutions,
  simulateConnection,
  getInstitutionAccounts,
  getAccountTransactions
} from '@/api/bankSimulation';
import {
  findOrCreateOpeningBalanceEquityAccount,
  createOpeningBalanceTransaction
} from '@/api/statementImport';
import { createOpeningBalanceJournalEntry } from '@/api/journalEntries';

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

  const hasVehicles = templates.some(t => t.account_type === 'vehicles');
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
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [uploadedFile, setUploadedFile] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedAccountName, setSelectedAccountName] = useState('');
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [mappedTransactions, setMappedTransactions] = useState([]);
  const [duplicateTransactions, setDuplicateTransactions] = useState([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [showMappingSuccess, setShowMappingSuccess] = useState(false);
  const [includeLastFour, setIncludeLastFour] = useState(false);

  const [availableInstitutions, setAvailableInstitutions] = useState([]);
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState('');
  const [discoveredAccounts, setDiscoveredAccounts] = useState([]);
  const [selectedAccountsToImport, setSelectedAccountsToImport] = useState([]);
  const [accountConfigurations, setAccountConfigurations] = useState({});
  const [importAccountMappings, setImportAccountMappings] = useState({});
  const [customStartDate, setCustomStartDate] = useState(null);
  const [originalBeginningBalance, setOriginalBeginningBalance] = useState(null);
  const [statementBalances, setStatementBalances] = useState({ previous: null, new: null });

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
    enabled: open && !!user
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
    enabled: !!activeProfile?.id && open
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
    enabled: !!activeProfile?.id && open
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
      }
    }
  }, [open, initialAccountType, initialSubtype, initialCategoryName, accountTypeCards.length]);

  const resetWizard = () => {
    setCurrentStep('select-type');
    setSelectedCard(null);
    setSelectedSubtype(null);
    setFormData({});
    setShowConnectionModal(false);
    setConnectionStatus('connecting');
    setUploadedFile(null);
    setProcessingStatus(null);
    setProcessedData(null);
    setSelectedAccountId(null);
    setSelectedAccountName('');
    setIsExistingAccount(false);
    setMappedTransactions([]);
    setDuplicateTransactions([]);
    setSkipDuplicates(true);
    setShowMappingSuccess(false);
    setInstitutionSearch('');
    setSelectedInstitution(null);
    setIsConnecting(false);
    setConnectionProgress('');
    setDiscoveredAccounts([]);
    setSelectedAccountsToImport([]);
  };

  useEffect(() => {
    if (open && currentStep === 'connect-bank') {
      getAvailableInstitutions()
        .then(institutions => setAvailableInstitutions(institutions))
        .catch(error => {
          console.error('Error loading institutions:', error);
          toast.error('Failed to load financial institutions');
        });
    }
  }, [open, currentStep]);

  const handleCardSelect = (card) => {
    setSelectedCard(card);

    if (card.id === 'banking') {
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
      setInstitutionSearch('');
      setSelectedInstitution(null);
    } else if (currentStep === 'accounts-discovered') {
      setCurrentStep('connect-bank');
      setDiscoveredAccounts([]);
      setSelectedAccountsToImport([]);
    } else if (currentStep === 'csv-mapping') {
      setCurrentStep('details');
      setProcessedData(null);
    } else if (currentStep === 'bank-info') {
      setCurrentStep('details');
    } else if (currentStep === 'select-subtype') {
      setCurrentStep('select-type');
      setSelectedCard(null);
    } else if (currentStep === 'details') {
      if (selectedCard?.subtypes && selectedCard.subtypes.length > 0) {
        setCurrentStep('select-subtype');
        setSelectedSubtype(null);
        setFormData({});
        setUploadedFile(null);
        setProcessedData(null);
        setMappedTransactions([]);
        setShowMappingSuccess(false);
        setSelectedCachedAccount(null);
        setSelectedStatements([]);
        setCacheImportMode(false);
      } else {
        setCurrentStep('select-type');
        setSelectedCard(null);
        setSelectedSubtype(null);
        setFormData({});
        setUploadedFile(null);
        setProcessedData(null);
        setMappedTransactions([]);
        setShowMappingSuccess(false);
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


  const handleFileUpload = async (file) => {
    setUploadedFile(file);
    setProcessingStatus('processing');

    try {
      const result = await processStatementFile(file, (status) => {
        setProcessingStatus(status);
      });

      setProcessedData(result);

      if (currentStep === 'details' && selectedCard.id === 'banking') {
        if (result.type === 'csv') {
          setCurrentStep('csv-mapping');
        } else {
          setMappedTransactions(result.transactions);
          setProcessingStatus('success');
          setShowMappingSuccess(true);

          if (result.institutionName) {
            updateFormData('institutionName', result.institutionName);
          }
          if (result.accountNumber) {
            updateFormData('last4', result.accountNumber.slice(-4));
          }
          if (result.beginningBalance !== undefined) {
            updateFormData('beginningBalance', result.beginningBalance);
            setOriginalBeginningBalance(result.beginningBalance);
          }
          if (result.statementStartDate) {
            console.log('Statement start date from parser:', result.statementStartDate);
            const startDate = parseDate(result.statementStartDate);
            console.log('Parsed start date:', startDate);
            if (startDate) {
              updateFormData('startDate', startDate);
              setCustomStartDate(startDate);
            }
          } else {
            console.log('No statementStartDate in result');
          }
          if (result.previousBalance !== undefined || result.newBalance !== undefined) {
            setStatementBalances({
              previous: result.previousBalance,
              new: result.newBalance
            });
          }
        }
      } else {
        if (result.type === 'csv') {
          setCurrentStep('csv-mapping');
        } else {
          setMappedTransactions(result.transactions);
          setShowMappingSuccess(true);
        }
        setProcessingStatus('success');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(error.message || 'Failed to process file');
      setProcessingStatus('error');
      setUploadedFile(null);
    }
  };


  const handleCsvMap = (mappingConfig) => {
    const transactions = mapCsvToTransactions(
      processedData,
      mappingConfig.columnMappings,
      mappingConfig.amountType,
      mappingConfig.debitColumn,
      mappingConfig.creditColumn
    );

    setMappedTransactions(transactions);
    setProcessingStatus('success');
    setShowMappingSuccess(true);
    setCurrentStep('details');
  };

  const handleImportTransactions = async () => {
    try {
      let targetAccountId = selectedAccountId;
      let targetAccountObject;

      if (!isExistingAccount) {
        const accountDetail = selectedSubtype?.value === 'checking' ? 'checking_account' :
                             selectedSubtype?.value === 'savings' ? 'savings_account' :
                             selectedSubtype?.value === 'credit_card' ? 'personal_credit_card' :
                             'checking_account';

        const templateAccount = chartAccounts.find(t => t.account_detail === accountDetail);

        if (!templateAccount) {
          throw new Error('Could not find chart of accounts template');
        }

        const accountNumber = await getNextAccountNumber(activeProfile.id, templateAccount.account_number);

        const finalDisplayName = includeLastFour && formData.last4
          ? `${selectedAccountName} (...${formData.last4})`
          : selectedAccountName;

        const beginningBalanceForCalc = parseFloat(formData.beginningBalance) || 0;
        const isLiabilityAccount = templateAccount.class === 'liability';
        const transactionsSum = mappedTransactions.reduce((sum, txn) => {
          const amount = parseFloat(txn.amount) || 0;
          if (txn.type === 'income') {
            return isLiabilityAccount ? sum - amount : sum + amount;
          } else {
            return isLiabilityAccount ? sum + amount : sum - amount;
          }
        }, 0);

        const calculatedInitialBalance = beginningBalanceForCalc + transactionsSum;

        const newAccountData = {
          profile_id: activeProfile.id,
          template_id: templateAccount.id,
          template_account_number: templateAccount.account_number,
          account_number: accountNumber,
          display_name: finalDisplayName,
          account_detail: accountDetail,
          account_type: templateAccount.account_type,
          class: templateAccount.class,
          is_active: true,
          institution_name: formData.institutionName || '',
          account_number_last4: formData.last4 || '',
          current_balance: calculatedInitialBalance
        };

        const { data: newAccount, error: createError } = await firstsavvy
          .from('user_chart_of_accounts')
          .insert(newAccountData)
          .select()
          .single();

        if (createError) throw createError;
        targetAccountId = newAccount.id;
        targetAccountObject = newAccount;
      } else {
        const { data: existingAccount, error: fetchError } = await firstsavvy
          .from('user_chart_of_accounts')
          .select('*')
          .eq('id', targetAccountId)
          .single();

        if (fetchError || !existingAccount) {
          throw new Error('Failed to fetch existing account details');
        }
        targetAccountObject = existingAccount;
      }

      const transactionsToCheck = mappedTransactions.filter(txn => {
        const desc = txn.description?.toLowerCase() || '';
        const isBeginningBalance = desc.includes('beginning balance') && txn.amount === 0;

        if (isBeginningBalance) return false;

        if (customStartDate) {
          const txnDate = new Date(txn.date);
          const startDate = new Date(customStartDate);
          return txnDate >= startDate;
        }

        return true;
      });

      const { duplicates, uniqueTransactions } = await detectDuplicateTransactions(
        targetAccountId,
        transactionsToCheck
      );

      setDuplicateTransactions(duplicates);

      const transactionsToImport = skipDuplicates ? uniqueTransactions : transactionsToCheck;

      const beginningBalance = processedData?.beginningBalance || formData.beginningBalance;

      if (beginningBalance && parseFloat(beginningBalance) > 0 && transactionsToImport.length > 0) {
        try {
          const firstTransactionDate = customStartDate || transactionsToImport[0]?.date;

          if (firstTransactionDate && targetAccountObject) {
            await createOpeningBalanceTransaction(
              activeProfile.id,
              user.id,
              targetAccountObject,
              parseFloat(beginningBalance),
              firstTransactionDate
            );
            console.log(`Created opening balance of $${beginningBalance} for account ${targetAccountId} as of ${firstTransactionDate}`);
          }
        } catch (err) {
          console.error('Error creating opening balance:', err);
        }
      }

      const allTransactions = transactionsToImport
        .filter(txn => txn.amount > 0)
        .map(txn => ({
          profile_id: activeProfile.id,
          bank_account_id: targetAccountId,
          status: 'pending',
          date: txn.date,
          description: txn.description,
          original_description: txn.original_description,
          amount: Math.abs(txn.amount),
          type: txn.type
        }));

      if (allTransactions.length > 0) {
        const { error } = await firstsavvy
          .from('transactions')
          .insert(allTransactions);

        if (error) throw error;
      }

      const matchedCount = await autoMatchTransfers(allTransactions);

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts'] });

      const duplicateMsg = duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : '';
      const message = isExistingAccount
        ? `Successfully imported ${allTransactions.length} transactions to ${selectedAccountName}${duplicateMsg}`
        : `Successfully created ${selectedAccountName} and imported ${allTransactions.length} transactions${duplicateMsg}`;

      toast.success(`${message}${matchedCount > 0 ? ` - ${matchedCount} transfers matched` : ''}`);

      onOpenChange(false);
      if (targetAccountId) {
        setTimeout(() => {
          navigate(`/Banking/account/${targetAccountId}`);
        }, 100);
      }
    } catch (error) {
      console.error('Error importing transactions:', error);
      toast.error(error.message || 'Failed to import transactions');
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
          accountNumberLast4: data.account_number_last4
        });

        const { data: newAccount, error } = await firstsavvy
          .from('user_chart_of_accounts')
          .select()
          .eq('id', accountId)
          .single();

        if (error) throw error;
        return newAccount;
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
        return newAccount;
      }
    },
    onSuccess: async (newAccount) => {
      if (newAccount.current_balance && newAccount.current_balance !== 0) {
        try {
          await createOpeningBalanceJournalEntry({
            profileId: activeProfile.id,
            userId: user?.id,
            accountId: newAccount.id,
            openingBalance: newAccount.current_balance,
            openingDate: new Date().toISOString().split('T')[0],
            accountName: newAccount.display_name,
            accountClass: newAccount.class
          });
        } catch (error) {
          console.error('Failed to create opening balance journal entry:', error);
          toast.error('Account created but failed to create opening balance entry');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
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
          icon: template.icon,
          color: template.color,
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
        onAccountCreated({ type: formData.subtype, account: newCategory });
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
          type: selectedSubtype.value
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
        setCurrentStep('select-subtype');
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
    const filteredInstitutions = availableInstitutions.filter(inst =>
      inst.name.toLowerCase().includes(institutionSearch.toLowerCase())
    );

    const handleInstitutionSelect = async (institution) => {
      setSelectedInstitution(institution);
      setIsConnecting(true);

      try {
        setConnectionProgress('Connecting to ' + institution.name + '...');
        await simulateConnection(institution.id, activeProfile?.id);

        setConnectionProgress('Discovering accounts...');
        const accounts = await getInstitutionAccounts(institution.id, activeProfile?.id);

        setConnectionProgress('Loading transactions...');
        await new Promise(resolve => setTimeout(resolve, 500));

        const accountsWithData = await Promise.all(
          accounts.map(async (account) => {
            const transactions = await getAccountTransactions(account.id, institution.id);
            return {
              ...account,
              transactions,
              selected: false
            };
          })
        );

        setDiscoveredAccounts(accountsWithData);
        setSelectedAccountsToImport([]);
        setAccountConfigurations({});
        setImportAccountMappings({});
        setIsConnecting(false);
        setCurrentStep('accounts-discovered');
        toast.success(`Connected to ${institution.name}!`);
      } catch (error) {
        console.error('Connection error:', error);
        toast.error(error.message || 'Failed to connect to institution');
        setIsConnecting(false);
        setConnectionProgress('');
      }
    };

    if (isConnecting) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700">{connectionProgress}</p>
            <p className="text-sm text-gray-500 mt-2">Please wait...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search for your bank or credit union..."
            value={institutionSearch}
            onChange={(e) => setInstitutionSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto min-h-[200px]">
          {filteredInstitutions.length === 0 ? (
            <div className="col-span-3 flex flex-col items-center justify-center py-8 text-gray-500">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p>No institutions found</p>
            </div>
          ) : (
            filteredInstitutions.map(institution => (
              <button
                key={institution.id}
                onClick={() => handleInstitutionSelect(institution)}
                className="flex flex-col items-center cursor-pointer transition-all hover:scale-105 p-4 rounded-lg hover:bg-gray-50"
              >
                <div
                  className="rounded-full w-20 h-20 flex items-center justify-center shadow-lg hover:shadow-xl transition-all mb-2"
                  style={{ backgroundColor: institution.name.toLowerCase().includes('idaho central') ? '#003DA5' : '#52A5CE' }}
                >
                  <span className="text-white font-bold text-lg">
                    {institution.name.split(' ').map(w => w[0]).join('').slice(0, 3)}
                  </span>
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight">{institution.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => {
              setSelectedCard(null);
              setCurrentStep('select-type');
            }}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Or add account manually
          </button>
        </div>
      </div>
    );
  };

  const renderAccountsDiscovered = () => {
    const AccountTypeDetailSelector = ({ accountId, config }) => {
      const { accountTypes, isLoading: typesLoading } = useTemplateAccountTypesByClass(config.accountClass);
      const { accountDetails, isLoading: detailsLoading } = useTemplateAccountDetailsByType(
        config.accountClass,
        config.accountType
      );

      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`account-type-${accountId}`} className="text-xs font-medium">
              Account Type
            </Label>
            <Select
              value={config.accountType || ''}
              onValueChange={(value) => handleAccountTypeChange(accountId, value)}
              disabled={typesLoading}
            >
              <SelectTrigger id={`account-type-${accountId}`} className="h-9">
                <SelectValue placeholder={typesLoading ? "Loading..." : "Select type"} />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config.accountType && accountDetails.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor={`account-detail-${accountId}`} className="text-xs font-medium">
                Account Detail
              </Label>
              <Select
                value={config.accountDetail || ''}
                onValueChange={(value) => handleAccountDetailChange(accountId, value)}
                disabled={detailsLoading}
              >
                <SelectTrigger id={`account-detail-${accountId}`} className="h-9">
                  <SelectValue placeholder={detailsLoading ? "Loading..." : "Select detail"} />
                </SelectTrigger>
                <SelectContent>
                  {accountDetails.map((detail) => (
                    <SelectItem key={detail} value={detail}>
                      {formatLabel(detail)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      );
    };

    const toggleAccountSelection = (accountId, account) => {
      const isCurrentlySelected = selectedAccountsToImport.includes(accountId);

      if (isCurrentlySelected) {
        setSelectedAccountsToImport(prev => prev.filter(id => id !== accountId));
        setAccountConfigurations(prev => {
          const newConfig = { ...prev };
          delete newConfig[accountId];
          return newConfig;
        });
        setImportAccountMappings(prev => {
          const newMappings = { ...prev };
          delete newMappings[accountId];
          return newMappings;
        });
      } else {
        setSelectedAccountsToImport(prev => [...prev, accountId]);

        const accountTypeMapping = {
          'checking': { class: 'asset', type: 'bank_accounts', detail: 'checking_account' },
          'savings': { class: 'asset', type: 'bank_accounts', detail: 'savings_account' },
          'credit_card': { class: 'liability', type: 'credit_cards', detail: 'personal_credit_card' },
          'loan': { class: 'liability', type: 'loans', detail: 'personal_loan' },
          'mortgage': { class: 'liability', type: 'loans', detail: 'mortgage_primary' },
          'investment': { class: 'asset', type: 'investments', detail: 'brokerage_account' }
        };

        const mapping = accountTypeMapping[account.type] || { class: 'asset', type: 'bank_accounts', detail: 'checking_account' };

        const startDate = account.date_range?.start || '';
        let beginningBalance = '';
        const currentBalance = account.current_balance !== undefined && account.current_balance !== null
          ? Math.abs(account.current_balance).toString()
          : '';

        if (account.beginning_balance !== undefined && account.beginning_balance !== null) {
          beginningBalance = Math.abs(account.beginning_balance).toString();
        } else if (startDate && account.current_balance !== undefined && account.transactions) {
          const isLiability = mapping.class === 'liability';
          const calculatedBalance = calculateBeginningBalanceFromCurrent(
            account.current_balance,
            account.transactions,
            startDate,
            isLiability
          );
          beginningBalance = calculatedBalance.toString();
        }

        setAccountConfigurations(prev => ({
          ...prev,
          [accountId]: {
            displayName: account.name,
            accountClass: mapping.class,
            accountType: mapping.type,
            accountDetail: mapping.detail,
            last4: account.last_four,
            startDate: startDate,
            beginningBalance: beginningBalance,
            currentBalance: currentBalance
          }
        }));

        setImportAccountMappings(prev => ({
          ...prev,
          [accountId]: {
            chartAccountId: null,
            isExisting: false
          }
        }));
      }
    };

    const updateAccountConfig = (accountId, field, value) => {
      setAccountConfigurations(prev => {
        const updatedConfig = {
          ...prev,
          [accountId]: {
            ...prev[accountId],
            [field]: value
          }
        };

        if (field === 'startDate' && value) {
          const account = discoveredAccounts.find(acc => acc.id === accountId);
          if (account && account.current_balance !== undefined && account.transactions) {
            const isLiability = account.type === 'credit_card';
            const calculatedBalance = calculateBeginningBalanceFromCurrent(
              account.current_balance,
              account.transactions,
              value,
              isLiability
            );
            updatedConfig[accountId].beginningBalance = calculatedBalance.toString();
          }
        }

        return updatedConfig;
      });
    };

    const handleDisplayNameChange = (accountId, chartAccountId, displayName, isExisting) => {
      updateAccountConfig(accountId, 'displayName', displayName);
      setImportAccountMappings(prev => ({
        ...prev,
        [accountId]: {
          chartAccountId: isExisting ? chartAccountId : null,
          isExisting
        }
      }));
    };

    const handleAccountTypeChange = (accountId, newAccountType) => {
      updateAccountConfig(accountId, 'accountType', newAccountType);
      updateAccountConfig(accountId, 'accountDetail', '');
      updateAccountConfig(accountId, 'displayName', accountConfigurations[accountId]?.displayName || '');
      setImportAccountMappings(prev => ({
        ...prev,
        [accountId]: {
          chartAccountId: null,
          isExisting: false
        }
      }));
    };

    const handleAccountDetailChange = (accountId, newAccountDetail) => {
      updateAccountConfig(accountId, 'accountDetail', newAccountDetail);
      setImportAccountMappings(prev => ({
        ...prev,
        [accountId]: {
          chartAccountId: null,
          isExisting: false
        }
      }));
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    };

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {discoveredAccounts.map(account => {
            const isSelected = selectedAccountsToImport.includes(account.id);
            const config = accountConfigurations[account.id];
            const accountIcon = account.type === 'savings' ? PiggyBank : account.type === 'checking' ? Wallet : CreditCard;
            const AccountIcon = accountIcon;

            return (
              <Card
                key={account.id}
                className={`transition-all ${
                  isSelected ? 'ring-2 ring-blue-500' : 'hover:border-gray-300'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleAccountSelection(account.id, account)}
                      className="mt-1 flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          <AccountIcon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <h4 className="font-semibold text-gray-900 text-sm">{config?.displayName || account.name}</h4>
                            <span className="text-xs text-gray-500">...{account.last_four}</span>
                          </div>
                          <div className="flex items-baseline gap-3 mt-0.5">
                            <p className="text-base font-semibold text-gray-900">
                              ${account.current_balance?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(() => {
                                if (!config?.startDate || !account.transactions) return account.transaction_count;
                                const startDate = new Date(config.startDate);
                                return account.transactions.filter(txn => {
                                  const txnDate = new Date(txn.date);
                                  return txnDate >= startDate;
                                }).length;
                              })()} transactions
                            </p>
                          </div>
                        </div>
                      </div>

                      {isSelected && config && (
                        <div className="mt-4 pt-4 border-t space-y-4 animate-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <Label htmlFor={`display-name-${account.id}`} className="text-xs font-medium">
                              Display Name
                            </Label>
                            <AccountCombobox
                              accounts={userChartAccounts?.filter(acc =>
                                acc.account_type === config.accountType &&
                                acc.account_detail === config.accountDetail &&
                                acc.is_active === true
                              ) || []}
                              value={importAccountMappings[account.id]?.chartAccountId || config.displayName}
                              onValueChange={(chartAccountId, displayName, isExisting) =>
                                handleDisplayNameChange(account.id, chartAccountId, displayName, isExisting)
                              }
                              placeholder="Select existing or type new account name..."
                            />
                            {config.displayName && (
                              <Badge
                                variant={importAccountMappings[account.id]?.isExisting ? "default" : "secondary"}
                                className="text-xs mt-1"
                              >
                                {importAccountMappings[account.id]?.isExisting ? "Existing Account" : "New Account"}
                              </Badge>
                            )}
                          </div>

                          <AccountTypeDetailSelector accountId={account.id} config={config} />

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`last4-${account.id}`} className="text-xs font-medium">
                                Last 4 Digits
                              </Label>
                              <Input
                                id={`last4-${account.id}`}
                                value={config.last4}
                                readOnly
                                className="h-9 bg-gray-50"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`start-date-${account.id}`} className="text-xs font-medium">
                                Start Date
                              </Label>
                              <Input
                                id={`start-date-${account.id}`}
                                type="date"
                                value={formatDate(config.startDate)}
                                readOnly
                                className="h-9 bg-gray-50"
                              />
                              <p className="text-xs text-muted-foreground">
                                From statement
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`beginning-balance-${account.id}`} className="text-xs font-medium">
                              Beginning Balance
                            </Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                              <Input
                                id={`beginning-balance-${account.id}`}
                                type="number"
                                step="0.01"
                                value={config.beginningBalance || ''}
                                readOnly
                                placeholder="0.00"
                                className="h-9 pl-7 bg-gray-50"
                              />
                            </div>
                            {config.startDate && config.beginningBalance ? (
                              <div className="flex items-start gap-1 text-xs text-blue-600">
                                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <p>
                                  {account.beginning_balance !== undefined && account.beginning_balance !== null
                                    ? `From statement: Balance as of ${formatDate(config.startDate)}`
                                    : `Calculated from ending balance minus transactions from ${formatDate(config.startDate)}`
                                  }
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Balance as of {formatDate(config.startDate) || 'start date'}
                              </p>
                            )}
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

  const renderConfirmImport = () => {
    const selectedAccounts = discoveredAccounts.filter(acc =>
      selectedAccountsToImport.includes(acc.id)
    );

    const getFilteredTransactionCount = (account) => {
      const config = accountConfigurations[account.id];
      if (!config || !config.startDate) {
        return account.transaction_count;
      }

      const startDate = new Date(config.startDate);
      return account.transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate >= startDate;
      }).length;
    };

    const totalTransactions = selectedAccounts.reduce((sum, acc) => sum + getFilteredTransactionCount(acc), 0);

    const handleImport = async () => {
      try {
        toast.loading(`Importing ${selectedAccounts.length} accounts...`);

        for (const account of selectedAccounts) {
          const config = accountConfigurations[account.id];
          const mapping = importAccountMappings[account.id];

          if (!config) {
            console.error(`No configuration found for account ${account.id}`);
            continue;
          }

          let chartAccountId;
          let accountObject;

          if (mapping?.isExisting && mapping.chartAccountId) {
            chartAccountId = mapping.chartAccountId;

            const { data: existingAccount, error: fetchError } = await firstsavvy
              .from('user_chart_of_accounts')
              .select('*')
              .eq('id', chartAccountId)
              .single();

            if (fetchError || !existingAccount) {
              console.error('Error fetching existing account:', fetchError);
              toast.error(`Failed to link to existing account`);
              continue;
            }

            accountObject = existingAccount;

            const { error: updateError } = await firstsavvy
              .from('user_chart_of_accounts')
              .update({
                account_number_last4: config.last4,
                institution_name: selectedInstitution?.name || existingAccount.institution_name,
                current_balance: 0
              })
              .eq('id', chartAccountId);

            if (updateError) {
              console.error('Error updating existing account:', updateError);
            }
          } else {
            const template = chartAccounts.find(t => t.account_detail === config.accountDetail);

            if (!template) {
              console.error(`No template found for ${config.accountDetail}`);
              continue;
            }

            const accountNumber = await getNextAccountNumber(activeProfile.id, template.account_number);

            const newAccount = {
              profile_id: activeProfile.id,
              template_id: template.id,
              template_account_number: template.account_number,
              account_number: accountNumber,
              display_name: config.displayName,
              class: template.class,
              account_detail: template.account_detail,
              account_type: template.account_type,
              icon: template.icon,
              color: template.color,
              account_number_last4: config.last4,
              institution_name: selectedInstitution?.name || '',
              current_balance: 0,
              is_active: true
            };

            const { data: createdAccount, error: accountError } = await firstsavvy
              .from('user_chart_of_accounts')
              .insert(newAccount)
              .select()
              .single();

            if (accountError) {
              console.error('Error creating account:', accountError);
              continue;
            }

            chartAccountId = createdAccount.id;
            accountObject = createdAccount;
          }

          let filteredTransactions = account.transactions;

          if (config.startDate) {
            const startDate = new Date(config.startDate);
            filteredTransactions = account.transactions.filter(txn => {
              const txnDate = new Date(txn.date);
              return txnDate >= startDate;
            });
          }

          if (config.beginningBalance && parseFloat(config.beginningBalance) !== 0) {
            try {
              const firstTransactionDate = config.startDate || filteredTransactions[0]?.date;

              if (firstTransactionDate && accountObject) {
                await createOpeningBalanceTransaction(
                  activeProfile.id,
                  user.id,
                  accountObject,
                  parseFloat(config.beginningBalance),
                  firstTransactionDate
                );
                console.log(`Created opening balance of $${config.beginningBalance} for account ${chartAccountId} as of ${firstTransactionDate}`);
              }
            } catch (err) {
              console.error('Error creating opening balance:', err);
            }
          }

          const transactionsToInsert = filteredTransactions
            .filter(txn => txn.amount > 0)
            .map(txn => ({
              profile_id: activeProfile.id,
              user_id: user.id,
              bank_account_id: chartAccountId,
              date: txn.date,
              description: txn.description,
              original_description: txn.description,
              amount: Math.abs(txn.amount),
              type: txn.type === 'expense' ? 'expense' : 'income',
              original_type: txn.type === 'expense' ? 'expense' : 'income',
              status: 'pending',
              source: 'api'
            }));

          if (transactionsToInsert.length > 0) {
            console.log(`Inserting ${transactionsToInsert.length} transactions for account ${chartAccountId}`, transactionsToInsert[0]);
            const { data: insertedTxns, error: txnError } = await firstsavvy
              .from('transactions')
              .insert(transactionsToInsert)
              .select();

            if (txnError) {
              console.error('Error inserting transactions:', txnError);
              toast.error(`Failed to insert transactions for ${config.displayName}: ${txnError.message}`);
            } else {
              console.log(`Successfully inserted ${insertedTxns?.length || 0} transactions`);
            }
          }
        }

        queryClient.invalidateQueries(['user-chart-accounts']);
        queryClient.invalidateQueries(['transactions']);
        toast.dismiss();
        toast.success(`Successfully imported ${selectedAccounts.length} accounts with ${totalTransactions} transactions!`);
        onOpenChange(false);
      } catch (error) {
        console.error('Import error:', error);
        toast.dismiss();
        toast.error('Failed to import accounts');
      }
    };

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Ready to Import</h4>
          <div className="space-y-1 text-sm text-blue-800">
            <p>{selectedAccounts.length} accounts</p>
            <p>{totalTransactions} transactions</p>
            <p className="text-xs text-blue-600 mt-2">
              Estimated time: {Math.ceil(totalTransactions / 100)} seconds
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-[180px] overflow-y-auto">
          {selectedAccounts.map(account => {
            const config = accountConfigurations[account.id];
            const filteredCount = getFilteredTransactionCount(account);

            return (
              <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{config?.displayName || account.name}</p>
                  <p className="text-sm text-gray-600">...{config?.last4 || account.last_four}</p>
                </div>
                <div className="text-right">
                  {config?.beginningBalance ? (
                    <p className="font-semibold text-gray-900">${parseFloat(config.beginningBalance).toFixed(2)}</p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No beginning balance</p>
                  )}
                  <p className="text-xs text-gray-500">{filteredCount} transactions</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleImport}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Import Now
            <Check className="w-4 h-4 ml-2" />
          </Button>
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
        <div className="space-y-5 max-w-lg mx-auto">
          <div>
            <Label htmlFor="displayName">Display Name*</Label>
            <div className="relative">
              <AccountCombobox
                accounts={existingAccounts}
                value={selectedAccountId || selectedAccountName}
                onValueChange={(accountId, accountName, isExisting) => {
                  setSelectedAccountId(accountId);
                  setSelectedAccountName(accountName);
                  setIsExistingAccount(isExisting);
                  updateFormData('name', accountName);
                }}
                placeholder="Select existing or type new account name..."
              />
              {selectedAccountName && (
                <div className="mt-2">
                  <Badge variant={isExistingAccount ? "default" : "secondary"} className="text-xs">
                    {isExistingAccount ? "Existing Account" : "New Account"}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => !uploadedFile && document.getElementById('file-upload-details')?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer"
          >
            {processingStatus === 'processing' || processingStatus === 'uploading' || processingStatus === 'extracting' ? (
              <div className="space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                <div className="text-sm text-muted-foreground">
                  {processingStatus === 'uploading' && 'Uploading file...'}
                  {processingStatus === 'extracting' && 'Extracting transactions...'}
                  {processingStatus === 'processing' && 'Processing file...'}
                </div>
              </div>
            ) : uploadedFile ? (
              <div className="space-y-2">
                {showMappingSuccess ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto" />
                ) : (
                  <FileUp className="w-6 h-6 text-green-600 mx-auto" />
                )}
                <div className="text-sm font-medium">{uploadedFile.name}</div>
                {showMappingSuccess && mappedTransactions.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Mapping Complete</span>
                    </div>
                    <div className="text-xs text-green-700">
                      {mappedTransactions.length} transactions ready to import
                    </div>
                    {mappedTransactions.length > 0 && (
                      <div className="mt-2 text-xs text-green-700">
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
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium mb-1">Upload Bank Statement</p>
                <p className="text-xs text-muted-foreground">
                  Drag and drop or click to upload
                </p>
                <input
                  type="file"
                  accept=".csv,.ofx,.qfx,.pdf"
                  className="hidden"
                  id="file-upload-details"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports CSV, OFX, QFX, and PDF formats
                </p>
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

      const categoryTypes = formData.subtype === 'income' ? INCOME_TYPES : EXPENSE_TYPES;

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
          <div>
            <Label htmlFor="accountDetail">Category Type*</Label>
            <Select
              value={formData.accountDetail || ''}
              onValueChange={(value) => updateFormData('accountDetail', value)}
              required
            >
              <SelectTrigger id="accountDetail">
                <SelectValue placeholder={`Select ${formData.subtype === 'income' ? 'income' : 'expense'} type`} />
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

  const renderCsvMappingStep = () => (
    <div className="max-w-2xl mx-auto">
      <CsvColumnMapper
        csvData={processedData}
        onMap={handleCsvMap}
        onCancel={() => {
          setCurrentStep('details');
          setUploadedFile(null);
          setProcessedData(null);
        }}
      />
    </div>
  );

  const renderBankInfoStep = () => {
    const dateRange = getTransactionDateRange(mappedTransactions);

    const displayNameWithLast4 = includeLastFour && formData.last4
      ? `${selectedAccountName} (...${formData.last4})`
      : selectedAccountName;

    const handleDisplayNameChange = (e) => {
      let newValue = e.target.value;
      if (includeLastFour && formData.last4) {
        const suffix = ` (...${formData.last4})`;
        if (newValue.endsWith(suffix)) {
          newValue = newValue.slice(0, -suffix.length);
        }
      }
      setSelectedAccountName(newValue);
      updateFormData('name', newValue);
    };

    const handleStartDateChange = (newStartDate) => {
      setCustomStartDate(newStartDate);

      if (originalBeginningBalance !== null && mappedTransactions.length > 0 && newStartDate) {
        const isLiability = selectedSubtype?.value === 'credit_card';
        const calculatedBalance = calculateOpeningBalanceForDate(
          originalBeginningBalance,
          mappedTransactions,
          newStartDate,
          isLiability
        );
        updateFormData('beginningBalance', calculatedBalance);
      }
    };

    const effectiveStartDate = customStartDate || dateRange.startDate;

    return (
      <div className="space-y-5 max-w-lg mx-auto">

        <div>
          <Label htmlFor="displayName">Display Name*</Label>
          <Input
            id="displayName"
            placeholder="e.g., Main Checking"
            value={displayNameWithLast4}
            onChange={handleDisplayNameChange}
            required
          />
          <div className="flex items-center space-x-2 mt-2">
            <Checkbox
              id="includeLastFour"
              checked={includeLastFour}
              onCheckedChange={(checked) => setIncludeLastFour(checked)}
              disabled={!formData.last4}
            />
            <Label htmlFor="includeLastFour" className="cursor-pointer font-normal text-sm text-muted-foreground">
              Include last 4 digits in name
            </Label>
          </div>
        </div>

        <div>
          <Label htmlFor="institutionName">Institution Name*</Label>
          <Input
            id="institutionName"
            placeholder="e.g., Chase, Bank of America"
            value={formData.institutionName || ''}
            onChange={(e) => updateFormData('institutionName', e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter the bank or financial institution name
          </p>
        </div>

        <div>
          <Label htmlFor="last4">Account Number (Last 4 Digits)</Label>
          <Input
            id="last4"
            placeholder="1234"
            maxLength={4}
            value={formData.last4 || ''}
            onChange={(e) => updateFormData('last4', e.target.value.replace(/\D/g, ''))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter the last 4 digits of your account number (optional)
          </p>
        </div>

        {dateRange.startDate && dateRange.endDate && (
          <div>
            <Label htmlFor="startDate">Import Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={effectiveStartDate || ''}
              onChange={(e) => handleStartDateChange(e.target.value)}
              min={dateRange.startDate}
              max={dateRange.endDate}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Choose which date to start importing transactions from
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="beginningBalance">Beginning Balance*</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <Input
              id="beginningBalance"
              type="text"
              value={formatAmountField('beginningBalance', formData.beginningBalance, focusedFields.beginningBalance)}
              onChange={(e) => handleAmountChange('beginningBalance', e.target.value)}
              onFocus={() => setFocusedFields(prev => ({ ...prev, beginningBalance: true }))}
              onBlur={(e) => handleAmountBlur('beginningBalance', e.target.value)}
              placeholder="0.00"
              className="pl-7"
              required
            />
          </div>
          {statementBalances.previous !== null && customStartDate && originalBeginningBalance !== null ? (
            <div className="text-xs text-muted-foreground mt-1 space-y-1">
              <p className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                Calculated from statement balance of ${statementBalances.previous?.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">
                Adjusted for transactions before {effectiveStartDate}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Enter the balance as of {effectiveStartDate || 'the first transaction'}
            </p>
          )}
        </div>

        {dateRange.startDate && dateRange.endDate && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              {mappedTransactions.filter(txn => new Date(txn.date) >= new Date(effectiveStartDate)).length} transactions will be imported
            </p>
            <p className="text-xs text-muted-foreground">
              Date range: {effectiveStartDate} to {dateRange.endDate}
            </p>
            {customStartDate && (
              <p className="text-xs text-blue-600">
                {mappedTransactions.filter(txn => new Date(txn.date) < new Date(effectiveStartDate)).length} transactions excluded (before start date)
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select-type':
        return renderSelectType();
      case 'connect-bank':
        return renderConnectBankStep();
      case 'accounts-discovered':
        return renderAccountsDiscovered();
      case 'csv-mapping':
        return renderCsvMappingStep();
      case 'bank-info':
        return renderBankInfoStep();
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
    if (currentStep === 'connect-bank') return 'Connect Your Bank';
    if (currentStep === 'accounts-discovered') return 'Select Accounts to Import';
    if (currentStep === 'csv-mapping') return 'Map CSV Columns';
    if (currentStep === 'bank-info') return 'Bank Account Details';
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
        <DialogContent className={`${currentStep === 'csv-mapping' ? 'w-[800px] max-w-[90vw]' : currentStep === 'connect-bank' || currentStep === 'accounts-discovered' ? 'w-[600px] max-w-[90vw]' : 'w-[550px]'} p-0 ${(currentStep === 'select-type' || currentStep === 'select-subtype' || currentStep === 'connect-bank') ? 'bg-gradient-to-br from-slate-50 to-blue-50' : ''}`}>
          <div className={`relative flex flex-col ${currentStep === 'csv-mapping' ? 'h-[600px]' : currentStep === 'accounts-discovered' ? 'h-[500px]' : 'h-[400px]'}`}>
            <DialogHeader className="pt-5 px-5 flex-shrink-0">
              <DialogTitle className="text-center text-xl">{getStepTitle()}</DialogTitle>
            </DialogHeader>

            <div className={`py-5 px-5 flex-1 overflow-y-auto ${(currentStep === 'select-type' || currentStep === 'select-subtype') ? 'flex items-center justify-center' : ''}`}>
              {renderCurrentStep()}
            </div>

            {currentStep !== 'select-type' && currentStep !== 'csv-mapping' && (
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

                {currentStep === 'accounts-discovered' && (
                  <Button
                    type="button"
                    className="ml-auto bg-blue-600 hover:bg-blue-700 rounded-full px-6"
                    onClick={async () => {
                      const selectedAccounts = discoveredAccounts.filter(acc =>
                        selectedAccountsToImport.includes(acc.id)
                      );

                      const getFilteredTransactionCount = (account) => {
                        const config = accountConfigurations[account.id];
                        if (!config || !config.startDate) {
                          return account.transaction_count;
                        }

                        const startDate = new Date(config.startDate);
                        return account.transactions.filter(txn => {
                          const txnDate = new Date(txn.date);
                          return txnDate >= startDate;
                        }).length;
                      };

                      const totalTransactions = selectedAccounts.reduce((sum, acc) => sum + getFilteredTransactionCount(acc), 0);

                      try {
                        toast.loading(`Importing ${selectedAccounts.length} accounts...`);

                        for (const account of selectedAccounts) {
                          const config = accountConfigurations[account.id];
                          const mapping = importAccountMappings[account.id];

                          if (!config) {
                            console.error(`No configuration found for account ${account.id}`);
                            continue;
                          }

                          let chartAccountId;
                          let accountObject;

                          if (mapping?.isExisting && mapping.chartAccountId) {
                            chartAccountId = mapping.chartAccountId;

                            const { data: existingAccount, error: fetchError } = await firstsavvy
                              .from('user_chart_of_accounts')
                              .select('*')
                              .eq('id', chartAccountId)
                              .single();

                            if (fetchError || !existingAccount) {
                              console.error('Error fetching existing account:', fetchError);
                              toast.error(`Failed to link to existing account`);
                              continue;
                            }

                            accountObject = existingAccount;

                            const { error: updateError } = await firstsavvy
                              .from('user_chart_of_accounts')
                              .update({
                                account_number_last4: config.last4,
                                institution_name: selectedInstitution?.name || existingAccount.institution_name,
                                current_balance: account.current_balance
                              })
                              .eq('id', chartAccountId);

                            if (updateError) {
                              console.error('Error updating existing account:', updateError);
                            }
                          } else {
                            const template = chartAccounts.find(t => t.account_detail === config.accountDetail);

                            if (!template) {
                              console.error(`No template found for ${config.accountDetail}`);
                              continue;
                            }

                            const accountNumber = await getNextAccountNumber(activeProfile.id, template.account_number);

                            const newAccount = {
                              profile_id: activeProfile.id,
                              template_id: template.id,
                              template_account_number: template.account_number,
                              account_number: accountNumber,
                              display_name: config.displayName,
                              class: template.class,
                              account_detail: template.account_detail,
                              account_type: template.account_type,
                              icon: template.icon,
                              color: template.color,
                              account_number_last4: config.last4,
                              institution_name: selectedInstitution?.name || '',
                              current_balance: account.current_balance,
                              is_active: true
                            };

                            const { data: createdAccount, error: accountError } = await firstsavvy
                              .from('user_chart_of_accounts')
                              .insert(newAccount)
                              .select()
                              .single();

                            if (accountError) {
                              console.error('Error creating account:', accountError);
                              continue;
                            }

                            chartAccountId = createdAccount.id;
                            accountObject = createdAccount;
                          }

                          console.log(`[OPENING BALANCE DEBUG] Account: ${account.name}`);
                          console.log(`[OPENING BALANCE DEBUG] config.beginningBalance RAW:`, config.beginningBalance);
                          console.log(`[OPENING BALANCE DEBUG] config.startDate:`, config.startDate);
                          console.log(`[OPENING BALANCE DEBUG] account.type:`, account.type);
                          console.log(`[OPENING BALANCE DEBUG] config.accountClass:`, config.accountClass);

                          let beginningBalance = null;
                          if (config.beginningBalance !== undefined && config.beginningBalance !== null && config.beginningBalance !== '') {
                            beginningBalance = parseFloat(config.beginningBalance);
                            if (isNaN(beginningBalance)) {
                              console.warn(`[OPENING BALANCE DEBUG] Failed to parse beginning balance: ${config.beginningBalance}`);
                              beginningBalance = null;
                            }
                          }

                          console.log(`[OPENING BALANCE DEBUG] beginningBalance PARSED:`, beginningBalance);

                          let filteredTransactions = account.transactions.filter(txn => {
                            const desc = txn.description?.toLowerCase() || '';
                            return !(desc.includes('beginning balance') && txn.amount === 0);
                          });

                          if (config.startDate) {
                            const startDate = new Date(config.startDate);
                            filteredTransactions = filteredTransactions.filter(txn => {
                              const txnDate = new Date(txn.date);
                              return txnDate >= startDate;
                            });
                          }

                          console.log(`[OPENING BALANCE DEBUG] filteredTransactions.length:`, filteredTransactions.length);
                          console.log(`[OPENING BALANCE DEBUG] Condition check: beginningBalance=${beginningBalance}, !== 0? ${beginningBalance !== 0}, hasTxns? ${filteredTransactions.length > 0}`);

                          if (beginningBalance !== null && beginningBalance !== 0 && filteredTransactions.length > 0) {
                            console.log(`[OPENING BALANCE DEBUG] CREATING OPENING BALANCE`);
                            try {
                              const firstTransactionDate = config.startDate || filteredTransactions[0]?.date;

                              if (firstTransactionDate && accountObject) {
                                console.log(`[OPENING BALANCE DEBUG] Calling createOpeningBalanceTransaction with:`, {
                                  profileId: activeProfile.id,
                                  userId: user.id,
                                  accountId: accountObject.id,
                                  amount: beginningBalance,
                                  date: firstTransactionDate
                                });

                                await createOpeningBalanceTransaction(
                                  activeProfile.id,
                                  user.id,
                                  accountObject,
                                  beginningBalance,
                                  firstTransactionDate
                                );
                                console.log(`✓ Created opening balance of $${beginningBalance} for account ${chartAccountId} as of ${firstTransactionDate}`);
                              } else {
                                console.warn(`[OPENING BALANCE DEBUG] Missing required data:`, {
                                  firstTransactionDate,
                                  accountObject: !!accountObject
                                });
                              }
                            } catch (err) {
                              console.error('Error creating opening balance:', err);
                            }
                          } else {
                            console.log(`[OPENING BALANCE DEBUG] SKIPPING opening balance creation - condition not met`);
                          }

                          const transactionsToInsert = filteredTransactions
                            .filter(txn => txn.amount > 0)
                            .map(txn => ({
                              profile_id: activeProfile.id,
                              user_id: user.id,
                              bank_account_id: chartAccountId,
                              date: txn.date,
                              description: txn.description,
                              original_description: txn.description,
                              amount: Math.abs(txn.amount),
                              type: txn.type === 'expense' ? 'expense' : 'income',
                              original_type: txn.type === 'expense' ? 'expense' : 'income',
                              status: 'pending',
                              source: 'api'
                            }));

                          if (transactionsToInsert.length > 0) {
                            console.log(`Inserting ${transactionsToInsert.length} transactions for account ${chartAccountId}`, transactionsToInsert[0]);
                            const { data: insertedTxns, error: txnError } = await firstsavvy
                              .from('transactions')
                              .insert(transactionsToInsert)
                              .select();

                            if (txnError) {
                              console.error('Error inserting transactions:', txnError);
                              toast.error(`Failed to insert transactions for ${config.displayName}: ${txnError.message}`);
                            } else {
                              console.log(`Successfully inserted ${insertedTxns?.length || 0} transactions`);
                            }
                          }
                        }

                        queryClient.invalidateQueries(['user-chart-accounts']);
                        queryClient.invalidateQueries(['transactions']);
                        toast.dismiss();
                        toast.success(`Successfully imported ${selectedAccounts.length} accounts with ${totalTransactions} transactions!`);
                        onOpenChange(false);
                      } catch (error) {
                        console.error('Import error:', error);
                        toast.dismiss();
                        toast.error('Failed to import accounts');
                      }
                    }}
                    disabled={selectedAccountsToImport.length === 0 || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        Import ({selectedAccountsToImport.length} selected)
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
    </>
  );
}
