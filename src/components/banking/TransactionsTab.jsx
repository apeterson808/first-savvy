import React, { useState } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Search, ChevronDown, SlidersHorizontal, Printer, Download, Settings, Loader2, Info, Plus, Link2, Unlink } from 'lucide-react';
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
import AddContactSheet from '../contacts/AddContactSheet';
import { getAccountDisplayName } from '../utils/constants';
import { toast } from 'sonner';
import { useProfile } from '@/contexts/ProfileContext';
import { getTransactionSplits, createTransactionSplits, updateTransactionSplits, deleteTransactionSplits } from '@/api/transactionSplits';
import CalculatorAmountInput from '../common/CalculatorAmountInput';
import { Trash2 } from 'lucide-react';
import * as transactionService from '@/api/transactionService';
import { TransactionReviewDialog } from './TransactionReviewDialog';
import { RuleDialog } from '../rules/RuleDialog';
import { usePersistedViewState } from '@/hooks/usePersistedViewState';
import { deleteViewPreferences } from '@/api/viewPreferences';
import { useAuth } from '@/contexts/AuthContext';
import { findSimilarUncategorized, findSimilarWithoutContact } from '@/utils/similarTransactions';
import { autoLearnRule } from '@/utils/autoLearnRule';
import { EditJournalEntryDialog } from '../accounting/EditJournalEntryDialog';

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
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [splitModeTransactions, setSplitModeTransactions] = useState(new Set());
  const [splitLineItems, setSplitLineItems] = useState({});
  const [loadingSplits, setLoadingSplits] = useState(new Set());
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [quickRuleDialogOpen, setQuickRuleDialogOpen] = useState(false);
  const [ruleSourceTransaction, setRuleSourceTransaction] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleMode, setRuleMode] = useState('create');
  const [editJournalEntryDialogOpen, setEditJournalEntryDialogOpen] = useState(false);
  const [editingJournalEntryId, setEditingJournalEntryId] = useState(null);

  const getTransactionAccountId = (transaction) => {
    return transaction.bank_account_id;
  };

  const getAccountDetails = (accountId) => {
    return accounts.find(acc => acc.id === accountId);
  };

  const isMatched = (transaction) => {
    return false;
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
        queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
        queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
        queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
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
          // Preserve account_detail from database (e.g., 'CreditCard', 'Checking', 'Savings')
          // This is critical for CC payment matching logic
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
    queryFn: () => firstsavvy.entities.TransactionRule.list('created_at'),
    enabled: !!activeProfile?.id
  });

  const autoLearnedRuleIds = new Set(
    categorizationRules.filter(r => r.created_from_transaction_id).map(r => r.id)
  );

  const categoryRuleIds = new Set(
    categorizationRules.filter(r => r.action_set_category_id).map(r => r.id)
  );

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
      return withRetry(() => firstsavvy.entities.Transaction.update(id, data), { maxRetries: 2 });
    },
    onMutate: async ({ id, data }) => {
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

      if (!error && variables?.data?.category_account_id) {
        const allTxns = [
          ...(queryClient.getQueryData(['fullPendingTransactions']) || []),
          ...(queryClient.getQueryData(['fullPostedTransactions']) || []),
        ];
        const source = allTxns.find(t => t.id === variables.id) || { id: variables.id, description: '', original_description: '' };
        const similar = findSimilarUncategorized(source, allTxns);
        for (const txn of similar) {
          updateMutation.mutate({ id: txn.id, data: { category_account_id: variables.data.category_account_id } });
        }
        if (activeProfile?.id) {
          autoLearnRule(activeProfile.id, source, { categoryId: variables.data.category_account_id });
        }
      }

      if (!error && variables?.data?.contact_id && variables?.data?.contact_manually_set) {
        const allTxns = [
          ...(queryClient.getQueryData(['fullPendingTransactions']) || []),
          ...(queryClient.getQueryData(['fullPostedTransactions']) || []),
        ];
        const source = allTxns.find(t => t.id === variables.id) || { id: variables.id, description: '', original_description: '' };
        const similar = findSimilarWithoutContact(source, allTxns);
        for (const txn of similar) {
          updateMutation.mutate({ id: txn.id, data: { contact_id: variables.data.contact_id, contact_manually_set: true } });
        }
        if (activeProfile?.id) {
          autoLearnRule(activeProfile.id, source, { contactId: variables.data.contact_id });
        }
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

  const findPairedTransfer = (transaction) => {
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

      const updateData1 = {
        type: originalType1,
        original_type: null
      };

      const updateData2 = {
        type: originalType2,
        original_type: null
      };

      if (transaction.transfer_pair_id) {
        updateData1.transfer_pair_id = null;
        updateData2.transfer_pair_id = null;
      }

      if (transaction.cc_payment_pair_id) {
        updateData1.cc_payment_pair_id = null;
        updateData2.cc_payment_pair_id = null;
      }

      updateMutation.mutate({
        id: transaction.id,
        data: updateData1
      });

      updateMutation.mutate({
        id: pairedTransaction.id,
        data: updateData2
      });

      setSelectedMatches(prev => {
        const next = { ...prev };
        delete next[transaction.id];
        delete next[pairedTransaction.id];
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

  const findPotentialMatches = (transaction) => {
    return [];
  };

  // Calculate match confidence based purely on date proximity
  const calculateMatchConfidence = (transaction, match) => {
    const tDate = new Date(transaction.date);
    const mDate = new Date(match.date);
    const daysDiff = Math.abs((tDate - mDate) / (1000 * 60 * 60 * 24));

    // Pure date-based scoring
    if (daysDiff === 0) return 100;  // Same day
    if (daysDiff === 1) return 95;   // 1 day apart
    if (daysDiff === 2) return 90;   // 2 days apart
    if (daysDiff === 3) return 85;   // 3 days apart
    if (daysDiff === 4) return 80;   // 4 days apart
    if (daysDiff === 5) return 75;   // 5 days apart
    if (daysDiff === 6) return 70;   // 6 days apart
    if (daysDiff === 7) return 65;   // 7 days apart
    if (daysDiff === 8) return 60;   // 8 days apart
    if (daysDiff === 9) return 55;   // 9 days apart
    if (daysDiff === 10) return 50;  // 10 days apart

    return 50; // Fallback (shouldn't reach here with 10-day limit)
  };

  // Unified function to post transaction(s) - handles both single transactions and transfer pairs atomically
  const postTransaction = async (transaction) => {
    // Validate splits first
    const canPost = await handlePostWithSplit(transaction);
    if (!canPost) return false;

    // Validate category requirement (except for transfers and credit card payments)
    const isTransfer = transaction.type === 'transfer';
    const isCCPayment = transaction.type === 'credit_card_payment';
    const isSplit = transaction.is_split;

    if (!isTransfer && !isCCPayment && !isSplit && !transaction.category_account_id) {
      toast.error('Please select a category before posting');
      return false;
    }

    // Post single transaction
    const result = await transactionService.postTransaction(transaction.id);
    if (result.error) {
      console.error('Failed to post transaction:', result.error);
      toast.error('Failed to post transaction. Please try again.');
      return false;
    }

    queryClient.invalidateQueries(['fullPendingTransactions']);
    queryClient.invalidateQueries(['fullPostedTransactions']);
    toast.success('Transaction posted');
    return true;
  };

  const handleTransferMatch = async (transaction) => {
    toast.error('Matching is disabled');
  };

  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    toast.success('Transactions imported successfully');
    setReviewDialogOpen(false);
    setExtractedData(null);
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
                          className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} h-8 ${statusFilter === 'pending' ? 'cursor-pointer' : ''} ${expandedTransactionId === transaction.id ? 'bg-slate-100 border-t border-l border-r border-blue-500' : ''}`}
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
                                                      {(transaction.type === 'expense' || transaction.type === 'transfer' || transaction.type === 'credit_card_payment') && (
                                                        <span>
                                                          ${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="text-right text-sm border-r border-slate-200 py-1 pl-1 pr-2 whitespace-nowrap">
                                                      {transaction.type === 'income' && (
                                                        <span>
                                                          ${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                      )}
                                                    </td>
                        <td className="border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.fromTo, minWidth: columnWidths.fromTo, maxWidth: columnWidths.fromTo }}>
                          {(() => {
                            // For transfers/credit card payments that are actually paired, show the paired account name (not editable)
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
                            if (isSplitMode(transaction.id)) {
                              return <span className="text-xs px-1 text-blue-600 font-medium">Split</span>;
                            }

                            if (transaction.is_split && !isSplitMode(transaction.id)) {
                              return <span className="text-xs px-1 text-blue-600 font-medium">Split</span>;
                            }


                            // For refunds, show refund indicator
                            if (transaction.type === 'income' && transaction.original_type === 'expense') {
                              return <span className="text-xs px-1 text-emerald-600 font-medium">Refund</span>;
                            }


                            // For regular transactions, show editable category dropdown (or read-only in posted)
                            if (statusFilter === 'posted') {
                              if (transaction.type === 'transfer') {
                                return <span className="text-xs px-1">Bank Transfer</span>;
                              } else if (transaction.type === 'credit_card_payment') {
                                return <span className="text-xs px-1">Credit Card Payment</span>;
                              }
                              const category = chartAccounts.find(c => c.id === transaction.category_account_id);
                              const displayName = category?.display_name || '—';
                              return <span className="text-xs px-1">{displayName}</span>;
                            }

                            return (
                              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 w-full min-w-0">
                                {transaction.applied_rule_id && !autoLearnedRuleIds.has(transaction.applied_rule_id) && categoryRuleIds.has(transaction.applied_rule_id) && (
                                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-normal bg-blue-50 text-blue-700 border-blue-200 flex-shrink-0">
                                    RULE
                                  </Badge>
                                )}
                                <div className="flex-1 min-w-0">
                                  <CategoryDropdown
                                    value={transaction.type === 'transfer' || transaction.type === 'credit_card_payment' ? transaction.type : transaction.category_account_id}
                                    onValueChange={async (value) => {
                                      if (!activeAccountIds.includes(transaction.bank_account_id)) return;

                                      if (value === 'transfer' || value === 'credit_card_payment') {
                                        const updateData = { type: value, category_account_id: null };
                                        const pairId = transaction.cc_payment_pair_id || transaction.transfer_pair_id;

                                        if (transaction.type === 'credit_card_payment' && value === 'transfer') {
                                          updateData.transfer_pair_id = transaction.cc_payment_pair_id;
                                          updateData.cc_payment_pair_id = null;
                                          updateData.cc_payment_review_status = null;

                                          if (pairId) {
                                            const { data: paired } = await firstsavvy
                                              .from('transactions')
                                              .select('*')
                                              .eq('cc_payment_pair_id', pairId)
                                              .neq('id', transaction.id)
                                              .maybeSingle();

                                            if (paired) {
                                              updateMutation.mutate({
                                                id: paired.id,
                                                data: {
                                                  transfer_pair_id: pairId,
                                                  cc_payment_pair_id: null,
                                                  type: 'transfer',
                                                  cc_payment_review_status: null
                                                }
                                              });
                                            }
                                          }
                                        } else if (transaction.type === 'transfer' && value === 'credit_card_payment') {
                                          updateData.cc_payment_pair_id = transaction.transfer_pair_id;
                                          updateData.transfer_pair_id = null;
                                          updateData.cc_payment_review_status = 'unreviewed';

                                          if (pairId) {
                                            const { data: paired } = await firstsavvy
                                              .from('transactions')
                                              .select('*')
                                              .eq('transfer_pair_id', pairId)
                                              .neq('id', transaction.id)
                                              .maybeSingle();

                                            if (paired) {
                                              updateMutation.mutate({
                                                id: paired.id,
                                                data: {
                                                  cc_payment_pair_id: pairId,
                                                  transfer_pair_id: null,
                                                  type: 'credit_card_payment',
                                                  cc_payment_review_status: 'unreviewed'
                                                }
                                              });
                                            }
                                          }
                                        }

                                        updateMutation.mutate({
                                          id: transaction.id,
                                          data: updateData
                                        });
                                        return;
                                      }

                                      const categoryValue = value === '' ? null : value;

                                      await queryClient.refetchQueries({ queryKey: ['user-chart-accounts'] });
                                      await queryClient.refetchQueries({ queryKey: ['chart-accounts'] });

                                      const updatedChartAccounts = queryClient.getQueryData(['chart-accounts', 'expense', activeProfile?.id]) ||
                                                                  queryClient.getQueryData(['chart-accounts', 'income', activeProfile?.id]) ||
                                                                  chartAccounts;
                                      const selectedCategory = categoryValue ? updatedChartAccounts.find(c => c.id === categoryValue) : null;

                                      const updateData = { category_account_id: categoryValue };

                                      if (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') {
                                        updateData.type = null;
                                        updateData.transfer_pair_id = null;
                                        updateData.cc_payment_pair_id = null;
                                        updateData.cc_payment_review_status = null;
                                      }

                                      updateMutation.mutate({
                                        id: transaction.id,
                                        data: updateData
                                      });
                                    }}
                                    transactionType={transaction.type}
                                    disabled={!activeAccountIds.includes(transaction.bank_account_id)}
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
                                  />
                                </div>
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
                                <button
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => {
                                    e?.stopPropagation();
                                    postTransaction(transaction);
                                  }}
                                >
                                  Post
                                </button>
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
                                      <ClickThroughDropdownMenuItem
                                        onClick={async (e) => {
                                          e?.stopPropagation();
                                          if (transaction.applied_rule_id) {
                                            try {
                                              const { data: rule, error } = await firstsavvy
                                                .from('transaction_rules')
                                                .select('*')
                                                .eq('id', transaction.applied_rule_id)
                                                .single();

                                              if (error) throw error;

                                              setEditingRule(rule);
                                              setRuleMode('edit');
                                              setRuleSourceTransaction(transaction);
                                              setQuickRuleDialogOpen(true);
                                            } catch (error) {
                                              console.error('Failed to load rule:', error);
                                              toast.error('Failed to load rule');
                                            }
                                          } else {
                                            setRuleMode('create');
                                            setEditingRule(null);
                                            setRuleSourceTransaction(transaction);
                                            setQuickRuleDialogOpen(true);
                                          }
                                        }}
                                        disabled={transaction.type === 'transfer' || transaction.type === 'credit_card_payment'}
                                      >
                                        {transaction.applied_rule_id ? 'Edit Rule' : 'Create Rule'}
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
                                    if (transaction.current_journal_entry_id) {
                                      setEditingJournalEntryId(transaction.current_journal_entry_id);
                                      setEditJournalEntryDialogOpen(true);
                                    } else {
                                      toast.error('No journal entry found for this transaction');
                                    }
                                  }}
                                >
                                  Edit
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
                          <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                            <td colSpan={selectedAccount === 'all' ? 9 : 8} className="p-0 border-l border-r border-b border-blue-500">
                              <div className="bg-slate-50">
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
                                                <CalculatorAmountInput
                                                  value={parseFloat(line.amount) || 0}
                                                  onChange={(value) => updateSplitLine(transaction.id, lineIndex, 'amount', value)}
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
                                    ) : null}
                                    </div>

                                    {/* Categorize Section */}
                                    <div className="px-4 pb-4 space-y-2">
                                    {!isSplitMode(transaction.id) && statusFilter === 'pending' && (
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
                                              <Label className="text-xs mb-1 block">Bank Memo</Label>
                                              <Input
                                                value={transaction.original_description || 'No bank memo'}
                                                readOnly
                                                className="h-8 text-xs bg-slate-50 text-slate-600"
                                                title={transaction.original_description || 'No bank memo'}
                                              />
                                            </div>
                                          )}
                                        </div>

                                        {(transaction.type === 'transfer' || transaction.type === 'credit_card_payment') && (
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
                                                  // Account changes for transfers should be handled through the transfer matching flow
                                                  // This is read-only display
                                                }}
                                                showAllOption={false}
                                                showPendingCounts={false}
                                                triggerClassName="h-8 text-xs bg-slate-50"
                                                placeholder="Select account..."
                                                filterAccounts={(acc) => acc.id !== transaction.bank_account_id}
                                                readOnly
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
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
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                              onClick={async (e) => {
                                                e?.stopPropagation();
                                                await postTransaction(transaction);
                                                setExpandedTransactionId(null);
                                              }}
                                            >
                                              Post
                                            </Button>
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
                                              onClick={async (e) => {
                                                e?.stopPropagation();
                                                if (transaction.applied_rule_id) {
                                                  try {
                                                    const { data: rule, error } = await firstsavvy
                                                      .from('transaction_rules')
                                                      .select('*')
                                                      .eq('id', transaction.applied_rule_id)
                                                      .single();

                                                    if (error) throw error;

                                                    setEditingRule(rule);
                                                    setRuleMode('edit');
                                                    setRuleSourceTransaction(transaction);
                                                    setQuickRuleDialogOpen(true);
                                                  } catch (error) {
                                                    console.error('Failed to load rule:', error);
                                                    toast.error('Failed to load rule');
                                                  }
                                                } else {
                                                  setRuleMode('create');
                                                  setEditingRule(null);
                                                  setRuleSourceTransaction(transaction);
                                                  setQuickRuleDialogOpen(true);
                                                }
                                              }}
                                              disabled={transaction.type === 'transfer' || transaction.type === 'credit_card_payment'}
                                            >
                                              {transaction.applied_rule_id ? 'Edit Rule' : 'Create Rule'}
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

                          <TransactionReviewDialog
                            open={reviewDialogOpen}
                            onOpenChange={setReviewDialogOpen}
                            extractedData={extractedData}
                            profileId={activeProfile?.id}
                            onImportComplete={handleImportComplete}
                          />

                          <RuleDialog
                            mode={ruleMode}
                            open={quickRuleDialogOpen}
                            onOpenChange={(open) => {
                              setQuickRuleDialogOpen(open);
                              if (!open) {
                                setEditingRule(null);
                                setRuleMode('create');
                              }
                            }}
                            transaction={ruleSourceTransaction}
                            profileId={activeProfile?.id}
                            rule={editingRule}
                          />

                          <EditJournalEntryDialog
                            open={editJournalEntryDialogOpen}
                            onOpenChange={(open) => {
                              setEditJournalEntryDialogOpen(open);
                              if (!open) {
                                setEditingJournalEntryId(null);
                              }
                            }}
                            entryId={editingJournalEntryId}
                            onSuccess={() => {
                              queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
                              queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
                              queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
                              queryClient.invalidateQueries(['accounts']);
                              queryClient.invalidateQueries(['journal-entries']);
                            }}
                          />
    </>
  );
}