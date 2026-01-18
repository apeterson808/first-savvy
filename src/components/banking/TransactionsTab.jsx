import React, { useState } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClickThroughSelect, ClickThroughSelectItem, ClickThroughSelectSeparator } from '@/components/ui/ClickThroughSelect';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ClickThroughDropdownMenu,
  ClickThroughDropdownMenuContent,
  ClickThroughDropdownMenuItem,
  ClickThroughDropdownMenuTrigger,
} from "@/components/ui/ClickThroughDropdownMenu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronDown, SlidersHorizontal, Printer, Download, Settings, Loader2, Info, Plus, Link2, Unlink, Wand2 } from 'lucide-react';
import { subDays, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO, format } from 'date-fns';
import TransactionFilterPanel from './TransactionFilterPanel';
import AccountCreationWizard from './AccountCreationWizard';
import { validateAmount, sanitizeForLLM, validateDate } from '../utils/validation';
import { withRetry, showErrorToast, logError } from '../utils/errorHandler';
import { formatTransactionDescription } from '../utils/formatters';
import ChartAccountDropdown from '../common/ChartAccountDropdown';
import AccountDropdown from '../common/AccountDropdown';
import ContactDropdown from '../common/ContactDropdown';
import CategoryDropdown from '../common/CategoryDropdown';
import TransferMatchDialog from './TransferMatchDialog';
import TransferPostPreviewDialog from './TransferPostPreviewDialog';
import AddContactSheet from '../contacts/AddContactSheet';
import { getAccountDisplayName } from '../utils/constants';
import { toast } from 'sonner';
import { useProfile } from '@/contexts/ProfileContext';
import { getTransactionSplits, createTransactionSplits, updateTransactionSplits, deleteTransactionSplits } from '@/api/transactionSplits';
import { Trash2 } from 'lucide-react';
import { TransactionReviewDialog } from './TransactionReviewDialog';
import { usePersistedViewState } from '@/hooks/usePersistedViewState';
import { deleteViewPreferences } from '@/api/viewPreferences';
import { useAutomaticTransferDetection } from '@/hooks/useAutomaticTransferDetection';
import { useAutomaticCreditCardPaymentDetection } from '@/hooks/useAutomaticCreditCardPaymentDetection';
import { transferAutoDetectionAPI } from '@/api/transferAutoDetection';
import { creditCardPaymentDetectionAPI } from '@/api/creditCardPaymentDetection';
import transactionRulesApi from '@/api/transactionRules';
import aiCategorizationApi from '@/api/aiCategorization';
import categorizationMemoryAPI from '@/api/categorizationMemory';
import { useAuth } from '@/contexts/AuthContext';
import CreditCardPaymentMatchDialog from './CreditCardPaymentMatchDialog';

export default function TransactionsTab({ initialFilters, onFiltersApplied }) {
  const { activeProfile } = useProfile();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = usePersistedViewState(
    'transactions_status',
    'pending',
    activeProfile?.id,
    initialFilters?.status
  );
  const [sortBy, setSortBy] = usePersistedViewState(
    'transactions_sort',
    '-date',
    activeProfile?.id
  );
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [selectedAccount, setSelectedAccount] = usePersistedViewState(
    'transactions_account',
    'all',
    activeProfile?.id,
    initialFilters?.account
  );
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [addAccountSheetOpen, setAddAccountSheetOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [triggeringTransactionId, setTriggeringTransactionId] = useState(null);
  const [triggeringTransactionType, setTriggeringTransactionType] = useState(null);
  const [addContactSheetOpen, setAddContactSheetOpen] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [triggeringContactTransactionId, setTriggeringContactTransactionId] = useState(null);
  const [autoContactSuggestionIds, setAutoContactSuggestionIds] = useState(new Set());
  const [categorySuggestions, setCategorySuggestions] = useState({});
  const [transferMatchDialogOpen, setTransferMatchDialogOpen] = useState(false);
  const [transferPostPreviewOpen, setTransferPostPreviewOpen] = useState(false);
  const [matchingTransfer, setMatchingTransfer] = useState(null);
  const [pairedTransfer, setPairedTransfer] = useState(null);
  const [ccPaymentDialogOpen, setCCPaymentDialogOpen] = useState(false);
  const [matchingCCPayment, setMatchingCCPayment] = useState(null);
  const [pairedCCPayment, setPairedCCPayment] = useState(null);
  const [isPostingTransfer, setIsPostingTransfer] = useState(false);
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [manualActionOverrides, setManualActionOverrides] = useState({});
  const [selectedMatches, setSelectedMatches] = useState({});
  const [manualMatchSearch, setManualMatchSearch] = useState({});
  const [manualMatchFilters, setManualMatchFilters] = useState({});
  const [manualMatchFilterInputs, setManualMatchFilterInputs] = useState({});
  const [splitModeTransactions, setSplitModeTransactions] = useState(new Set());
  const [splitLineItems, setSplitLineItems] = useState({});
  const [loadingSplits, setLoadingSplits] = useState(new Set());
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [suggestedMatches, setSuggestedMatches] = useState({});
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);

  const getTransactionAccountId = (transaction) => {
    return transaction.bank_account_id;
  };

  const getAccountDetails = (accountId) => {
    return accounts.find(acc => acc.id === accountId);
  };

  const isMatched = (transaction) => {
    return transaction && (transaction.transfer_pair_id != null || transaction.cc_payment_pair_id != null);
  };

  const isSplitMode = (transactionId) => {
    return splitModeTransactions.has(transactionId);
  };

  const initializeSplitMode = async (transaction) => {
    setSplitModeTransactions(prev => new Set(prev).add(transaction.id));

    if (transaction.is_split) {
      setLoadingSplits(prev => new Set(prev).add(transaction.id));
      try {
        const existingSplits = await getTransactionSplits(transaction.id);
        setSplitLineItems(prev => ({
          ...prev,
          [transaction.id]: existingSplits.map(split => ({
            id: split.id,
            description: split.description || transaction.description,
            amount: Math.abs(split.amount).toFixed(2),
            category_account_id: split.category_account_id
          }))
        }));
      } catch (error) {
        console.error('Error loading splits:', error);
        toast.error('Failed to load split data');
      } finally {
        setLoadingSplits(prev => {
          const next = new Set(prev);
          next.delete(transaction.id);
          return next;
        });
      }
    } else {
      const totalAmount = Math.abs(transaction.amount);
      setSplitLineItems(prev => ({
        ...prev,
        [transaction.id]: [
          {
            id: `temp-${Date.now()}-1`,
            description: transaction.description,
            amount: '',
            category_account_id: transaction.category_account_id || null
          },
          {
            id: `temp-${Date.now()}-2`,
            description: transaction.description,
            amount: '',
            category_account_id: null
          }
        ]
      }));
    }
  };

  const cancelSplitMode = async (transactionId, transaction) => {
    if (transaction && transaction.is_split) {
      try {
        await deleteTransactionSplits(transactionId);
        queryClient.invalidateQueries(['transactions']);
        toast.success('Split removed');
      } catch (error) {
        console.error('Error removing split:', error);
        toast.error('Failed to remove split');
        return;
      }
    }
    setSplitModeTransactions(prev => {
      const next = new Set(prev);
      next.delete(transactionId);
      return next;
    });
    setSplitLineItems(prev => {
      const next = { ...prev };
      delete next[transactionId];
      return next;
    });
  };

  const updateSplitLine = (transactionId, lineIndex, field, value) => {
    setSplitLineItems(prev => {
      const lines = [...(prev[transactionId] || [])];
      lines[lineIndex] = { ...lines[lineIndex], [field]: value };

      if (field === 'amount' && lines.length === 2) {
        const amount1 = parseFloat(lines[0].amount) || 0;
        const totalAmount = Math.abs(transactions.find(t => t.id === transactionId)?.amount || 0);
        const remaining = totalAmount - amount1;
        if (lineIndex === 0 && remaining >= 0) {
          lines[1] = { ...lines[1], amount: remaining.toFixed(2) };
        }
      }

      return { ...prev, [transactionId]: lines };
    });
  };

  const addSplitLine = (transactionId, transaction) => {
    setSplitLineItems(prev => {
      const lines = [...(prev[transactionId] || [])];
      lines.push({
        id: `temp-${Date.now()}-${lines.length + 1}`,
        description: transaction.description,
        amount: '',
        category_account_id: null
      });
      return { ...prev, [transactionId]: lines };
    });
  };

  const removeSplitLine = (transactionId, lineIndex) => {
    setSplitLineItems(prev => {
      const lines = [...(prev[transactionId] || [])];
      if (lines.length <= 2) return prev;
      lines.splice(lineIndex, 1);
      return { ...prev, [transactionId]: lines };
    });
  };

  const getRemainingAmount = (transaction, currentLineIndex) => {
    const lines = splitLineItems[transaction.id] || [];
    const totalAmount = Math.abs(transaction.amount);
    const allocatedSoFar = lines.reduce((sum, line, idx) => {
      if (idx < currentLineIndex) {
        return sum + (parseFloat(line.amount) || 0);
      }
      return sum;
    }, 0);
    return totalAmount - allocatedSoFar;
  };

  const getSplitValidation = (transaction) => {
    const lines = splitLineItems[transaction.id] || [];
    const totalAmount = Math.abs(transaction.amount);
    const splitTotal = lines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
    const diff = Math.abs(totalAmount - splitTotal);

    const isValid = diff < 0.01 && lines.length >= 2 && lines.every(line =>
      line.category_account_id && parseFloat(line.amount) > 0
    );

    return {
      isValid,
      totalAmount,
      splitTotal,
      difference: totalAmount - splitTotal,
      hasAllCategories: lines.every(line => line.category_account_id),
      hasAllAmounts: lines.every(line => parseFloat(line.amount) > 0)
    };
  };

  const handleResetViewSettings = async () => {
    if (!activeProfile?.id) return;

    try {
      await Promise.all([
        deleteViewPreferences(activeProfile.id, 'transactions_filters'),
        deleteViewPreferences(activeProfile.id, 'transactions_status'),
        deleteViewPreferences(activeProfile.id, 'transactions_sort'),
        deleteViewPreferences(activeProfile.id, 'transactions_account')
      ]);

      setFilters(defaultFilters);
      setStatusFilter('pending');
      setSortBy('-date');
      setSelectedAccount('all');

      toast.success('View settings reset to defaults');
    } catch (error) {
      console.error('Error resetting view settings:', error);
      toast.error('Failed to reset view settings');
    }
  };

  const handlePostWithSplit = async (transaction) => {
    if (isSplitMode(transaction.id)) {
      const lines = splitLineItems[transaction.id] || [];
      const validation = getSplitValidation(transaction);

      if (!validation.isValid) {
        toast.error('Please ensure all split lines have categories and amounts that sum to the transaction total');
        return false;
      }

      try {
        const splits = lines.map(line => ({
          category_account_id: line.category_account_id,
          amount: parseFloat(line.amount),
          description: line.description
        }));

        if (transaction.is_split) {
          await updateTransactionSplits(transaction.id, activeProfile.id, transaction.user_id, splits);
        } else {
          await createTransactionSplits(transaction.id, activeProfile.id, transaction.user_id, splits);
        }

        cancelSplitMode(transaction.id, transaction);
        return true;
      } catch (error) {
        console.error('Error saving split:', error);
        toast.error('Failed to save split');
        return false;
      }
    }
    return true;
  };

  // Compute filter override from initialFilters (chart click) or URL params
  const computeFilterOverride = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCategory = urlParams.get('category');

    if (initialFilters?.date) {
      return {
        datePreset: 'custom',
        dateFrom: initialFilters.date,
        dateTo: initialFilters.date,
        account: initialFilters.account || 'all',
        category: initialFilters.category || urlCategory || 'all',
        type: 'all',
        amountMin: '',
        amountMax: '',
        paymentMethod: 'all'
      };
    }
    if (initialFilters?.category) {
      const monthOffset = parseInt(initialFilters.month || '0');
      const today = new Date();
      const targetDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
      const monthStart = format(startOfMonth(targetDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(targetDate), 'yyyy-MM-dd');

      return {
        datePreset: 'custom',
        dateFrom: monthStart,
        dateTo: monthEnd,
        account: initialFilters.account || 'all',
        category: initialFilters.category,
        type: 'expense',
        amountMin: '',
        amountMax: '',
        paymentMethod: 'all'
      };
    }
    return null;
  };

  const defaultFilters = {
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    account: 'all',
    category: (() => {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('category') || 'all';
    })(),
    type: 'all',
    amountMin: '',
    amountMax: '',
    paymentMethod: 'all'
  };

  const [filters, setFilters] = usePersistedViewState(
    'transactions_filters',
    defaultFilters,
    activeProfile?.id,
    computeFilterOverride()
  );

  // Clear parent's transactionFilters after initial load
  React.useEffect(() => {
    if (initialFilters?.date && onFiltersApplied) {
      // Call after a short delay to ensure filters are applied
      const timer = setTimeout(() => onFiltersApplied(), 100);
      return () => clearTimeout(timer);
    }
  }, []);
  const [columnWidths, setColumnWidths] = useState({
    account: 140,
    description: 200,
    spent: 96,
    received: 96,
    fromTo: 150,
    categorize: 150
  });
  const [resizing, setResizing] = useState(null);
  const tableContainerRef = React.useRef(null);
  const queryClient = useQueryClient();

  const { data: fullPendingTransactions = [] } = useQuery({
    queryKey: ['fullPendingTransactions', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Transaction.filter({ status: 'pending' }, '-date,id', 10000),
    enabled: !!activeProfile?.id
  });

  const { data: fullPostedTransactions = [] } = useQuery({
    queryKey: ['fullPostedTransactions', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Transaction.filter({ status: 'posted' }, '-date,id', 10000),
    enabled: !!activeProfile?.id
  });

  const { data: fullExcludedTransactions = [] } = useQuery({
    queryKey: ['fullExcludedTransactions', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Transaction.filter({ status: 'excluded' }, '-date,id', 10000),
    enabled: !!activeProfile?.id
  });

  const transactions = [...fullPendingTransactions, ...fullPostedTransactions, ...fullExcludedTransactions];

  React.useEffect(() => {
    const fetchAISuggestions = async () => {
      if (!activeProfile?.id || transactions.length === 0) return;

      const uncategorizedTransactions = transactions
        .filter(txn => !txn.category_account_id && txn.type !== 'transfer')
        .slice(0, 20);

      if (uncategorizedTransactions.length === 0) return;

      const suggestions = await aiCategorizationApi.getSuggestionsForTransactions(
        uncategorizedTransactions
      );

      setCategorySuggestions(suggestions);
    };

    fetchAISuggestions();
  }, [transactions.length, activeProfile?.id]);

  const { data: fetchedAccounts = [] } = useQuery({
    queryKey: ['activeAccounts', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Account.filter({ is_active: true }),
    enabled: !!activeProfile?.id
  });

  const accounts = fetchedAccounts.map(acc => ({
    ...acc,
    account_name: acc.display_name || acc.account_name,
    institution: acc.institution_name,
    entityType: acc.account_type === 'credit_card' ? 'CreditCard' : 'BankAccount'
  }));

  const { detectNewTransactions } = useAutomaticTransferDetection(
    activeProfile?.id,
    fullPendingTransactions
  );

  const { detectNewPayments } = useAutomaticCreditCardPaymentDetection(
    activeProfile?.id,
    fullPendingTransactions
  );

  // Fetch all active accounts for Match tab dropdown (from unified chart of accounts)
  const { data: allActiveAccounts = [] } = useQuery({
    queryKey: ['allActiveAccountsForMatch', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);

      return accounts
        .filter(a => a.is_active && ['asset', 'liability'].includes(a.class))
        .map(a => ({
          ...a,
          account_name: a.display_name || a.account_name,
          institution: a.institution_name,
          entityType: a.account_type === 'credit_card' ? 'CreditCard' :
                      a.class === 'asset' ? 'Asset' :
                      a.class === 'liability' ? 'Liability' : 'BankAccount'
        }));
    },
    enabled: !!activeProfile?.id
  });

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts-income-expense', activeProfile?.id],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('user_chart_of_accounts')
        .select('*')
        .eq('profile_id', activeProfile.id)
        .in('class', ['income', 'expense'])
        .eq('is_active', true)
        .order('account_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeProfile?.id,
    refetchOnMount: true
  });

  const { data: categorizationRules = [] } = useQuery({
    queryKey: ['categorizationRules', activeProfile?.id],
    queryFn: () => firstsavvy.entities.CategorizationRule.list('-priority'),
    enabled: !!activeProfile?.id
  });

  const { data: contactMatchingRules = [] } = useQuery({
    queryKey: ['contactMatchingRules', activeProfile?.id],
    queryFn: () => firstsavvy.entities.ContactMatchingRule.list('-priority'),
    enabled: !!activeProfile?.id
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Contact.list('name', 1000),
    enabled: !!activeProfile?.id
  });

  const createMutation = useMutation({
    mutationFn: (data) => withRetry(() => firstsavvy.entities.Transaction.create(data), { maxRetries: 2 }),
    onSuccess: (createdTransaction) => {
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['journal-lines-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['account-journal-lines'] });

      if (createdTransaction?.id) {
        detectNewTransactions([createdTransaction.id]);
        if (createdTransaction.status === 'posted') {
          detectNewPayments([createdTransaction.id]);
        }
      }
    },
    onError: (error) => {
      logError(error, { action: 'createTransaction' });
      showErrorToast(error);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      console.log('Transaction update mutation starting:', { id, data });
      return withRetry(() => firstsavvy.entities.Transaction.update(id, data), { maxRetries: 2 });
    },
    onMutate: async ({ id, data }) => {
      console.log('Transaction update onMutate:', { id, data });
      await queryClient.cancelQueries({ queryKey: ['fullPendingTransactions'] });
      await queryClient.cancelQueries({ queryKey: ['fullPostedTransactions'] });
      await queryClient.cancelQueries({ queryKey: ['fullExcludedTransactions'] });

      const previousPending = queryClient.getQueryData(['fullPendingTransactions']);
      const previousPosted = queryClient.getQueryData(['fullPostedTransactions']);
      const previousExcluded = queryClient.getQueryData(['fullExcludedTransactions']);

      if (data.status) {
        const findAndUpdate = (transactions) => {
          if (!transactions) return null;
          const transaction = transactions.find(t => t.id === id);
          return transaction ? { ...transaction, ...data } : null;
        };

        const updatedTransaction = findAndUpdate(previousPending) || findAndUpdate(previousPosted) || findAndUpdate(previousExcluded);

        if (updatedTransaction) {
          queryClient.setQueryData(['fullPendingTransactions'],
            data.status === 'pending'
              ? [...(previousPending || []).filter(t => t.id !== id), updatedTransaction]
              : (previousPending || []).filter(t => t.id !== id)
          );
          queryClient.setQueryData(['fullPostedTransactions'],
            data.status === 'posted'
              ? [...(previousPosted || []).filter(t => t.id !== id), updatedTransaction]
              : (previousPosted || []).filter(t => t.id !== id)
          );
          queryClient.setQueryData(['fullExcludedTransactions'],
            data.status === 'excluded'
              ? [...(previousExcluded || []).filter(t => t.id !== id), updatedTransaction]
              : (previousExcluded || []).filter(t => t.id !== id)
          );
        }
      } else {
        const updateInCache = (transactions) => {
          if (!transactions) return transactions;
          const updated = transactions.map(t => t.id === id ? { ...t, ...data } : t);
          return updated.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateB.getTime() !== dateA.getTime()) {
              return dateB - dateA;
            }
            return a.id.localeCompare(b.id);
          });
        };

        queryClient.setQueryData(['fullPendingTransactions'], updateInCache(previousPending));
        queryClient.setQueryData(['fullPostedTransactions'], updateInCache(previousPosted));
        queryClient.setQueryData(['fullExcludedTransactions'], updateInCache(previousExcluded));
      }

      return { previousPending, previousPosted, previousExcluded };
    },
    onError: (error, variables, context) => {
      console.error('Transaction update failed:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        variables
      });
      if (context?.previousPending) {
        queryClient.setQueryData(['fullPendingTransactions'], context.previousPending);
      }
      if (context?.previousPosted) {
        queryClient.setQueryData(['fullPostedTransactions'], context.previousPosted);
      }
      if (context?.previousExcluded) {
        queryClient.setQueryData(['fullExcludedTransactions'], context.previousExcluded);
      }
      logError(error, { action: 'updateTransaction' });
      showErrorToast(error);
    },
    onSettled: (updatedTransaction, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['journal-lines-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['account-journal-lines'] });

      if (!error && updatedTransaction?.id && variables?.data?.status === 'posted') {
        detectNewPayments([updatedTransaction.id]);
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => withRetry(() => firstsavvy.entities.Transaction.delete(id), { maxRetries: 2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['journal-lines-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['account-journal-lines'] });
    },
    onError: (error) => {
      logError(error, { action: 'deleteTransaction' });
      showErrorToast(error);
    }
  });

  const handleAutoCategorize = async () => {
    if (!activeProfile?.id) return;

    const uncategorizedTransactions = fullPendingTransactions.filter(
      txn => !txn.category_account_id && txn.type !== 'transfer'
    );

    if (uncategorizedTransactions.length === 0) {
      toast.info('No uncategorized transactions to process');
      return;
    }

    setIsAutoCategorizing(true);
    try {
      const updates = await transactionRulesApi.applyAllRules(
        uncategorizedTransactions,
        activeProfile.id
      );

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      if (updates.length > 0) {
        toast.success(`Successfully categorized ${updates.length} transaction${updates.length !== 1 ? 's' : ''}`);
      } else {
        toast.info('No matching rules found for pending transactions');
      }
    } catch (error) {
      logError(error, { action: 'autoCategorize' });
      toast.error('Failed to auto-categorize transactions');
    } finally {
      setIsAutoCategorizing(false);
    }
  };

  const getDateRange = () => {
    const today = new Date();
    switch (filters.datePreset) {
      case 'today':
        return { from: today, to: today };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return { from: yesterday, to: yesterday };
      case 'last7':
        return { from: subDays(today, 7), to: today };
      case 'last30':
        return { from: subDays(today, 30), to: today };
      case 'thisMonth':
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case 'thisQuarter':
        return { from: startOfQuarter(today), to: endOfQuarter(today) };
      case 'thisYear':
        return { from: startOfYear(today), to: endOfYear(today) };
      case 'custom':
        return { 
          from: filters.dateFrom || null, 
          to: filters.dateTo || null 
        };
      default:
        return { from: null, to: null };
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.datePreset !== 'all') count++;
    if (filters.account !== 'all') count++;
    if (filters.category !== 'all') count++;
    if (filters.type !== 'all') count++;
    if (filters.amountMin || filters.amountMax) count++;
    if (filters.paymentMethod !== 'all') count++;
    return count;
  };

  // Get all accounts (including inactive) to check if transaction belongs to an active account
  const activeAccountIds = accounts.map(a => a.id);

  const filteredTransactions = (statusFilter === 'pending' ? fullPendingTransactions :
                                  statusFilter === 'posted' ? fullPostedTransactions :
                                  fullExcludedTransactions)
  .filter(t => {
    // Only show transactions from active accounts
    const transactionAccountId = getTransactionAccountId(t);
    const isFromActiveAccount = activeAccountIds.includes(transactionAccountId);
    if (!isFromActiveAccount) return false;

    const category = chartAccounts.find(c => c.id === t.category_account_id);
    const categoryName = category?.name || '';
    const matchesSearch = searchTerm === '' ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      categoryName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccount = (selectedAccount === 'all' && filters.account === 'all') ||
      transactionAccountId === selectedAccount ||
      transactionAccountId === filters.account;
    
    // Date filter
    const dateRange = getDateRange();
    let matchesDate = true;
    if (!t.date) {
      matchesDate = false;
    } else if (dateRange.from && dateRange.to) {
      // For custom dates, compare strings directly; for presets, format Date objects
      const fromStr = typeof dateRange.from === 'string' ? dateRange.from : format(dateRange.from, 'yyyy-MM-dd');
      const toStr = typeof dateRange.to === 'string' ? dateRange.to : format(dateRange.to, 'yyyy-MM-dd');
      // Extract just the date portion (yyyy-MM-dd) from transaction date for comparison
      const tDateStr = t.date.substring(0, 10);
      matchesDate = tDateStr >= fromStr && tDateStr <= toStr;
    } else if (dateRange.from) {
      const fromStr = typeof dateRange.from === 'string' ? dateRange.from : format(dateRange.from, 'yyyy-MM-dd');
      const tDateStr = t.date.substring(0, 10);
      matchesDate = tDateStr >= fromStr;
    } else if (dateRange.to) {
      const toStr = typeof dateRange.to === 'string' ? dateRange.to : format(dateRange.to, 'yyyy-MM-dd');
      const tDateStr = t.date.substring(0, 10);
      matchesDate = tDateStr <= toStr;
    }
    
    // Category filter
    const matchesCategory = filters.category === 'all' || t.category_account_id === filters.category;
    
    // Type filter - handle 'expense_income' for showing both but not transfers
    let matchesType = true;
    if (filters.type === 'all') {
      matchesType = true;
    } else if (filters.type === 'expense_income') {
      matchesType = t.type === 'expense' || t.type === 'income';
    } else {
      matchesType = t.type === filters.type;
    }
    
    // Amount filter
    let matchesAmount = true;
    if (filters.amountMin) matchesAmount = t.amount >= parseFloat(filters.amountMin);
    if (filters.amountMax && matchesAmount) matchesAmount = t.amount <= parseFloat(filters.amountMax);
    
    // Payment method filter
    const matchesPaymentMethod = filters.paymentMethod === 'all' || t.payment_method === filters.paymentMethod;
    
    return matchesSearch && matchesAccount && matchesDate && matchesCategory && matchesType && matchesAmount && matchesPaymentMethod;
  });

  const toggleSelectAll = () => {
    if (selectedTransactions.length === filteredTransactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(filteredTransactions.map(t => t.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedTransactions.includes(id)) {
      setSelectedTransactions(selectedTransactions.filter(tid => tid !== id));
    } else {
      setSelectedTransactions([...selectedTransactions, id]);
    }
  };

  // Group categories by type for display
  const expenseCategories = chartAccounts.filter(c => c.class === 'expense');
  const incomeCategories = chartAccounts.filter(c => c.class === 'income');

  const getCategoryById = (id) => chartAccounts.find(c => c.id === id);


  const pendingCount = fullPendingTransactions.filter(t => {
    const isFromActiveAccount = activeAccountIds.includes(t.bank_account_id);
    const matchesAccount = selectedAccount === 'all' || t.bank_account_id === selectedAccount;
    return isFromActiveAccount && matchesAccount;
  }).length;

  const postedCount = fullPostedTransactions.filter(t => {
    const isFromActiveAccount = activeAccountIds.includes(t.bank_account_id);
    const matchesAccount = selectedAccount === 'all' || t.bank_account_id === selectedAccount;
    return isFromActiveAccount && matchesAccount;
  }).length;

  const excludedCount = fullExcludedTransactions.filter(t => {
    const isFromActiveAccount = activeAccountIds.includes(t.bank_account_id);
    const matchesAccount = selectedAccount === 'all' || t.bank_account_id === selectedAccount;
    return isFromActiveAccount && matchesAccount;
  }).length;

  // Find paired transfer or credit card payment transaction
  const findPairedTransfer = (transaction) => {
    if (!transaction) return null;

    // Check for transfer pair
    if (transaction.transfer_pair_id) {
      return transactions.find(t =>
        t.id !== transaction.id &&
        t.transfer_pair_id === transaction.transfer_pair_id
      );
    }

    // Check for credit card payment pair
    if (transaction.cc_payment_pair_id) {
      return transactions.find(t =>
        t.id !== transaction.id &&
        t.cc_payment_pair_id === transaction.cc_payment_pair_id
      );
    }

    return null;
  };

  const handleUnmatch = async (transaction) => {
    if (!isMatched(transaction)) {
      toast.error('Transaction is not matched');
      return;
    }

    if (statusFilter === 'posted') {
      toast.error('Move transaction to Pending to unmatch');
      return;
    }

    const pairedTransaction = findPairedTransfer(transaction);

    if (!pairedTransaction) {
      toast.error('Cannot find paired transaction');
      return;
    }

    try {
      toast.info('Unmatching transaction...');

      const originalType1 = transaction.original_type || (transaction.amount > 0 ? 'income' : 'expense');
      const originalType2 = pairedTransaction.original_type || (pairedTransaction.amount > 0 ? 'income' : 'expense');

      updateMutation.mutate({
        id: transaction.id,
        data: {
          transfer_pair_id: null,
          type: originalType1,
          original_type: null
        }
      });

      updateMutation.mutate({
        id: pairedTransaction.id,
        data: {
          ...pairedTransaction,
          transfer_pair_id: null,
          type: originalType2,
          original_type: null
        }
      });

      setSelectedMatches(prev => {
        const next = { ...prev };
        delete next[transaction.id];
        delete next[pairedTransaction.id];
        return next;
      });

      setManualActionOverrides(prev => {
        const next = { ...prev };
        next[transaction.id] = 'match';
        next[pairedTransaction.id] = 'match';
        return next;
      });

      setSuggestedMatches(prev => ({
        ...prev,
        [transaction.id]: pairedTransaction.id,
        [pairedTransaction.id]: transaction.id
      }));

      toast.success('Transactions unmatched');
    } catch (err) {
      console.error('Error unmatching transactions:', err);
      toast.error('Failed to unmatch transactions');
    }
  };

  // Find potential matches for a transaction (checks both pending and posted)
  const findPotentialMatches = (transaction) => {
    if (!transaction) return [];

    // For credit card payments - look for income transactions on credit cards
    if (transaction.type === 'credit_card_payment') {
      return transactions.filter(t => {
        if (t.id === transaction.id) return false;
        if (t.type !== 'income') return false;
        if (t.status === 'excluded') return false;
        if (!activeAccountIds.includes(t.bank_account_id)) return false;
        
        // Must be on a credit card account
        const tAccount = accounts.find(a => a.id === t.bank_account_id);
        if (!tAccount || tAccount.account_type !== 'credit_card') return false;

        // Check if amounts match (both should be positive for this comparison)
        const amountMatch = Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01;

        // Check if dates are close (within 7 days)
        const tDate = new Date(t.date);
        const txDate = new Date(transaction.date);
        const daysDiff = Math.abs((txDate - tDate) / (1000 * 60 * 60 * 24));
        const dateMatch = daysDiff <= 7;

        return amountMatch && dateMatch;
      });
    }

    // For transfers, look for opposite amount transfers
    if (transaction.type === 'transfer') {
      return transactions.filter(t => {
        if (t.id === transaction.id) return false;
        if (t.type !== 'transfer') return false;
        if (t.status === 'excluded') return false;
        if (!activeAccountIds.includes(t.bank_account_id)) return false;

        // Check if amounts are opposite (one positive, one negative, same magnitude)
        const amountMatch = Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01 &&
                           (t.amount > 0) !== (transaction.amount > 0);

        // Check if dates are close (within 7 days)
        const tDate = new Date(t.date);
        const txDate = new Date(transaction.date);
        const daysDiff = Math.abs((txDate - tDate) / (1000 * 60 * 60 * 24));
        const dateMatch = daysDiff <= 7;

        return amountMatch && dateMatch;
      });
    }

    // For income/expense, look for transfer-like patterns (opposite amounts, different accounts)
    // in addition to regular income/expense matches
    if (transaction.type === 'income' || transaction.type === 'expense') {
      // Check for transfer-like patterns (opposite amounts, different accounts)
      const transferLikeMatches = transactions.filter(t => {
        if (t.id === transaction.id) return false;
        if (t.status === 'excluded') return false;
        if (!activeAccountIds.includes(t.bank_account_id)) return false;
        if (t.bank_account_id === transaction.bank_account_id) return false; // Must be different account

        // Must be income, expense, or transfer
        if (!['transfer', 'income', 'expense'].includes(t.type)) return false;

        // Check if amounts are opposite (one positive, one negative, same magnitude)
        const amountMatch = Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01 &&
                           (t.amount > 0) !== (transaction.amount > 0);

        // Check if dates are close (within 7 days)
        const tDate = new Date(t.date);
        const txDate = new Date(transaction.date);
        const daysDiff = Math.abs((txDate - tDate) / (1000 * 60 * 60 * 24));
        const dateMatch = daysDiff <= 7;

        return amountMatch && dateMatch;
      });

      return transferLikeMatches;
    }

    return [];
  };

  // Calculate match confidence percentage
  const calculateMatchConfidence = (transaction, match) => {
    let confidence = 0;

    // Amount match (40 points for exact, scaled down for differences)
    const amountDiff = Math.abs(transaction.amount - match.amount);
    if (amountDiff < 0.01) {
      confidence += 40;
    } else {
      confidence += Math.max(0, 40 - amountDiff * 10);
    }

    // Date proximity (30 points, decreasing with distance)
    const tDate = new Date(transaction.date);
    const mDate = new Date(match.date);
    const daysDiff = Math.abs((tDate - mDate) / (1000 * 60 * 60 * 24));
    if (daysDiff === 0) {
      confidence += 30;
    } else if (daysDiff <= 1) {
      confidence += 25;
    } else if (daysDiff <= 3) {
      confidence += 15;
    } else {
      confidence += Math.max(0, 10 - daysDiff);
    }

    // Description similarity (30 points)
    const desc1 = (transaction.description || '').toLowerCase();
    const desc2 = (match.description || '').toLowerCase();
    const commonWords = desc1.split(' ').filter(word => desc2.includes(word)).length;
    confidence += Math.min(30, commonWords * 5);

    return Math.min(100, Math.round(confidence));
  };

  // Unified function to post transaction(s) - handles both single transactions and transfer pairs atomically
  const postTransaction = async (transaction) => {
    // Validate splits first
    const canPost = await handlePostWithSplit(transaction);
    if (!canPost) return false;

    // Check if this transaction is part of a transfer pair
    if (transaction.transfer_pair_id) {
      const pairedTransaction = transactions.find(
        t => t.transfer_pair_id === transaction.transfer_pair_id && t.id !== transaction.id
      );

      // If we found a paired transaction that's not yet posted, post both atomically
      if (pairedTransaction) {
        if (pairedTransaction.status === 'excluded') {
          toast.error('Cannot post transfer: paired transaction is excluded');
          return false;
        }

        if (pairedTransaction.status !== 'posted') {
          try {
            // CRITICAL: Post SEQUENTIALLY to avoid race condition
            // First transaction posts -> trigger skips (paired not posted yet)
            await updateMutation.mutateAsync({
              id: pairedTransaction.id,
              data: { status: 'posted' }
            });

            // Second transaction posts -> trigger creates journal entry (paired is now posted)
            await updateMutation.mutateAsync({
              id: transaction.id,
              data: { status: 'posted' }
            });

            toast.success('Transfer posted (both sides)');
            return true;
          } catch (error) {
            console.error('Failed to post transfer:', error);
            toast.error('Failed to post transfer. Please try again.');
            return false;
          }
        } else {
          // Paired transaction already posted, just post this one
          updateMutation.mutate({
            id: transaction.id,
            data: { status: 'posted' }
          });
          toast.success('Transaction posted');
          return true;
        }
      } else {
        // transfer_pair_id exists but no paired transaction found - post anyway
        console.warn('transfer_pair_id exists but no paired transaction found');
        updateMutation.mutate({
          id: transaction.id,
          data: { status: 'posted' }
        });
        toast.success('Transaction posted');
        return true;
      }
    }

    // No transfer pair - post single transaction
    updateMutation.mutate({
      id: transaction.id,
      data: { status: 'posted' }
    });
    toast.success('Transaction posted');
    return true;
  };

  const handleTransferMatch = async (transaction) => {
    const isCCPayment = transaction.type === 'credit_card_payment' || transaction.cc_payment_pair_id;
    const isTransfer = transaction.type === 'transfer' || transaction.transfer_pair_id;

    // Check if transaction is already matched
    if (transaction.transfer_pair_id || transaction.cc_payment_pair_id) {
      const paired = findPairedTransfer(transaction);

      if (paired) {
        // Already matched - check if reviewed
        if (isCCPayment && !transaction.cc_payment_reviewed) {
          // Credit card payment not yet reviewed - open dialog to accept/reject
          setMatchingCCPayment(transaction);
          setPairedCCPayment(paired);
          setCCPaymentDialogOpen(true);
          return;
        } else if (isTransfer && !transaction.transfer_reviewed) {
          // Transfer not yet reviewed - open preview dialog
          setMatchingTransfer(transaction);
          setPairedTransfer(paired);
          setTransferPostPreviewOpen(true);
          return;
        } else {
          // Already reviewed - just open preview
          setMatchingTransfer(transaction);
          setPairedTransfer(paired);
          setTransferPostPreviewOpen(true);
          return;
        }
      }
    }

    // Not matched yet - check if we can find potential matches using findPotentialMatches
    const potentialMatches = findPotentialMatches(transaction);
    const paired = potentialMatches.length > 0 ? potentialMatches[0] : null;

    if (!paired) {
      // No potential match found - this might be a regular transaction or unmatched transfer
      await postTransaction(transaction);
      return;
    }

    // Found potential match but not yet linked - open match dialog to confirm
    setMatchingTransfer(transaction);
    setPairedTransfer(paired);
    setTransferMatchDialogOpen(true);
  };

  const handleConfirmTransferMatch = async (toAccountId) => {
    if (!matchingTransfer || !pairedTransfer) return;

    try {
      // Link the two transactions as a transfer pair
      const result = await transferAutoDetectionAPI.linkTransferPair(
        matchingTransfer.id,
        pairedTransfer.id,
        activeProfile.id
      );

      if (result.error) {
        throw result.error;
      }

      // Close match dialog and open preview dialog (state already set)
      setTransferMatchDialogOpen(false);
      setTransferPostPreviewOpen(true);
      toast.success('Transfer linked - review before posting');

      // Refresh transactions in the background
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error) {
      console.error('Error linking transfers:', error);
      toast.error('Failed to link transfers');
    }
  };

  const handlePostTransferFromPreview = async () => {
    if (!matchingTransfer || !pairedTransfer) return;

    setIsPostingTransfer(true);
    try {
      // postTransaction handles posting both sides internally
      const success = await postTransaction(matchingTransfer);
      if (success) {
        setTransferPostPreviewOpen(false);
        setMatchingTransfer(null);
        setPairedTransfer(null);
      }
    } catch (error) {
      console.error('Error posting transfer:', error);
      toast.error('Failed to post transfer');
    } finally {
      setIsPostingTransfer(false);
    }
  };


  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    toast.success('Transactions imported successfully');
    setReviewDialogOpen(false);
    setExtractedData(null);
  };

  const handleMatchClick = async (transaction) => {
    const selectedMatch = selectedMatches[transaction.id];

    if (selectedMatch) {
      const matchedTransaction = transactions.find(t => t.id === selectedMatch);

      if (!matchedTransaction) {
        toast.error('Matched transaction not found');
        return;
      }

      const pairId = transaction.transfer_pair_id || matchedTransaction?.transfer_pair_id || `transfer_${Date.now()}`;
      const txn1Id = transaction.id;
      const txn2Id = matchedTransaction.id;

      try {
        // Link both transactions first
        await Promise.all([
          updateMutation.mutateAsync({
            id: transaction.id,
            data: {
              transfer_pair_id: pairId,
              type: 'transfer'
            }
          }),
          updateMutation.mutateAsync({
            id: matchedTransaction.id,
            data: {
              transfer_pair_id: pairId,
              type: 'transfer'
            }
          })
        ]);

        // Set state BEFORE invalidating queries to open preview dialog
        setMatchingTransfer(transaction);
        setPairedTransfer(matchedTransaction);
        setTransferPostPreviewOpen(true);

        setSelectedMatches(prev => {
          const next = { ...prev };
          delete next[transaction.id];
          return next;
        });
        setExpandedTransactionId(null);
        toast.success('Transfer linked - review before posting');

        // Refresh in the background (don't await)
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      } catch (error) {
        console.error('Failed to link transfer:', error);
        toast.error('Failed to link transfer. Please try again.');
      }
    } else {
      const matches = findPotentialMatches(transaction);
      if (matches.length === 0) {
        // Use unified postTransaction function to handle transfer pairs atomically
        await postTransaction(transaction);
      }
    }
  };

  const handleMatchSelectedAsTransfer = async () => {
    if (selectedTransactions.length !== 2) {
      toast.error('Please select exactly 2 transactions to match');
      return;
    }

    const txn1 = transactions.find(t => t.id === selectedTransactions[0]);
    const txn2 = transactions.find(t => t.id === selectedTransactions[1]);

    if (!txn1 || !txn2) {
      toast.error('Selected transactions not found');
      return;
    }

    if (txn1.bank_account_id === txn2.bank_account_id) {
      toast.error('Cannot match transactions from the same account');
      return;
    }

    if (Math.abs(txn1.amount) !== Math.abs(txn2.amount)) {
      toast.error('Transaction amounts must be equal');
      return;
    }

    if (Math.sign(txn1.amount) === Math.sign(txn2.amount)) {
      toast.error('Transaction amounts must have opposite signs (one positive, one negative)');
      return;
    }

    if (txn1.transfer_pair_id || txn2.transfer_pair_id) {
      toast.error('One or both transactions are already paired');
      return;
    }

    try {
      const { data, error } = await transferAutoDetectionAPI.linkTransferPair(
        selectedTransactions[0],
        selectedTransactions[1],
        activeProfile?.id
      );

      if (error) throw error;

      // Set state BEFORE invalidating queries to open preview dialog
      setMatchingTransfer(txn1);
      setPairedTransfer(txn2);
      setTransferPostPreviewOpen(true);

      setSelectedTransactions([]);
      toast.success('Transfer linked - review before posting');

      // Refresh in the background (don't await)
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error) {
      console.error('Error linking transactions:', error);
      toast.error(error.message || 'Failed to link transfer');
    }
  };

  const handleUnmatchSelectedTransfer = async () => {
    if (selectedTransactions.length === 0) {
      toast.error('Please select a transaction to unmatch');
      return;
    }

    const txn = transactions.find(t => t.id === selectedTransactions[0]);

    if (!txn) {
      toast.error('Selected transaction not found');
      return;
    }

    if (!txn.transfer_pair_id) {
      toast.error('Transaction is not part of a transfer pair');
      return;
    }

    try {
      const { error } = await transferAutoDetectionAPI.unlinkTransferPair(
        selectedTransactions[0],
        activeProfile?.id
      );

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setSelectedTransactions([]);
      toast.success('Transfer pair unmatched');
    } catch (error) {
      console.error('Error unmatching transfer:', error);
      toast.error(error.message || 'Failed to unmatch transfer');
    }
  };

  const handleAcceptCCPayment = async (paymentPairId) => {
    try {
      const { error } = await creditCardPaymentDetectionAPI.acceptPayment(paymentPairId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Credit card payment accepted');
    } catch (error) {
      console.error('Error accepting credit card payment:', error);
      toast.error('Failed to accept credit card payment');
    }
  };

  const handleRejectCCPayment = async (paymentPairId) => {
    try {
      const { error } = await creditCardPaymentDetectionAPI.rejectPayment(paymentPairId);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Credit card payment rejected');
    } catch (error) {
      console.error('Error rejecting credit card payment:', error);
      toast.error('Failed to reject credit card payment');
    }
  };

  const startResize = (column, e) => {
    e.preventDefault();
    setResizing({ column, startX: e.clientX, startWidth: columnWidths[column] });
  };

  React.useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [resizing.column]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  React.useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [selectedAccount]);

  // Set match mode when expanded if there are potential matches or existing relationship
  React.useEffect(() => {
    if (expandedTransactionId) {
      const transaction = transactions.find(t => t.id === expandedTransactionId);
      if (transaction) {
        // Only set defaults if user hasn't manually overridden for this transaction
        const hasManualOverride = manualActionOverrides[expandedTransactionId];

        if (!hasManualOverride) {
          // Check for existing database relationship first (using isMatched)
          if (isMatched(transaction)) {
            const paired = findPairedTransfer(transaction);

            if (paired) {
              setManualActionOverrides(prev => ({
                ...prev,
                [expandedTransactionId]: 'match'
              }));
              setSelectedMatches(prev => ({
                ...prev,
                [expandedTransactionId]: paired.id
              }));
            }
          } else {
            // No existing relationship - check for potential matches
            const potentialMatches = findPotentialMatches(transaction);
            if (potentialMatches.length > 0) {
              // Set to match mode to show the suggestions
              setManualActionOverrides(prev => ({
                ...prev,
                [expandedTransactionId]: 'match'
              }));
            }
          }
        }
      }
    }
  }, [expandedTransactionId]);

  return (
      <>
        <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          {/* Tabs & Top Actions */}
          <div className="border-b border-slate-200 px-4 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AccountDropdown
                  value={selectedAccount}
                  onValueChange={setSelectedAccount}
                  showPendingCounts={true}
                  transactions={fullPendingTransactions}
                  accounts={accounts}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setAddAccountSheetOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-2 pb-4">
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList>
                  <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                  <TabsTrigger value="posted">Posted</TabsTrigger>
                  <TabsTrigger value="excluded">Excluded</TabsTrigger>
                </TabsList>
              </Tabs>

              {selectedTransactions.length > 0 && (
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-sm text-slate-600">
                    {selectedTransactions.length} selected
                  </span>
                  {selectedTransactions.length === 2 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleMatchSelectedAsTransfer}
                      className="gap-1.5"
                    >
                      <Link2 className="h-4 w-4" />
                      Match as Transfer
                    </Button>
                  )}
                  {selectedTransactions.length === 1 &&
                   transactions.find(t => t.id === selectedTransactions[0])?.transfer_pair_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnmatchSelectedTransfer}
                      className="gap-1.5"
                    >
                      <Unlink className="h-4 w-4" />
                      Unmatch Transfer
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTransactions([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              
              <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-9 w-9 relative"
                                    onClick={() => setFilterPanelOpen(true)}
                                  >
                                    <SlidersHorizontal className="w-4 h-4" />
                                    {getActiveFilterCount() > 0 && (
                                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-semibold">
                                        {getActiveFilterCount()}
                                      </span>
                                    )}
                                  </Button>

              <div className="flex-1"></div>

              <div className="flex items-center gap-1">
                {statusFilter === 'pending' && (() => {
                  const uncategorizedCount = fullPendingTransactions.filter(
                    txn => !txn.category_account_id && txn.type !== 'transfer'
                  ).length;

                  return uncategorizedCount > 0 ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-2"
                            onClick={handleAutoCategorize}
                            disabled={isAutoCategorizing}
                          >
                            {isAutoCategorizing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4" />
                            )}
                            <span className="text-xs">
                              {isAutoCategorizing ? 'Categorizing...' : `Auto (${uncategorizedCount})`}
                            </span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Automatically categorize {uncategorizedCount} uncategorized transaction{uncategorizedCount !== 1 ? 's' : ''} using rules</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null;
                })()}

                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Printer className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="w-4 h-4" />
                </Button>
                <ClickThroughDropdownMenu>
                  <ClickThroughDropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </ClickThroughDropdownMenuTrigger>
                  <ClickThroughDropdownMenuContent align="end">
                    <ClickThroughDropdownMenuItem onClick={handleResetViewSettings}>
                      Reset View Settings
                    </ClickThroughDropdownMenuItem>
                    {statusFilter === 'posted' && (
                      <ClickThroughDropdownMenuItem onClick={async () => {
                        toast.info('Detecting credit card payments...');
                        await creditCardPaymentDetectionAPI.detectPayments(activeProfile?.id);
                        await refetchUnreviewedPayments();
                        queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
                        toast.success('Detection complete');
                      }}>
                        Detect CC Payments
                      </ClickThroughDropdownMenuItem>
                    )}
                    {statusFilter === 'pending' && (
                      <ClickThroughDropdownMenuItem onClick={async () => {
                        toast.info('Detecting transfers...');
                        await transferAutoDetectionAPI.detectTransfers(activeProfile?.id);
                        await refetchUnreviewedTransfers();
                        queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
                        toast.success('Detection complete');
                      }}>
                        Detect Transfers
                      </ClickThroughDropdownMenuItem>
                    )}
                  </ClickThroughDropdownMenuContent>
                </ClickThroughDropdownMenu>
              </div>
            </div>
          </div>

          {/* Table */}
          <div ref={tableContainerRef} className="max-h-[520px] overflow-auto relative">
            <table className="w-max min-w-full" style={{ tableLayout: 'auto' }}>
              <colgroup>
                <col style={{ width: 32, minWidth: 32 }} />
                <col style={{ width: 70, minWidth: 70 }} />
                {selectedAccount === 'all' && <col style={{ width: columnWidths.account, minWidth: 50 }} />}
                <col style={{ width: columnWidths.description, minWidth: 100 }} />
                <col style={{ width: 1 }} />
                                      <col style={{ width: 1 }} />
                <col style={{ width: columnWidths.fromTo, minWidth: 100 }} />
                <col style={{ width: columnWidths.categorize, minWidth: 100 }} />
                <col style={{ width: 20, minWidth: 20, maxWidth: 20 }} />
              </colgroup>
              <thead className="sticky top-0 z-30 bg-slate-100 shadow-sm">
                <tr className="bg-slate-100 h-8">
                  <th className="border-r border-slate-200 text-center w-8 min-w-8 max-w-8 bg-slate-100 font-semibold text-slate-700 py-2 px-0">
                                           <input
                                             type="checkbox"
                                             checked={selectedTransactions.length === filteredTransactions.length && filteredTransactions.length > 0}
                                             onChange={toggleSelectAll}
                                             className="rounded w-3.5 h-3.5"
                                           />
                                          </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 pr-1 py-2">
                   Date
                  </th>
                  {selectedAccount === 'all' && (
                                           <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.account }}>
                                             Account
                                             <div 
                                               className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                                               onMouseDown={(e) => startResize('account', e)}
                                             />
                                           </th>
                                          )}
                  <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.description }}>
                   Description
                   <div 
                     className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                     onMouseDown={(e) => startResize('description', e)}
                   />
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 py-2 whitespace-nowrap">
                   Spent
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 py-2 whitespace-nowrap">
                   Received
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.fromTo }}>
                   From/To
                   <div 
                     className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                     onMouseDown={(e) => startResize('fromTo', e)}
                   />
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.categorize }}>
                   Category
                   <div 
                     className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                     onMouseDown={(e) => startResize('categorize', e)}
                   />
                  </th>
                  <th className="font-semibold text-slate-700 bg-slate-100 text-left pl-2 pr-0 py-2 whitespace-nowrap">
                   Action
                  </th>
                  </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={selectedAccount === 'all' ? 9 : 8} className="text-center py-12 text-slate-500">
                      No transactions found
                    </td>
                  </tr>
                  ) : (
                  filteredTransactions.map((transaction, index) => {
                    const transactionAccountId = getTransactionAccountId(transaction);
                    const account = accounts.find(a => a.id === transactionAccountId);
                    const isSelected = selectedTransactions.includes(transaction.id);
                    return (
                      <React.Fragment key={transaction.id}>
                        <tr
                          className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} h-8 ${statusFilter === 'pending' ? 'cursor-pointer' : ''} ${expandedTransactionId === transaction.id ? 'bg-slate-100' : ''}`}
                          onClick={(e) => {
                            if (statusFilter !== 'pending') return;
                            const targetNode = e.target;
                            if (targetNode.closest('input') || targetNode.closest('button') || targetNode.closest('[role="combobox"]') || targetNode.closest('[data-dropdown-menu]')) {
                              return;
                            }
                            const newExpandedId = expandedTransactionId === transaction.id ? null : transaction.id;
                            setExpandedTransactionId(newExpandedId);
                          }}
                        >
                          <td className="border-r border-slate-200 py-1 text-center w-8 min-w-8 max-w-8 px-0">
                            <div className="flex flex-col items-center gap-0.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => { e.stopPropagation(); toggleSelect(transaction.id); }}
                                className="rounded w-3.5 h-3.5"
                              />
                              {transaction.cleared_status === 'reconciled' && (
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Reconciled" />
                              )}
                              {transaction.cleared_status === 'cleared' && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Cleared" />
                              )}
                              {(!transaction.cleared_status || transaction.cleared_status === 'uncleared') && transaction.status === 'posted' && (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" title="Uncleared" />
                              )}
                            </div>
                          </td>
                          <td className="text-sm border-r border-slate-200 py-1 pl-2 pr-1">
                            {transaction.date && !isNaN(new Date(transaction.date).getTime())
                              ? format(parseISO(transaction.date), 'MM/dd/yy')
                              : 'Invalid'}
                          </td>
                        {selectedAccount === 'all' && (
                                                        <td className="text-sm border-r border-slate-200 py-1 px-4 pl-2 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: columnWidths.account, minWidth: columnWidths.account, maxWidth: columnWidths.account }}>
                                                          {account ? `${getAccountDisplayName(account)}${account.account_number ? ` (${account.account_number})` : ''}` : 'N/A'}
                                                        </td>
                                                      )}
                        <td className="text-sm border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.description, minWidth: columnWidths.description, maxWidth: columnWidths.description }}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              {isSplitMode(transaction.id) ? (
                                <span className="text-xs px-1 text-blue-600 font-medium">Split</span>
                              ) : transaction.is_split ? (
                                <span className="text-xs px-1 text-blue-600 font-medium">Split</span>
                              ) : statusFilter === 'pending' ? (
                                <Input
                                  defaultValue={formatTransactionDescription(transaction.description)}
                                  disabled={!activeAccountIds.includes(transaction.bank_account_id)}
                                  className="h-7 text-xs border-transparent bg-transparent shadow-none hover:border-slate-300 hover:bg-white focus:border-slate-300 focus:bg-white transition-colors px-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                  onBlur={(e) => {
                                    if (e.target.value !== formatTransactionDescription(transaction.description)) {
                                      updateMutation.mutate({
                                        id: transaction.id,
                                        data: { description: e.target.value }
                                      });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.target.blur();
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-xs px-1">{formatTransactionDescription(transaction.description)}</span>
                              )}
                            </div>
                          </div>
                        </td>
                                                    <td className="text-right text-sm border-r border-slate-200 py-1 pl-1 pr-2 whitespace-nowrap">
                                                      {transaction.amount < 0 && (
                                                        <span className="text-red-600">
                                                          ${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="text-right text-sm border-r border-slate-200 py-1 pl-1 pr-2 whitespace-nowrap">
                                                      {transaction.amount >= 0 && (
                                                        <span className="text-green-600">
                                                          ${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                      )}
                                                    </td>
                        <td className="border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.fromTo, minWidth: columnWidths.fromTo, maxWidth: columnWidths.fromTo }}>
                          {(() => {
                            const isInMatchMode = statusFilter === 'pending' && (
                              manualActionOverrides[transaction.id] === 'match' || (
                                !manualActionOverrides[transaction.id] &&
                                (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') &&
                                findPairedTransfer(transaction)
                              )
                            );

                            if (isInMatchMode) {
                              const paired = findPairedTransfer(transaction);
                              const pairedAccountId = paired ? paired.bank_account_id : '';
                              const isAlreadyMatched = !!transaction.transfer_pair_id && !!paired;

                              // If already matched, show as read-only
                              if (isAlreadyMatched) {
                                const pairedAccount = allActiveAccounts.find(a => a.id === paired.bank_account_id) || accounts.find(a => a.id === paired.bank_account_id);
                                return <span className="text-xs px-1">{pairedAccount ? getAccountDisplayName(pairedAccount) : '—'}</span>;
                              }

                              // Show paired account as read-only - bank data is immutable
                              const pairedAccount = allActiveAccounts.find(a => a.id === pairedAccountId) || accounts.find(a => a.id === pairedAccountId);
                              return <span className="text-xs px-1">{pairedAccount ? getAccountDisplayName(pairedAccount) : '—'}</span>;
                            }

                            // For transfers/credit card payments, show the paired account name (not editable)
                            if ((transaction.type === 'transfer' || transaction.type === 'credit_card_payment') && (transaction.transfer_pair_id || transaction.cc_payment_pair_id)) {
                              const paired = findPairedTransfer(transaction);
                              if (paired) {
                                const pairedAccount = allActiveAccounts.find(a => a.id === paired.bank_account_id) || accounts.find(a => a.id === paired.bank_account_id);
                                return <span className="text-xs px-1">{pairedAccount ? getAccountDisplayName(pairedAccount) : '—'}</span>;
                              }
                            }

                            // For regular transactions, show editable contact dropdown (or read-only in posted)
                            if (statusFilter === 'posted') {
                              const contact = contacts.find(c => c.id === transaction.contact_id);
                              return <span className="text-xs px-1">{contact?.name || '—'}</span>;
                            }

                            return (
                              <div onClick={(e) => e.stopPropagation()}>
                                <ContactDropdown
                                  value={transaction.contact_id}
                                  onValueChange={(value) => {
                                    if (!activeAccountIds.includes(transaction.bank_account_id)) return;
                                    updateMutation.mutate({
                                      id: transaction.id,
                                      data: {
                                        contact_id: value,
                                        contact_manually_set: true
                                      }
                                    });
                                  }}
                                  transactionDescription={transaction.description}
                                  disabled={!activeAccountIds.includes(transaction.bank_account_id)}
                                  onAddNew={(searchTerm) => {
                                    setContactSearchTerm(searchTerm);
                                    setTriggeringContactTransactionId(transaction.id);
                                    setAddContactSheetOpen(true);
                                  }}
                                  triggerClassName="h-7 border-transparent bg-transparent shadow-none hover:border-slate-300 hover:bg-white focus:border-slate-300 focus:bg-white transition-colors text-xs"
                                  placeholder="Select contact"
                                />
                              </div>
                            );
                          })()}
                        </td>
                        <td className="border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.categorize, minWidth: columnWidths.categorize, maxWidth: columnWidths.categorize }}>
                          {(() => {
                            if (isMatched(transaction)) {
                              return <span className="text-xs px-1 text-slate-500 opacity-50">Transfer</span>;
                            }

                            if (isSplitMode(transaction.id)) {
                              return <span className="text-xs px-1 text-blue-600 font-medium">Split</span>;
                            }

                            if (transaction.is_split && !isSplitMode(transaction.id)) {
                              return <span className="text-xs px-1 text-blue-600 font-medium">Split</span>;
                            }

                            const isInMatchMode = statusFilter === 'pending' && (
                              manualActionOverrides[transaction.id] === 'match' || (
                                !manualActionOverrides[transaction.id] &&
                                (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') &&
                                findPairedTransfer(transaction)
                              )
                            );

                            if (isInMatchMode) {
                              return (
                                <div onClick={(e) => e.stopPropagation()}>
                                  <ClickThroughSelect
                                    value={transaction.type}
                                    onValueChange={(newType) => {
                                      if (!activeAccountIds.includes(transaction.bank_account_id)) return;
                                      updateMutation.mutate({
                                        id: transaction.id,
                                        data: { type: newType }
                                      });
                                    }}
                                    disabled={!activeAccountIds.includes(transaction.bank_account_id)}
                                    triggerClassName="h-7 border-slate-300 text-xs"
                                    placeholder="Select type"
                                  >
                                    <ClickThroughSelectItem value="transfer">
                                      Transfer
                                    </ClickThroughSelectItem>
                                    <ClickThroughSelectItem value="credit_card_payment">
                                      Credit Card Payment
                                    </ClickThroughSelectItem>
                                  </ClickThroughSelect>
                                </div>
                              );
                            }

                            // For refunds, show refund indicator
                            if (transaction.type === 'income' && transaction.original_type === 'expense') {
                              return <span className="text-xs px-1 text-emerald-600 font-medium">Refund</span>;
                            }

                            // For matched transfers, show special category dropdown with transfer options
                            if (transaction.transfer_pair_id) {
                              const pairedTransaction = findPairedTransfer(transaction);
                              const pairedAccount = bankAccounts.find(acc => acc.id === pairedTransaction?.bank_account_id);
                              const otherAccounts = bankAccounts.filter(acc => acc.id !== transaction.bank_account_id);

                              // Show paired account with unmatch option - bank data is immutable
                              return (
                                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                                  <span className="text-xs px-1">Transfer: {pairedAccount?.display_name || 'Unknown'}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 hover:bg-slate-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!pairedTransaction || !activeAccountIds.includes(transaction.bank_account_id)) return;

                                      updateMutation.mutate({
                                        id: transaction.id,
                                        data: { transfer_pair_id: null, type: null }
                                      });
                                      updateMutation.mutate({
                                        id: pairedTransaction.id,
                                        data: { transfer_pair_id: null, type: null }
                                      });
                                    }}
                                    disabled={!activeAccountIds.includes(transaction.bank_account_id)}
                                  >
                                    <Unlink className="h-3 w-3" />
                                  </Button>
                                </div>
                              );
                            }

                            // For credit card payments, show type label
                            if (transaction.cc_payment_pair_id) {
                              return <span className="text-xs px-1">Credit Card Payment</span>;
                            } else if (transaction.type === 'transfer') {
                              return <span className="text-xs px-1">Transfer</span>;
                            } else if (transaction.type === 'credit_card_payment') {
                              return <span className="text-xs px-1">Credit Card Payment</span>;
                            }

                            // For regular transactions, show editable category dropdown (or read-only in posted)
                            if (statusFilter === 'posted') {
                              const category = chartAccounts.find(c => c.id === transaction.category_account_id);
                              const displayName = category?.display_name || '—';
                              return <span className="text-xs px-1">{displayName}</span>;
                            }

                            return (
                              <div onClick={(e) => e.stopPropagation()}>
                                <CategoryDropdown
                                  value={transaction.category_account_id}
                                  onValueChange={async (value) => {
                                    if (!activeAccountIds.includes(transaction.bank_account_id)) return;
                                    const categoryValue = value === '' ? null : value;

                                    await queryClient.refetchQueries({ queryKey: ['user-chart-accounts'] });
                                    await queryClient.refetchQueries({ queryKey: ['chart-accounts'] });

                                    const updatedChartAccounts = queryClient.getQueryData(['chart-accounts', 'expense', activeProfile?.id]) ||
                                                                queryClient.getQueryData(['chart-accounts', 'income', activeProfile?.id]) ||
                                                                chartAccounts;
                                    const selectedCategory = categoryValue ? updatedChartAccounts.find(c => c.id === categoryValue) : null;

                                    console.log('Category selected:', {
                                      transactionId: transaction.id,
                                      categoryValue,
                                      selectedCategory,
                                      categoryClass: selectedCategory?.class
                                    });

                                    updateMutation.mutate({
                                      id: transaction.id,
                                      data: {
                                        category_account_id: categoryValue
                                      }
                                    });
                                    setCategorySuggestions(prev => {
                                      const { [transaction.id]: _, ...rest } = prev;
                                      return rest;
                                    });

                                    if (categoryValue && activeProfile?.id) {
                                      categorizationMemoryAPI.storeMemory(
                                        activeProfile.id,
                                        transaction,
                                        categoryValue
                                      ).catch(error => {
                                        console.error('Failed to store categorization memory:', error);
                                      });
                                    }
                                  }}
                                  transactionType={transaction.type}
                                  disabled={!activeAccountIds.includes(transaction.bank_account_id) || isMatched(transaction)}
                                  onAddNew={(searchTerm) => {
                                    setCategorySearchTerm(searchTerm);
                                    setTriggeringTransactionId(transaction.id);
                                    setTriggeringTransactionType(transaction.type);
                                    setAddAccountSheetOpen(true);
                                  }}
                                  triggerClassName="h-7 border-transparent bg-transparent shadow-none hover:border-slate-300 hover:bg-white focus:border-slate-300 focus:bg-white transition-colors text-xs"
                                  placeholder="Select category"
                                  isTransactionTransfer={transaction.type === 'transfer'}
                                  transactionAmount={transaction.amount}
                                  aiSuggestionId={categorySuggestions[transaction.id]}
                                />
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-1 pl-2 pr-1 whitespace-nowrap text-left">
                        {(() => {
                          const isInactiveAccount = !activeAccountIds.includes(transaction.bank_account_id);
                          if (isInactiveAccount) {
                            return <span className="text-xs text-slate-400 italic">Inactive</span>;
                          }

                          if (statusFilter === 'pending') {
                            return (
                              <div className="flex items-center justify-start gap-1 pl-1">
                                {(() => {
                                  if (isMatched(transaction)) {
                                    return (
                                      <button
                                        className="text-xs text-blue-600 hover:underline"
                                        onClick={(e) => {
                                          e?.stopPropagation();
                                          // Transaction is already matched - open preview dialog
                                          const paired = findPairedTransfer(transaction);
                                          if (paired) {
                                            setMatchingTransfer(transaction);
                                            setPairedTransfer(paired);
                                            setTransferPostPreviewOpen(true);
                                          }
                                        }}
                                      >
                                        Match
                                      </button>
                                    );
                                  }

                                  const manualAction = manualActionOverrides[transaction.id];

                                  let actionText, actionHandler;

                                  if (manualAction === 'post') {
                                    actionText = 'Post';
                                    actionHandler = async () => {
                                      // Use unified postTransaction function to handle transfer pairs atomically
                                      await postTransaction(transaction);
                                    };
                                  } else if (manualAction === 'match') {
                                    actionText = 'Match';
                                    actionHandler = () => {
                                      const matches = (transaction.type === 'transfer' || transaction.type === 'credit_card_payment')
                                        ? [findPairedTransfer(transaction)].filter(Boolean)
                                        : findPotentialMatches(transaction);
                                      setMatchingTransaction(transaction);
                                      setPotentialMatches(matches);
                                      setMatchDialogOpen(true);
                                    };
                                  } else {
                                    if (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') {
                                      const paired = findPairedTransfer(transaction);
                                      actionText = paired ? 'Match' : 'Post';
                                      actionHandler = () => handleTransferMatch(transaction);
                                    } else {
                                      const matches = findPotentialMatches(transaction);
                                      actionText = matches.length > 0 ? 'Match' : 'Post';
                                      actionHandler = () => handleMatchClick(transaction);
                                    }
                                  }

                                  return (
                                    <button
                                      className="text-xs text-blue-600 hover:underline"
                                      onClick={(e) => {
                                        e?.stopPropagation();
                                        actionHandler();
                                      }}
                                    >
                                      {actionText}
                                    </button>
                                  );
                                })()}
                                  <div className="border-l border-slate-300 h-4" />
                                  <div data-dropdown-menu className="px-2">
                                    <ClickThroughDropdownMenu>
                                      <ClickThroughDropdownMenuTrigger asChild>
                                        <button
                                          className="text-slate-600 hover:text-slate-900 p-1"
                                          onClick={(e) => e?.stopPropagation()}
                                        >
                                          <ChevronDown className="w-4 h-4" />
                                        </button>
                                      </ClickThroughDropdownMenuTrigger>
                                    <ClickThroughDropdownMenuContent>
                                      <ClickThroughDropdownMenuItem
                                        onClick={(e) => {
                                          e?.stopPropagation();
                                          setExpandedTransactionId(expandedTransactionId === transaction.id ? null : transaction.id);
                                        }}
                                      >
                                        Edit
                                      </ClickThroughDropdownMenuItem>
                                      <ClickThroughDropdownMenuItem
                                        onClick={(e) => {
                                          e?.stopPropagation();
                                          if (isSplitMode(transaction.id)) {
                                            cancelSplitMode(transaction.id, transaction);
                                          } else {
                                            initializeSplitMode(transaction);
                                            setExpandedTransactionId(transaction.id);
                                          }
                                        }}
                                        disabled={isMatched(transaction) || transaction.type === 'transfer' || transaction.type === 'credit_card_payment'}
                                      >
                                        Split
                                      </ClickThroughDropdownMenuItem>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div>
                                              <ClickThroughDropdownMenuItem
                                                onClick={(e) => {
                                                  e?.stopPropagation();
                                                  if (!isMatched(transaction)) {
                                                    // TODO: Implement create rule functionality
                                                  }
                                                }}
                                                disabled={isMatched(transaction)}
                                              >
                                                Create Rule
                                              </ClickThroughDropdownMenuItem>
                                            </div>
                                          </TooltipTrigger>
                                          {isMatched(transaction) && (
                                            <TooltipContent>
                                              <p>Matched transactions cannot have rules</p>
                                            </TooltipContent>
                                          )}
                                        </Tooltip>
                                      </TooltipProvider>
                                      <ClickThroughDropdownMenuItem
                                        onClick={(e) => {
                                          e?.stopPropagation();
                                          updateMutation.mutate({
                                            id: transaction.id,
                                            data: { status: 'excluded' }
                                          });
                                        }}
                                      >
                                        Exclude
                                      </ClickThroughDropdownMenuItem>
                                    </ClickThroughDropdownMenuContent>
                                  </ClickThroughDropdownMenu>
                                  </div>
                                </div>
                              );
                            }

                            if (statusFilter === 'posted') {
                              return (
                                <button
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => {
                                    e?.stopPropagation();
                                    updateMutation.mutate({
                                      id: transaction.id,
                                      data: { status: 'pending' }
                                    });
                                    if (isMatched(transaction)) {
                                      const pairedTransaction = findPairedTransfer(transaction);
                                      if (pairedTransaction) {
                                        updateMutation.mutate({
                                          id: pairedTransaction.id,
                                          data: { status: 'pending' }
                                        });
                                      }
                                    }
                                    if (transaction.is_split) {
                                      initializeSplitMode(transaction);
                                    }
                                  }}
                                >
                                  Undo
                                </button>
                              );
                            }

                            if (statusFilter === 'excluded') {
                              return (
                                <button
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => {
                                    e?.stopPropagation();
                                    updateMutation.mutate({
                                      id: transaction.id,
                                      data: { status: 'pending' }
                                    });
                                    if (isMatched(transaction)) {
                                      const pairedTransaction = findPairedTransfer(transaction);
                                      if (pairedTransaction) {
                                        updateMutation.mutate({
                                          id: pairedTransaction.id,
                                          data: { status: 'pending' }
                                        });
                                      }
                                    }
                                    if (transaction.is_split) {
                                      initializeSplitMode(transaction);
                                    }
                                  }}
                                >
                                  Undo
                                </button>
                              );
                            }

                            return null;
                          })()}
                        </td>
                        </tr>

                        {expandedTransactionId === transaction.id && (
                          <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-t border-slate-100`}>
                            <td colSpan={selectedAccount === 'all' ? 9 : 8} className="p-0">
                              <div className="bg-slate-50 border-l-4 border-blue-500">
                                {activeAccountIds.includes(transaction.bank_account_id) ? (
                                  <div>
                                    {/* Toggle Section */}
                                    <div className="pt-2 px-4">
                                    {/* Split Mode UI */}
                                    {isSplitMode(transaction.id) ? (
                                      <div>
                                        <div className="flex items-center justify-between mb-2">
                                          <Label className="text-sm font-semibold text-slate-700">Split Transaction</Label>
                                          {loadingSplits.has(transaction.id) && (
                                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                          )}
                                        </div>

                                        <div className="flex gap-4">
                                          {(() => {
                                            const validation = getSplitValidation(transaction);
                                            let statusColor = 'text-slate-600';
                                            let statusText = 'Enter amounts';

                                            if (validation.splitTotal > 0) {
                                              if (Math.abs(validation.difference) < 0.01) {
                                                statusColor = 'text-emerald-600';
                                                statusText = 'Valid';
                                              } else if (validation.splitTotal > validation.totalAmount) {
                                                statusColor = 'text-red-600';
                                                statusText = `Over by $${Math.abs(validation.difference).toFixed(2)}`;
                                              } else {
                                                statusColor = 'text-amber-600';
                                                statusText = `Remaining: $${validation.difference.toFixed(2)}`;
                                              }
                                            }

                                            return (
                                              <div className="bg-slate-100 rounded-md p-2 space-y-1 flex-shrink-0 w-48">
                                                <div className="flex items-center justify-between text-xs">
                                                  <span className="text-slate-600">Transaction Total:</span>
                                                  <span className="font-semibold">${validation.totalAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                  <span className="text-slate-600">Split Total:</span>
                                                  <span className="font-semibold">${validation.splitTotal.toFixed(2)}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-slate-300">
                                                  <span className={statusColor}>Status:</span>
                                                  <span className={statusColor}>{statusText}</span>
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          <div className="flex-1 space-y-1">
                                            <div className="grid grid-cols-[1fr_120px_1fr_40px] gap-2">
                                              <Label className="text-xs text-slate-600">Description</Label>
                                              <Label className="text-xs text-slate-600">Amount</Label>
                                              <Label className="text-xs text-slate-600">Category</Label>
                                              <div></div>
                                            </div>

                                            {splitLineItems[transaction.id]?.map((line, lineIndex) => (
                                              <div key={line.id} className="grid grid-cols-[1fr_120px_1fr_40px] gap-2 items-center">
                                                <Input
                                                  value={line.description || ''}
                                                  onChange={(e) => updateSplitLine(transaction.id, lineIndex, 'description', e.target.value)}
                                                  className="h-8 text-xs"
                                                  placeholder="Description"
                                                />
                                                <Input
                                                  type="number"
                                                  step="0.01"
                                                  value={line.amount || ''}
                                                  onChange={(e) => updateSplitLine(transaction.id, lineIndex, 'amount', e.target.value)}
                                                  className="h-8 text-xs"
                                                  placeholder={(() => {
                                                    const remaining = getRemainingAmount(transaction, lineIndex);
                                                    return remaining > 0 ? remaining.toFixed(2) : '0.00';
                                                  })()}
                                                />
                                                <CategoryDropdown
                                                  value={line.category_account_id || ''}
                                                  onValueChange={(value) => updateSplitLine(transaction.id, lineIndex, 'category_account_id', value)}
                                                  transactionType={transaction.type}
                                                  triggerClassName="h-8 text-xs border-slate-300"
                                                  placeholder="Select category"
                                                  onAddNew={(searchTerm) => {
                                                    setCategorySearchTerm(searchTerm);
                                                    setTriggeringTransactionId(transaction.id);
                                                    setTriggeringTransactionType(transaction.type);
                                                    setAddAccountSheetOpen(true);
                                                  }}
                                                />
                                                {splitLineItems[transaction.id].length > 2 && (
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                                                    onClick={() => removeSplitLine(transaction.id, lineIndex)}
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </Button>
                                                )}
                                              </div>
                                            ))}

                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-8 text-xs"
                                              onClick={() => addSplitLine(transaction.id, transaction)}
                                            >
                                              <Plus className="w-3 h-3 mr-1" />
                                              Add Split Line
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        {statusFilter === 'pending' && (
                                          <div className="flex items-center gap-2">
                                            <Tabs
                                              value={(() => {
                                                if (isMatched(transaction)) return 'match';
                                                if (manualActionOverrides[transaction.id]) return manualActionOverrides[transaction.id];
                                                if (transaction.type === 'transfer') {
                                                  return findPairedTransfer(transaction) ? 'match' : 'post';
                                                }
                                                const matches = findPotentialMatches(transaction);
                                                return matches.length > 0 ? 'match' : 'post';
                                              })()}
                                              onValueChange={(val) => {
                                                if (isMatched(transaction) && val === 'post') {
                                                  const pairedTransaction = findPairedTransfer(transaction);
                                                  if (pairedTransaction) {
                                                    setManualActionOverrides(prev => ({
                                                      ...prev,
                                                      [transaction.id]: 'post',
                                                      [pairedTransaction.id]: 'post'
                                                    }));
                                                  } else {
                                                    setManualActionOverrides(prev => ({
                                                      ...prev,
                                                      [transaction.id]: 'post'
                                                    }));
                                                  }
                                                  handleUnmatch(transaction);
                                                  return;
                                                }
                                                setManualActionOverrides(prev => ({
                                                  ...prev,
                                                  [transaction.id]: val
                                                }));
                                              }}
                                              className="h-8"
                                            >
                                              <TabsList className="h-8">
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <div>
                                                        <TabsTrigger
                                                          value="post"
                                                          className="h-7 text-xs"
                                                        >
                                                          Categorize
                                                        </TabsTrigger>
                                                      </div>
                                                    </TooltipTrigger>
                                                    {isMatched(transaction) && (
                                                      <TooltipContent>
                                                        <p>Click to unmatch</p>
                                                      </TooltipContent>
                                                    )}
                                                  </Tooltip>
                                                </TooltipProvider>
                                                <TabsTrigger value="match" className="h-7 text-xs">Match</TabsTrigger>
                                              </TabsList>
                                            </Tabs>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    </div>

                                    {/* Matched Transaction Row */}
                                    {(() => {
                                      const currentlyPaired = isMatched(transaction) ? findPairedTransfer(transaction) : null;
                                      if (!currentlyPaired) return null;

                                      return (
                                        <>
                                          <div className="pt-2 pb-1 px-4">
                                            <p className="text-xs text-slate-600">Suggested Match</p>
                                          </div>
                                          <div className="bg-blue-50/50">
                                            <table className="w-max min-w-full" style={{ tableLayout: 'auto' }}>
                                              <colgroup>
                                                <col style={{ width: 32, minWidth: 32 }} />
                                                <col style={{ width: 70, minWidth: 70 }} />
                                                {selectedAccount === 'all' && <col style={{ width: columnWidths.account, minWidth: 50 }} />}
                                                <col style={{ width: columnWidths.description, minWidth: 100 }} />
                                                <col style={{ width: 1 }} />
                                                <col style={{ width: 1 }} />
                                                <col style={{ width: columnWidths.fromTo, minWidth: 100 }} />
                                                <col style={{ width: columnWidths.categorize, minWidth: 100 }} />
                                                <col style={{ width: 20, minWidth: 20, maxWidth: 20 }} />
                                              </colgroup>
                                              <tbody>
                                                <tr>
                                                  {/* Checkbox */}
                                                  <td className="border-r border-blue-200 text-center">
                                                    <input
                                                      type="checkbox"
                                                      checked={true}
                                                      onChange={async (e) => {
                                                        e.stopPropagation();

                                                        const originalType1 = transaction.original_type || (transaction.amount > 0 ? 'income' : 'expense');
                                                        const originalType2 = currentlyPaired.original_type || (currentlyPaired.amount > 0 ? 'income' : 'expense');

                                                        try {
                                                          await Promise.all([
                                                            updateMutation.mutateAsync({
                                                              id: transaction.id,
                                                              data: {
                                                                transfer_pair_id: null,
                                                                type: originalType1,
                                                                original_type: null
                                                              }
                                                            }),
                                                            updateMutation.mutateAsync({
                                                              id: currentlyPaired.id,
                                                              data: {
                                                                transfer_pair_id: null,
                                                                type: originalType2,
                                                                original_type: null
                                                              }
                                                            })
                                                          ]);

                                                          setSelectedMatches(prev => {
                                                            const next = { ...prev };
                                                            delete next[transaction.id];
                                                            delete next[currentlyPaired.id];
                                                            return next;
                                                          });

                                                          setSuggestedMatches(prev => ({
                                                            ...prev,
                                                            [transaction.id]: currentlyPaired.id,
                                                            [currentlyPaired.id]: transaction.id
                                                          }));

                                                          toast.success('Transfer unmatched');
                                                        } catch (error) {
                                                          console.error('Failed to unmatch transfer:', error);
                                                          toast.error('Failed to unmatch transfer. Please try again.');
                                                        }
                                                      }}
                                                      className="rounded w-3.5 h-3.5"
                                                    />
                                                  </td>

                                                  {/* Date */}
                                                  <td className="border-r border-blue-200 py-1 pl-2 pr-1 text-xs">
                                                    {format(parseISO(currentlyPaired.date), 'MM/dd/yy')}
                                                  </td>

                                                  {/* Account (if showing all) */}
                                                  {selectedAccount === 'all' && (
                                                    <td className="border-r border-blue-200 py-1 px-4 pl-2 truncate text-xs">
                                                      {getAccountDisplayName(accounts.find(a => a.id === currentlyPaired.bank_account_id))}
                                                    </td>
                                                  )}

                                                  {/* Description - Editable */}
                                                  <td className="border-r border-blue-200 py-1 px-4 pl-2 text-xs" style={{ width: columnWidths.description, minWidth: columnWidths.description, maxWidth: columnWidths.description }}>
                                                    <Input
                                                      defaultValue={currentlyPaired.description || ''}
                                                      className="h-6 text-xs border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                      onBlur={(e) => {
                                                        if (e.target.value !== (currentlyPaired.description || '')) {
                                                          updateMutation.mutate({
                                                            id: currentlyPaired.id,
                                                            data: { description: e.target.value }
                                                          });
                                                        }
                                                      }}
                                                      onClick={(e) => e.stopPropagation()}
                                                    />
                                                  </td>

                                                {/* Spent */}
                                                <td className="border-r border-blue-200 py-1 pl-2 text-left whitespace-nowrap text-xs">
                                                  {currentlyPaired.amount < 0 && (
                                                    <span className="text-red-600 font-medium">
                                                      ${Math.abs(currentlyPaired.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                  )}
                                                </td>

                                                {/* Received */}
                                                <td className="border-r border-blue-200 py-1 pl-2 text-left whitespace-nowrap text-xs">
                                                  {currentlyPaired.amount >= 0 && (
                                                    <span className="text-green-600 font-medium">
                                                      ${Math.abs(currentlyPaired.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                  )}
                                                </td>

                                                {/* From/To */}
                                                <td className="border-r border-blue-200 py-1 px-4 pl-2 truncate text-xs">
                                                  {(() => {
                                                    if (currentlyPaired.type === 'transfer') {
                                                      const otherAccount = accounts.find(a => a.id === transaction.bank_account_id);
                                                      return otherAccount ? getAccountDisplayName(otherAccount) : '—';
                                                    }
                                                    const contact = contacts.find(c => c.id === currentlyPaired.contact_id);
                                                    return contact ? contact.display_name : '—';
                                                  })()}
                                                </td>

                                                {/* Category */}
                                                <td className="border-r border-blue-200 py-1 px-4 pl-2 truncate text-xs">
                                                  {(() => {
                                                    if (currentlyPaired.type === 'transfer') return 'Transfer';
                                                    if (currentlyPaired.type === 'credit_card_payment') return 'Credit Card Payment';
                                                    const category = chartAccounts.find(c => c.id === currentlyPaired.category_account_id);
                                                    return category?.display_name || '—';
                                                  })()}
                                                </td>

                                                {/* Matched Badge */}
                                                <td className="py-1 text-xs text-blue-600 font-medium whitespace-nowrap text-center">
                                                  ✓
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                        </>
                                      );
                                    })()}

                                    {/* Tab Content Section */}
                                    <div className="px-4 pb-4 space-y-2">
                                    {/* Categorize Tab Content */}
                                    {!isSplitMode(transaction.id) && (() => {
                                      const override = manualActionOverrides[transaction.id];
                                      if (override === 'match') return false;
                                      if (override === 'post') return true;
                                      // Check default
                                      if (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') {
                                        return !findPairedTransfer(transaction);
                                      }
                                      return findPotentialMatches(transaction).length === 0;
                                    })() && (
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                          {transaction.type !== 'transfer' && transaction.type !== 'credit_card_payment' && (
                                            <div>
                                              <Label className="text-xs mb-1 block">Payment Method</Label>
                                              {getAccountDetails(transaction.bank_account_id)?.account_type === 'credit_card' ? (
                                                <Input value="Credit Card" readOnly className="h-8 text-xs bg-slate-50" />
                                              ) : (
                                                <ClickThroughSelect
                                                  value={transaction.payment_method || 'debit_card'}
                                                  onValueChange={(val) => {
                                                    updateMutation.mutate({
                                                      id: transaction.id,
                                                      data: { payment_method: val }
                                                    });
                                                  }}
                                                  triggerClassName="h-8 text-xs"
                                                >
                                                  <ClickThroughSelectItem value="cash">Cash</ClickThroughSelectItem>
                                                  <ClickThroughSelectItem value="debit_card">Debit Card</ClickThroughSelectItem>
                                                  <ClickThroughSelectItem value="bank_transfer">ACH / Bank Transfer</ClickThroughSelectItem>
                                                  <ClickThroughSelectItem value="check">Check</ClickThroughSelectItem>
                                                  <ClickThroughSelectItem value="online_bank_payment">Online Bank Payment</ClickThroughSelectItem>
                                                  <ClickThroughSelectItem value="other">Other</ClickThroughSelectItem>
                                                </ClickThroughSelect>
                                              )}
                                            </div>
                                          )}

                                          {transaction.type !== 'transfer' && transaction.type !== 'credit_card_payment' && (
                                            <div>
                                              <Label className="text-xs mb-1 block">Category</Label>
                                              <CategoryDropdown
                                                value={transaction.category_account_id || ''}
                                                onValueChange={async (value) => {
                                                  const categoryValue = value === '' ? null : value;

                                                  await queryClient.refetchQueries({ queryKey: ['user-chart-accounts'] });
                                                  await queryClient.refetchQueries({ queryKey: ['chart-accounts'] });

                                                  const updatedChartAccounts = queryClient.getQueryData(['chart-accounts', 'expense', activeProfile?.id]) ||
                                                                              queryClient.getQueryData(['chart-accounts', 'income', activeProfile?.id]) ||
                                                                              chartAccounts;
                                                  const selectedCategory = categoryValue ? updatedChartAccounts.find(c => c.id === categoryValue) : null;

                                                  updateMutation.mutate({
                                                    id: transaction.id,
                                                    data: {
                                                      category_account_id: categoryValue,
                                                      type: selectedCategory?.class || transaction.type
                                                    }
                                                  });
                                                }}
                                                transactionType={transaction.type}
                                                triggerClassName="h-8 text-xs"
                                                disabled={isMatched(transaction)}
                                              />
                                            </div>
                                          )}
                                        </div>

                                        {(transaction.type === 'transfer' || transaction.type === 'credit_card_payment' || isMatched(transaction)) && (
                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <Label className="text-xs mb-1 block">From Account</Label>
                                              <Input
                                                value={(() => {
                                                  const fromAccount = accounts.find(a => a.id === transaction.bank_account_id);
                                                  return fromAccount ? getAccountDisplayName(fromAccount) : 'Unknown';
                                                })()}
                                                readOnly
                                                className="h-8 text-xs bg-slate-50"
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-xs mb-1 block">To Account</Label>
                                              <AccountDropdown
                                                value={(() => {
                                                  const paired = findPairedTransfer(transaction);
                                                  return paired?.bank_account_id || '';
                                                })()}
                                                onValueChange={(val) => {
                                                  if (val) {
                                                    const toAccount = accounts.find(a => a.id === val);
                                                    if (toAccount) {
                                                      updateMutation.mutate({
                                                        id: transaction.id,
                                                        data: {
                                                          transfer_to_bank_account_id: val
                                                        }
                                                      });
                                                    }
                                                  }
                                                }}
                                                showAllOption={false}
                                                showPendingCounts={false}
                                                triggerClassName="h-8 text-xs"
                                                placeholder="Select account..."
                                                filterAccounts={(acc) => acc.id !== transaction.bank_account_id}
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Match Tab Content */}
                                    {!isSplitMode(transaction.id) && (() => {
                                      const override = manualActionOverrides[transaction.id];
                                      if (override === 'post') return false;
                                      if (override === 'match') return true;
                                      // Check default - show Match tab if already paired OR if potential matches exist
                                      return !!findPairedTransfer(transaction) || findPotentialMatches(transaction).length > 0;
                                    })() && (
                                      <>

                                        {/* Potential Matches */}
                                        {(() => {
                                        // Always show potential matches in expanded view, regardless of whether currently paired
                                        const autoMatches = findPotentialMatches(transaction);
                                        const filters = manualMatchFilters[transaction.id] || {};
                                        const filterInputs = manualMatchFilterInputs[transaction.id] || {};
                                        const hasFilters = filters.account || filters.amountMin || filters.amountMax || filters.dateFrom || filters.dateTo;

                                        // If filtering manually, apply filters to all transactions
                                        const manualMatches = hasFilters ? transactions.filter(t => {
                                          if (t.id === transaction.id) return false;
                                          if (t.status === 'excluded') return false;
                                          if (!activeAccountIds.includes(t.bank_account_id)) return false;

                                          // Account filter
                                          if (filters.account && t.bank_account_id !== filters.account) return false;

                                          // Amount filter
                                          if (filters.amountMin && Math.abs(t.amount) < parseFloat(filters.amountMin)) return false;
                                          if (filters.amountMax && Math.abs(t.amount) > parseFloat(filters.amountMax)) return false;

                                          // Date filter
                                          if (filters.dateFrom && t.date < filters.dateFrom) return false;
                                          if (filters.dateTo && t.date > filters.dateTo) return false;

                                          return true;
                                        }) : [];

                                        let matches = hasFilters ? manualMatches : autoMatches;

                                        // Check if there's a suggested match (previously unmatched transaction)
                                        const suggestedMatchId = suggestedMatches[transaction.id];
                                        const suggestedMatch = suggestedMatchId ? transactions.find(t => t.id === suggestedMatchId) : null;

                                        // If there's a suggested match, prioritize it at the top
                                        if (suggestedMatch && !hasFilters) {
                                          // Remove from matches if it's already there
                                          matches = matches.filter(m => m.id !== suggestedMatch.id);
                                          // Add to the beginning
                                          matches = [suggestedMatch, ...matches];
                                        }

                                        const currentlyPaired = isMatched(transaction) ? findPairedTransfer(transaction) : null;

                                        return (
                                          <div className="text-xs">
                                            {!currentlyPaired && (
                                              <>
                                                <div className="mb-3">
                                                  <p className="text-xs text-slate-600 mb-2">Filter transactions to find a match:</p>
                                                  <div className="flex gap-2">
                                                <div className="flex-1">
                                                  <Label className="text-xs mb-1 block">Account</Label>
                                                  <AccountDropdown
                                                    value={filterInputs.account || 'all'}
                                                    onValueChange={(val) => {
                                                      const newVal = val === 'all' ? null : val;
                                                      setManualMatchFilterInputs(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          account: newVal
                                                        }
                                                      }));
                                                      setManualMatchFilters(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          account: newVal
                                                        }
                                                      }));
                                                    }}
                                                    showAllOption={true}
                                                    showPendingCounts={false}
                                                    triggerClassName="h-8 text-xs"
                                                    placeholder="All Accounts"
                                                  />
                                                </div>
                                                <div className="w-32">
                                                  <Label className="text-xs mb-1 block">Min</Label>
                                                  <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                                                    <Input
                                                      type="number"
                                                      step="0.01"
                                                      placeholder="0.00"
                                                      value={filterInputs.amountMin || ''}
                                                      onChange={(e) => {
                                                        setManualMatchFilterInputs(prev => ({
                                                          ...prev,
                                                          [transaction.id]: {
                                                            ...prev[transaction.id],
                                                            amountMin: e.target.value
                                                          }
                                                        }));
                                                      }}
                                                      onBlur={(e) => {
                                                        setManualMatchFilters(prev => ({
                                                          ...prev,
                                                          [transaction.id]: {
                                                            ...prev[transaction.id],
                                                            amountMin: e.target.value
                                                          }
                                                        }));
                                                      }}
                                                      className="h-8 text-xs pl-5"
                                                    />
                                                  </div>
                                                </div>
                                                <div className="w-32">
                                                  <Label className="text-xs mb-1 block">Max</Label>
                                                  <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                                                    <Input
                                                      type="number"
                                                      step="0.01"
                                                      placeholder="0.00"
                                                      value={filterInputs.amountMax || ''}
                                                      onChange={(e) => {
                                                        setManualMatchFilterInputs(prev => ({
                                                          ...prev,
                                                          [transaction.id]: {
                                                            ...prev[transaction.id],
                                                            amountMax: e.target.value
                                                          }
                                                        }));
                                                      }}
                                                      onBlur={(e) => {
                                                        setManualMatchFilters(prev => ({
                                                          ...prev,
                                                          [transaction.id]: {
                                                            ...prev[transaction.id],
                                                            amountMax: e.target.value
                                                          }
                                                        }));
                                                      }}
                                                      className="h-8 text-xs pl-5"
                                                    />
                                                  </div>
                                                </div>
                                                <div className="w-36">
                                                  <Label className="text-xs mb-1 block">Date From</Label>
                                                  <Input
                                                    type="date"
                                                    value={filterInputs.dateFrom || ''}
                                                    onChange={(e) => {
                                                      setManualMatchFilterInputs(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          dateFrom: e.target.value
                                                        }
                                                      }));
                                                    }}
                                                    onBlur={(e) => {
                                                      setManualMatchFilters(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          dateFrom: e.target.value
                                                        }
                                                      }));
                                                    }}
                                                    className="h-8 text-xs"
                                                  />
                                                </div>
                                                <div className="w-36">
                                                  <Label className="text-xs mb-1 block">Date To</Label>
                                                  <Input
                                                    type="date"
                                                    value={filterInputs.dateTo || ''}
                                                    onChange={(e) => {
                                                      setManualMatchFilterInputs(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          dateTo: e.target.value
                                                        }
                                                      }));
                                                    }}
                                                    onBlur={(e) => {
                                                      setManualMatchFilters(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          dateTo: e.target.value
                                                        }
                                                      }));
                                                    }}
                                                    className="h-8 text-xs"
                                                  />
                                                </div>
                                              </div>
                                            </div>

                                            {/* Always show heading and results section in Match mode */}
                                            <div className="mb-2">
                                              <p className="text-xs font-semibold text-slate-700 mb-2">
                                                {hasFilters ? 'Filtered Results:' : (autoMatches.length > 0 || suggestedMatch) ? 'Suggested Matches:' : 'No Matches Found'}
                                              </p>
                                              {autoMatches.length === 0 && !hasFilters && !suggestedMatch && (
                                                <p className="text-xs text-slate-500">
                                                  Use the filters above to search for matching transactions, or check browser console for debugging info.
                                                </p>
                                              )}
                                            </div>

                                            {(autoMatches.length > 0 || hasFilters || suggestedMatch) && (
                                              <>
                                                <div className="max-h-64 overflow-y-auto">
                                                  {matches.length === 0 && hasFilters ? (
                                                    <p className="text-slate-500 text-center py-2">No transactions found matching filters</p>
                                                  ) : (
                                                    <table className="w-max min-w-full" style={{ tableLayout: 'auto' }}>
                                                      <colgroup>
                                                        <col style={{ width: 32, minWidth: 32 }} />
                                                        <col style={{ width: 70, minWidth: 70 }} />
                                                        {selectedAccount === 'all' && <col style={{ width: columnWidths.account, minWidth: 50 }} />}
                                                        <col style={{ width: columnWidths.description, minWidth: 100 }} />
                                                        <col style={{ width: 1 }} />
                                                        <col style={{ width: 1 }} />
                                                        <col style={{ width: columnWidths.fromTo, minWidth: 100 }} />
                                                        <col style={{ width: columnWidths.categorize, minWidth: 100 }} />
                                                        <col style={{ width: 20, minWidth: 20, maxWidth: 20 }} />
                                                      </colgroup>
                                                      <tbody>
                                                        {matches.filter(match => !currentlyPaired || match.id !== currentlyPaired.id).map(match => {
                                                          const matchAccount = allActiveAccounts.find(a => a.id === match.bank_account_id) || accounts.find(a => a.id === match.bank_account_id);
                                                          const confidence = (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') && !hasFilters ? 100 : calculateMatchConfidence(transaction, match);
                                                          const isSelected = selectedMatches[transaction.id] === match.id;
                                                          const isSuggestedMatch = suggestedMatch && match.id === suggestedMatch.id;
                                                          const matchCategory = chartAccounts.find(c => c.id === match.category_account_id);

                                                          return (
                                                            <tr
                                                              key={match.id}
                                                              className={`cursor-pointer transition-colors ${
                                                                isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                                                              }`}
                                                              onClick={async () => {
                                                                const willBeSelected = !isSelected;

                                                                if (willBeSelected) {
                                                                  const pairId = crypto.randomUUID();

                                                                  try {
                                                                    await Promise.all([
                                                                      updateMutation.mutateAsync({
                                                                        id: transaction.id,
                                                                        data: {
                                                                          transfer_pair_id: pairId,
                                                                          type: 'transfer',
                                                                          original_type: transaction.original_type || transaction.type,
                                                                          category_account_id: null
                                                                        }
                                                                      }),
                                                                      updateMutation.mutateAsync({
                                                                        id: match.id,
                                                                        data: {
                                                                          transfer_pair_id: pairId,
                                                                          type: 'transfer',
                                                                          original_type: match.original_type || match.type,
                                                                          category_account_id: null
                                                                        }
                                                                      })
                                                                    ]);

                                                                    setSelectedMatches(prev => ({
                                                                      ...prev,
                                                                      [transaction.id]: match.id
                                                                    }));

                                                                    setSuggestedMatches(prev => {
                                                                      const next = { ...prev };
                                                                      delete next[transaction.id];
                                                                      delete next[match.id];
                                                                      return next;
                                                                    });
                                                                  } catch (error) {
                                                                    console.error('Failed to match transactions:', error);
                                                                    toast.error('Failed to match transactions. Please try again.');
                                                                  }
                                                                } else {
                                                                  const originalType1 = transaction.original_type || (transaction.amount > 0 ? 'income' : 'expense');
                                                                  const originalType2 = match.original_type || (match.amount > 0 ? 'income' : 'expense');

                                                                  try {
                                                                    await Promise.all([
                                                                      updateMutation.mutateAsync({
                                                                        id: transaction.id,
                                                                        data: {
                                                                          transfer_pair_id: null,
                                                                          type: originalType1,
                                                                          original_type: null
                                                                        }
                                                                      }),
                                                                      updateMutation.mutateAsync({
                                                                        id: match.id,
                                                                        data: {
                                                                          transfer_pair_id: null,
                                                                          type: originalType2,
                                                                          original_type: null
                                                                        }
                                                                      })
                                                                    ]);

                                                                    setSelectedMatches(prev => {
                                                                      const next = { ...prev };
                                                                      delete next[transaction.id];
                                                                      delete next[match.id];
                                                                      return next;
                                                                    });
                                                                  } catch (error) {
                                                                    console.error('Failed to unmatch transactions:', error);
                                                                    toast.error('Failed to unmatch transactions. Please try again.');
                                                                  }
                                                                }
                                                              }}
                                                            >
                                                              {/* Checkbox */}
                                                              <td className="border-r border-slate-200 text-center">
                                                                <input
                                                                  type="checkbox"
                                                                  checked={isSelected}
                                                                  onChange={() => {}}
                                                                  className="rounded w-3.5 h-3.5"
                                                                />
                                                              </td>

                                                              {/* Date */}
                                                              <td className="border-r border-slate-200 py-1 pl-2 pr-1 text-xs">
                                                                {format(parseISO(match.date), 'MM/dd/yy')}
                                                              </td>

                                                              {/* Account (if showing all) */}
                                                              {selectedAccount === 'all' && (
                                                                <td className="border-r border-slate-200 py-1 px-4 pl-2 truncate text-xs">
                                                                  {getAccountDisplayName(matchAccount)}
                                                                </td>
                                                              )}

                                                              {/* Description */}
                                                              <td className="border-r border-slate-200 py-1 px-4 pl-2 text-xs">
                                                                {formatTransactionDescription(match.description)}
                                                              </td>

                                                              {/* Spent */}
                                                              <td className="border-r border-slate-200 py-1 pl-2 text-left whitespace-nowrap text-xs">
                                                                {match.amount < 0 && (
                                                                  <span className="text-red-600 font-medium">
                                                                    ${Math.abs(match.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                  </span>
                                                                )}
                                                              </td>

                                                              {/* Received */}
                                                              <td className="border-r border-slate-200 py-1 pl-2 text-left whitespace-nowrap text-xs">
                                                                {match.amount >= 0 && (
                                                                  <span className="text-green-600 font-medium">
                                                                    ${Math.abs(match.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                  </span>
                                                                )}
                                                              </td>

                                                              {/* From/To */}
                                                              <td className="border-r border-slate-200 py-1 px-4 pl-2 truncate text-xs">
                                                                {(() => {
                                                                  if (match.type === 'transfer') {
                                                                    const otherAccount = accounts.find(a => a.id === transaction.bank_account_id);
                                                                    return otherAccount ? getAccountDisplayName(otherAccount) : '—';
                                                                  }
                                                                  const contact = contacts.find(c => c.id === match.contact_id);
                                                                  return contact ? contact.display_name : '—';
                                                                })()}
                                                              </td>

                                                              {/* Category */}
                                                              <td className="border-r border-slate-200 py-1 px-4 pl-2 truncate text-xs">
                                                                {(() => {
                                                                  if (match.type === 'transfer') return 'Transfer';
                                                                  if (match.type === 'credit_card_payment') return 'Credit Card Payment';
                                                                  return matchCategory?.display_name || '—';
                                                                })()}
                                                              </td>

                                                              {/* Match Badge */}
                                                              <td className="py-1 text-xs text-center">
                                                                {isSuggestedMatch ? (
                                                                  <span className="text-blue-600 font-medium">✓</span>
                                                                ) : (
                                                                  !hasFilters && (
                                                                    <span className="text-blue-600 font-medium">{confidence}%</span>
                                                                  )
                                                                )}
                                                              </td>
                                                            </tr>
                                                          );
                                                        })}
                                                      </tbody>
                                                    </table>
                                                  )}
                                                </div>
                                              </>
                                            )}
                                              </>
                                            )}
                                          </div>
                                        );
                                        })()}
                                      </>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label className="text-xs mb-1 block">Notes</Label>
                                        <Textarea
                                          defaultValue={transaction.notes || ''}
                                          className="text-xs min-h-[60px] resize-none"
                                          placeholder="Add notes..."
                                          onBlur={(e) => {
                                            if (e.target.value !== (transaction.notes || '')) {
                                              updateMutation.mutate({
                                                id: transaction.id,
                                                data: { notes: e.target.value }
                                              });
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs mb-1 block">Receipt / Files</Label>
                                        <div 
                                          className="border-2 border-dashed border-slate-300 rounded-md p-3 text-center hover:border-slate-400 transition-colors cursor-pointer h-[60px] flex items-center justify-center"
                                          onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
                                          }}
                                          onDragLeave={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                                          }}
                                          onDrop={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                                            const file = e.dataTransfer.files?.[0];
                                            if (file) {
                                              const { file_url } = await firstsavvy.integrations.Core.UploadFile({ file });
                                              updateMutation.mutate({
                                                id: transaction.id,
                                                data: { receipt_url: file_url }
                                              });
                                            }
                                          }}
                                        >
                                          <input
                                            type="file"
                                            className="hidden"
                                            id={`file-${transaction.id}`}
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const { file_url } = await firstsavvy.integrations.Core.UploadFile({ file });
                                                updateMutation.mutate({
                                                  id: transaction.id,
                                                  data: { receipt_url: file_url }
                                                });
                                              }
                                            }}
                                          />
                                          <label htmlFor={`file-${transaction.id}`} className="text-xs text-slate-500 cursor-pointer">
                                            {transaction.receipt_url ? 'Change file' : 'Drag & drop or click to upload'}
                                          </label>
                                        </div>
                                        {transaction.receipt_url && (
                                          <a href={transaction.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">
                                            View attached file
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                      <div className="flex items-center gap-2">
                                        {statusFilter === 'pending' && (
                                          <>
                                            {(() => {
                                              const manualAction = manualActionOverrides[transaction.id];

                                              let actionText, actionHandler;

                                              if (manualAction === 'post') {
                                                actionText = 'Post';
                                                actionHandler = async () => {
                                                  // Use unified postTransaction function to handle transfer pairs atomically
                                                  await postTransaction(transaction);
                                                  setExpandedTransactionId(null);
                                                };
                                              } else if (manualAction === 'match') {
                                                actionText = 'Match';
                                                actionHandler = () => {
                                                  const matches = transaction.type === 'transfer'
                                                    ? [findPairedTransfer(transaction)].filter(Boolean)
                                                    : findPotentialMatches(transaction);
                                                  setMatchingTransaction(transaction);
                                                  setPotentialMatches(matches);
                                                  setMatchDialogOpen(true);
                                                  setExpandedTransactionId(null);
                                                };
                                              } else {
                                                if (transaction.type === 'transfer') {
                                                  const paired = findPairedTransfer(transaction);
                                                  actionText = paired ? 'Match' : 'Post';
                                                  actionHandler = () => {
                                                    handleTransferMatch(transaction);
                                                    setExpandedTransactionId(null);
                                                  };
                                                } else {
                                                  const matches = findPotentialMatches(transaction);
                                                  actionText = matches.length > 0 ? 'Match' : 'Post';
                                                  actionHandler = () => {
                                                    handleMatchClick(transaction);
                                                    setExpandedTransactionId(null);
                                                  };
                                                }
                                              }

                                              const matches = (transaction.type === 'transfer' || transaction.type === 'credit_card_payment')
                                                ? [findPairedTransfer(transaction)].filter(Boolean)
                                                : findPotentialMatches(transaction);
                                              const hasSelection = selectedMatches[transaction.id];

                                              return (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                                  onClick={(e) => {
                                                    e?.stopPropagation();
                                                    if (actionText === 'Match') {
                                                      if (hasSelection || matches.length === 0) {
                                                        handleMatchClick(transaction);
                                                      }
                                                    } else {
                                                      actionHandler();
                                                    }
                                                  }}
                                                >
                                                  {actionText}
                                                </Button>
                                              );
                                              })()}
                                            <Button
                                              size="sm"
                                              variant={isSplitMode(transaction.id) ? "default" : "outline"}
                                              className={`h-7 text-xs ${isSplitMode(transaction.id) ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                                              onClick={(e) => {
                                                e?.stopPropagation();
                                                if (isSplitMode(transaction.id)) {
                                                  cancelSplitMode(transaction.id, transaction);
                                                } else {
                                                  initializeSplitMode(transaction);
                                                }
                                              }}
                                              disabled={isMatched(transaction) || transaction.type === 'transfer' || transaction.type === 'credit_card_payment'}
                                            >
                                              Split
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={(e) => {
                                                e?.stopPropagation();
                                                // TODO: Implement create rule functionality
                                              }}
                                            >
                                              Create Rule
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={(e) => {
                                                e?.stopPropagation();
                                                updateMutation.mutate({
                                                  id: transaction.id,
                                                  data: { status: 'excluded' }
                                                });
                                                setExpandedTransactionId(null);
                                              }}
                                            >
                                              Exclude
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                      {transaction.original_description && (
                                        <span className="text-xs text-slate-400 italic">
                                          {transaction.original_description}
                                        </span>
                                      )}
                                    </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500">
                                    <p>Transaction from inactive account</p>
                                    <p className="mt-1"><strong>ID:</strong> {transaction.id}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                                );
                                })
                                )}
                                </tbody>
                                </table>
                                </div>

                                {/* Footer */}
                                {filteredTransactions.length > 0 && (
                                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                                    <div className="text-sm text-slate-600">
                                      Showing {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? '' : 's'}
                                    </div>
                                  </div>
                                )}

                                </CardContent>
                                </Card>
      <TransactionFilterPanel
                            isOpen={filterPanelOpen}
                            onClose={() => setFilterPanelOpen(false)}
                            filters={filters}
                            onApply={(newFilters) => {
                              setFilters({...newFilters});
                              if (newFilters.account !== 'all') {
                                setSelectedAccount(newFilters.account);
                              }
                              setFilterPanelOpen(false);
                            }}
                            onReset={() => {
                              setFilters({
                                datePreset: 'all',
                                dateFrom: '',
                                dateTo: '',
                                account: 'all',
                                category: 'all',
                                type: 'all',
                                amountMin: '',
                                amountMax: '',
                                paymentMethod: 'all'
                              });
                              setSelectedAccount('all');
                              setFilterPanelOpen(false);
                            }}
                            accounts={accounts}
                            categories={chartAccounts}
                            expenseCategories={expenseCategories}
                            incomeCategories={incomeCategories}
                          />

                          <AccountCreationWizard
                                            open={addAccountSheetOpen}
                                            onOpenChange={setAddAccountSheetOpen}
                                            initialSubtype={triggeringTransactionType}
                                            initialCategoryName={categorySearchTerm}
                                            onAccountCreated={async (newCategory) => {
                                              setCategorySearchTerm('');
                                              setTriggeringTransactionId(null);
                                              setTriggeringTransactionType(null);
                                              await queryClient.invalidateQueries({ queryKey: ['user-chart-accounts-income-expense'] });
                                              if (triggeringTransactionId && newCategory) {
                                                const transaction = transactions.find(t => t.id === triggeringTransactionId);
                                                if (transaction) {
                                                  updateMutation.mutate({
                                                    id: transaction.id,
                                                    data: { category_account_id: newCategory.id, type: newCategory.type }
                                                  });
                                                }
                                              }
                                            }}
                                          />

                          <AddContactSheet
                            open={addContactSheetOpen}
                            onOpenChange={(open) => {
                              setAddContactSheetOpen(open);
                              if (!open) {
                                setTriggeringContactTransactionId(null);
                                setContactSearchTerm('');
                              }
                            }}
                            initialName={contactSearchTerm}
                            triggeringTransactionId={triggeringContactTransactionId}
                            onContactCreated={async (newContact, transactionId) => {
                              if (transactionId) {
                                const transaction = transactions.find(t => t.id === transactionId);
                                if (transaction) {
                                  await updateMutation.mutateAsync({
                                    id: transaction.id,
                                    data: {
                                      contact_id: newContact.id,
                                      contact_manually_set: true
                                    }
                                  });
                                }
                              }
                              setContactSearchTerm('');
                              setTriggeringContactTransactionId(null);
                            }}
                          />

                          <TransferMatchDialog
                            isOpen={transferMatchDialogOpen}
                            onClose={() => {
                              setTransferMatchDialogOpen(false);
                              setMatchingTransfer(null);
                              setPairedTransfer(null);
                            }}
                            transaction={matchingTransfer}
                            pairedTransaction={pairedTransfer}
                            accounts={accounts}
                            onConfirm={handleConfirmTransferMatch}
                          />

                          <TransferPostPreviewDialog
                            isOpen={transferPostPreviewOpen}
                            onClose={() => {
                              setTransferPostPreviewOpen(false);
                              setMatchingTransfer(null);
                              setPairedTransfer(null);
                            }}
                            transaction={matchingTransfer}
                            pairedTransaction={pairedTransfer}
                            fromAccount={matchingTransfer ? accounts.find(a => a.id === matchingTransfer.bank_account_id) : null}
                            toAccount={pairedTransfer ? accounts.find(a => a.id === pairedTransfer.bank_account_id) : null}
                            onPost={handlePostTransferFromPreview}
                            isPosting={isPostingTransfer}
                          />

                          <CreditCardPaymentMatchDialog
                            isOpen={ccPaymentDialogOpen}
                            onClose={() => {
                              setCCPaymentDialogOpen(false);
                              setMatchingCCPayment(null);
                              setPairedCCPayment(null);
                            }}
                            transaction={matchingCCPayment}
                            pairedTransaction={pairedCCPayment}
                            accounts={allActiveAccounts}
                            onConfirm={async () => {
                              if (matchingCCPayment?.cc_payment_pair_id) {
                                await handleAcceptCCPayment(matchingCCPayment.cc_payment_pair_id);
                              }
                            }}
                          />

                          <TransactionReviewDialog
                            open={reviewDialogOpen}
                            onOpenChange={setReviewDialogOpen}
                            extractedData={extractedData}
                            profileId={activeProfile?.id}
                            onImportComplete={handleImportComplete}
                          />
    </>
  );
}