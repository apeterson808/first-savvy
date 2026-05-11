import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import {
  Building2, Hash, DollarSign, Calendar, Edit2, Save, X, Trash2, ArrowLeft,
  TrendingUp, TrendingDown, Link2, Car, CreditCard as CreditCardIcon, Wallet,
  Download, Printer, Search, Filter, ExternalLink, FileText, Minus, Equal, History, Upload,
  Target, Undo, Check, Undo2
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency, formatLabel } from '@/components/utils/formatters';
import IconPicker from '@/components/common/IconPicker';
import ColorPicker from '@/components/common/ColorPicker';
import DatePresetDropdown from '@/components/common/DatePresetDropdown';
import { getAccountWithLinks } from '@/api/vehiclesAndLoans';
import { getAccountDisplayName } from '@/components/utils/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts, deleteUserCreatedAccount, getChartAccountById } from '@/api/chartOfAccounts';
import { getAccountJournalLinesPaginated, getMultiAccountJournalLinesPaginated, getAccountAuditHistoryPaginated, getMultiAccountAuditHistoryPaginated, createOpeningBalanceJournalEntry } from '@/api/journalEntries';
import { getDateRangeFromPreset, formatDateForDb } from '@/utils/dateRangeUtils';
import JournalEntryDialog from '@/components/accounting/JournalEntryDialog';
import AuditHistoryModal from '@/components/accounting/AuditHistoryModal';
import { useAccountTypesByClass, useAccountDetailsByType } from '@/hooks/useChartOfAccounts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CsvColumnMapper from '@/components/banking/CsvColumnMapper';
import { processStatementFile, autoMatchTransfers, mapCsvToTransactions } from '@/components/banking/StatementProcessor';
import { detectDuplicateTransactions } from '@/api/duplicateDetection';
import { budgetAnalytics } from '@/api/budgetAnalytics';
import { BudgetOverviewCard } from '@/components/budgeting/BudgetOverviewCard';
import { BudgetPerformanceCard } from '@/components/budgeting/BudgetPerformanceCard';
import { SpendingAndVendorCard } from '@/components/budgeting/SpendingAndVendorCard';
import { ChildBudgetSection } from '@/components/budgeting/ChildBudgetSection';
import CategoryDropdown from '@/components/common/CategoryDropdown';
import ContactDropdown from '@/components/common/ContactDropdown';
import { TRANSACTION_TABLE_CONFIG, getRowClassName, getHeaderCellClassName, getBodyCellClassName } from '@/components/common/TransactionTableConfig';

function getAuditEntryTypeLabel(entryType, accountClass, debitAmount, creditAmount) {
  // New specific types — just clean up the name
  if (!['adjustment', 'transaction'].includes(entryType)) {
    return entryType.replace(/_/g, ' ');
  }
  // Fallback derivation for old adjustment entries not yet backfilled
  const cls = (accountClass || '').toLowerCase();
  const hasDebit = parseFloat(debitAmount || 0) > 0;
  if (cls === 'liability') {
    // debit on cc = charge (spending); credit = payment
    return hasDebit ? 'charge' : 'payment';
  }
  if (cls === 'expense') {
    return hasDebit ? 'expense' : 'refund';
  }
  return hasDebit ? 'deposit' : 'withdrawal';
}

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isBudgetEditMode, setIsBudgetEditMode] = useState(false);
  const [datePreset, setDatePreset] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState(null);
  const [selectedTransactionForAudit, setSelectedTransactionForAudit] = useState(null);
  const [activeTab, setActiveTab] = useState('register');
  const [budgetLedgerTab, setBudgetLedgerTab] = useState('register');
  const [currentPage, setCurrentPage] = useState(0);
  const [currentAuditPage, setCurrentAuditPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    entryType: 'all',
    minAmount: '',
    maxAmount: '',
    contact: ''
  });
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editContactId, setEditContactId] = useState('');
  const registerTableRef = useRef(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeProfile } = useProfile();

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importStep, setImportStep] = useState('upload');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [mappedTransactions, setMappedTransactions] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [budgetMonth, setBudgetMonth] = useState(new Date());

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editAccountType, setEditAccountType] = useState('');
  const [editAccountDetail, setEditAccountDetail] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get('from') || '?tab=accounts';

  const dateRange = useMemo(() => getDateRangeFromPreset(datePreset), [datePreset]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editingTransactionId && registerTableRef.current && !registerTableRef.current.contains(event.target)) {
        cancelEditingTransaction();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingTransactionId]);

  // Hooks for fetching account types and details in edit mode
  const { accountTypes = [] } = useAccountTypesByClass(editClass);
  const { accountDetails = [] } = useAccountDetailsByType(editClass, editAccountType);

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      if (!id) return null;

      const accountData = await getChartAccountById(id);

      if (!accountData) {
        return null;
      }

      const getEntityType = (accountClass) => {
        const classMap = {
          'asset': 'Asset',
          'liability': 'Liability',
          'equity': 'Equity',
          'income': 'Income',
          'expense': 'Expense'
        };
        return classMap[accountClass] || accountClass.charAt(0).toUpperCase() + accountClass.slice(1);
      };

      return {
        ...accountData,
        entityType: getEntityType(accountData.class),
        name: getAccountDisplayName(accountData),
        type: accountData.class
      };
    },
    enabled: !!id
  });

  const { data: linkedAccountsData = { linkedAccounts: [] }, isLoading: linkedAccountsLoading } = useQuery({
    queryKey: ['linkedAccounts', id, account?.entityType, activeProfile?.id],
    queryFn: async () => {
      if (!account || !id || !activeProfile) return { linkedAccounts: [] };
      if (account.entityType === 'Asset' || account.entityType === 'Liability') {
        return await getAccountWithLinks(id, account.entityType, activeProfile.id);
      }
      return { linkedAccounts: [] };
    },
    enabled: !!account && !!activeProfile && (account.entityType === 'Asset' || account.entityType === 'Liability')
  });

  const linkedAccounts = linkedAccountsData?.linkedAccounts || [];

  const isTransactionBasedAccount = useMemo(() => {
    if (!account) return true;
    const accountClass = account.account_class || account.class || 'asset';
    return accountClass === 'asset' || accountClass === 'liability';
  }, [account]);

  const isOpeningBalanceEquity = useMemo(() => {
    if (!account) return false;
    const accountDetail = account.account_detail;
    return accountDetail === 'opening_balance_equity';
  }, [account]);

  const isBudgetableAccount = useMemo(() => {
    if (!account) return false;
    const accountClass = account.account_class || account.class;
    return accountClass === 'expense' || accountClass === 'income';
  }, [account]);

  const isChildBudgetAccount = useMemo(() => {
    if (!account || !isBudgetableAccount) return false;
    return !!account.parent_account_id;
  }, [account, isBudgetableAccount]);

  React.useEffect(() => {
    if (isChildBudgetAccount && account?.parent_account_id) {
      navigate(`/Banking/account/${account.parent_account_id}`, { replace: true });
    }
  }, [isChildBudgetAccount, account?.parent_account_id, navigate]);

  const { data: childAccounts = [] } = useQuery({
    queryKey: ['child-accounts', id, activeProfile?.id],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('user_chart_of_accounts')
        .select('*')
        .eq('parent_account_id', id)
        .eq('profile_id', activeProfile.id)
        .order('account_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount
  });

  const { data: childBudgets = [] } = useQuery({
    queryKey: ['child-budgets', id, activeProfile?.id],
    queryFn: async () => {
      if (!childAccounts.length) return [];
      const childIds = childAccounts.map(c => c.id);
      const { data, error } = await firstsavvy.supabase
        .from('budgets')
        .select('*')
        .in('chart_account_id', childIds)
        .eq('profile_id', activeProfile.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount && childAccounts.length > 0
  });

  const { data: childSpending } = useQuery({
    queryKey: ['child-spending-this-month', id, activeProfile?.id, childAccounts.map(c => c.id).join(','), budgetMonth.toISOString()],
    queryFn: async () => {
      if (!childAccounts.length) return {};
      const monthStart = startOfMonth(budgetMonth);
      const monthEnd = endOfMonth(budgetMonth);
      const childIds = childAccounts.map(c => c.id);
      const { data, error } = await firstsavvy.supabase
        .from('transactions')
        .select('amount, category_account_id')
        .eq('profile_id', activeProfile.id)
        .in('category_account_id', childIds)
        .eq('status', 'posted')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString());
      if (error) throw error;
      const map = {};
      for (const t of data || []) {
        map[t.category_account_id] = (map[t.category_account_id] || 0) + Math.abs(t.amount || 0);
      }
      return map;
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount && childAccounts.length > 0
  });

  const { data: budget } = useQuery({
    queryKey: ['budget-for-category', id, activeProfile?.id],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('budgets')
        .select('*')
        .eq('chart_account_id', id)
        .eq('profile_id', activeProfile.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount
  });

  const { data: currentMonthSpending } = useQuery({
    queryKey: ['current-month-spending', id, activeProfile?.id, budgetMonth.toISOString(), childAccounts.length],
    queryFn: async () => {
      const monthStart = startOfMonth(budgetMonth);
      const monthEnd = endOfMonth(budgetMonth);

      const accountIds = childAccounts.length > 0
        ? [id, ...childAccounts.map(c => c.id)]
        : [id];

      const { data, error } = await firstsavvy.supabase
        .from('transactions')
        .select('amount')
        .eq('profile_id', activeProfile.id)
        .in('category_account_id', accountIds)
        .eq('status', 'posted')
        .eq('type', account?.class === 'expense' ? 'expense' : 'income')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString());

      if (error) throw error;
      return data?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount && !!account
  });

  const childAccountIds = useMemo(() => childAccounts.map(c => c.id), [childAccounts]);

  const { data: historicalData } = useQuery({
    queryKey: ['historical-spending', id, activeProfile?.id, childAccountIds],
    queryFn: async () => {
      return await budgetAnalytics.getHistoricalSpending(id, 12, activeProfile.id, childAccountIds);
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendor-breakdown', id, activeProfile?.id, childAccountIds],
    queryFn: async () => {
      return await budgetAnalytics.getVendorBreakdown(
        id,
        null,
        activeProfile.id,
        childAccountIds
      );
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount
  });

  const { data: performanceHistory } = useQuery({
    queryKey: ['budget-performance-history', id, activeProfile?.id],
    queryFn: async () => {
      return await budgetAnalytics.getBudgetPerformanceHistory(id, 12, activeProfile.id);
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount
  });

  const { data: comparativeData } = useQuery({
    queryKey: ['comparative-analysis', id, activeProfile?.id],
    queryFn: async () => {
      return await budgetAnalytics.getComparativeAnalysis(id, activeProfile.id);
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount
  });

  const { data: childAnalytics } = useQuery({
    queryKey: ['child-analytics', id, activeProfile?.id, childAccounts.map(c => c.id).join(',')],
    queryFn: async () => {
      if (!childAccounts.length) return {};
      const results = await Promise.all(
        childAccounts.map(async (child) => {
          const [historical, performance, comparative] = await Promise.all([
            budgetAnalytics.getHistoricalSpending(child.id, 12, activeProfile.id),
            budgetAnalytics.getBudgetPerformanceHistory(child.id, 12, activeProfile.id),
            budgetAnalytics.getComparativeAnalysis(child.id, activeProfile.id),
          ]);
          return { id: child.id, historical, performance, comparative };
        })
      );
      return Object.fromEntries(results.map(r => [r.id, { historical: r.historical, performance: r.performance, comparative: r.comparative }]));
    },
    enabled: !!id && !!activeProfile?.id && isBudgetableAccount && childAccounts.length > 0
  });

  // NOTE: Pending transactions are NOT shown in the register (QuickBooks behavior)
  // Transactions only appear in the register after they've been posted to journal entries

  // SOURCE OF TRUTH: Query posted journal entry lines with pagination
  const hasChildAccounts = childAccounts.length > 0;
  const allAccountIds = useMemo(() => [id, ...childAccountIds], [id, childAccountIds]);
  const PAGE_SIZE = 10;

  const {
    data: journalLinesData,
    isLoading: journalLinesLoading,
    error: journalLinesError
  } = useQuery({
    queryKey: ['journal-lines-paginated', 'account', id, activeProfile?.id, datePreset, isOpeningBalanceEquity, hasChildAccounts, childAccountIds, isBudgetableAccount, currentPage],
    queryFn: async () => {
      if (!id || !activeProfile) return { lines: [], totalCount: 0, hasMore: false };

      const useNoDateFilter = isBudgetableAccount || isOpeningBalanceEquity;
      const offset = currentPage * PAGE_SIZE;

      if (hasChildAccounts) {
        return await getMultiAccountJournalLinesPaginated({
          profileId: activeProfile.id,
          accountIds: allAccountIds,
          startDate: useNoDateFilter ? null : formatDateForDb(dateRange.start),
          endDate: useNoDateFilter ? null : formatDateForDb(dateRange.end),
          limit: PAGE_SIZE,
          offset: offset
        });
      }

      return await getAccountJournalLinesPaginated({
        profileId: activeProfile.id,
        accountId: id,
        startDate: useNoDateFilter ? null : formatDateForDb(dateRange.start),
        endDate: useNoDateFilter ? null : formatDateForDb(dateRange.end),
        limit: PAGE_SIZE,
        offset: offset
      });
    },
    enabled: !!id && !!activeProfile,
    keepPreviousData: true
  });

  const journalLines = journalLinesData?.lines || [];
  const totalJournalLines = journalLinesData?.totalCount || 0;
  const totalPages = Math.ceil(totalJournalLines / PAGE_SIZE);
  const hasNextPage = currentPage < totalPages - 1;
  const hasPreviousPage = currentPage > 0;

  const {
    data: auditHistoryData,
    isLoading: auditHistoryLoading,
    error: auditHistoryError
  } = useQuery({
    queryKey: ['audit-history-paginated', 'account', id, activeProfile?.id, datePreset, isBudgetableAccount, currentAuditPage, childAccounts.map(c => c.id).join(',')],
    queryFn: async () => {
      if (!id || !activeProfile) return { lines: [], totalCount: 0, hasMore: false };
      const offset = currentAuditPage * PAGE_SIZE;

      const accountIds = [id, ...childAccounts.map(c => c.id)];

      if (accountIds.length > 1) {
        return await getMultiAccountAuditHistoryPaginated({
          profileId: activeProfile.id,
          accountIds: accountIds,
          startDate: isBudgetableAccount ? null : formatDateForDb(dateRange.start),
          endDate: isBudgetableAccount ? null : formatDateForDb(dateRange.end),
          limit: PAGE_SIZE,
          offset: offset
        });
      } else {
        return await getAccountAuditHistoryPaginated({
          profileId: activeProfile.id,
          accountId: id,
          startDate: isBudgetableAccount ? null : formatDateForDb(dateRange.start),
          endDate: isBudgetableAccount ? null : formatDateForDb(dateRange.end),
          limit: PAGE_SIZE,
          offset: offset
        });
      }
    },
    enabled: !!id && !!activeProfile && (activeTab === 'audit' || budgetLedgerTab === 'audit'),
    keepPreviousData: true
  });

  const auditHistoryLines = auditHistoryData?.lines || [];
  const totalAuditLines = auditHistoryData?.totalCount || 0;
  const totalAuditPages = Math.ceil(totalAuditLines / PAGE_SIZE);
  const hasNextAuditPage = currentAuditPage < totalAuditPages - 1;
  const hasPreviousAuditPage = currentAuditPage > 0;

  // Helper functions for edit mode
  const cancelEditMode = () => {
    setIsEditMode(false);
    setEditName('');
    setEditClass('');
    setEditAccountType('');
    setEditAccountDetail('');
    setEditIsActive(true);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (!activeProfile) throw new Error('No active profile');
      const { data: updatedData, error } = await firstsavvy
        .from('user_chart_of_accounts')
        .update(data)
        .eq('id', id)
        .eq('profile_id', activeProfile.id)
        .select()
        .single();

      if (error) throw error;
      return updatedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['equity'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-of-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      cancelEditMode();
      toast.success('Account updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update account: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }) => {
      if (!activeProfile) throw new Error('No active profile');
      return deleteUserCreatedAccount(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['equity'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      toast.success('Account deleted');
      navigate(-1);
    },
    onError: (error) => {
      toast.error(`Failed to delete account: ${error.message}`);
    }
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ transactionId, updates }) => {
      return await firstsavvy.entities.Transaction.update(transactionId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-lines'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budget-analytics'] });
      setEditingTransactionId(null);
      toast.success('Transaction updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update transaction: ${error.message}`);
    }
  });

  const startEditingTransaction = async (activity) => {
    if (!activity.transactionId) return;

    const { data: transaction, error } = await firstsavvy.supabase
      .from('transactions')
      .select('id, description, category_account_id, contact_id')
      .eq('id', activity.transactionId)
      .maybeSingle();

    if (error) {
      toast.error('Failed to load transaction details');
      return;
    }

    if (!transaction) {
      toast.error('Transaction not found');
      return;
    }

    setEditingTransactionId(transaction.id);
    setEditDescription(transaction.description || '');
    setEditCategoryId(transaction.category_account_id || '');
    setEditContactId(transaction.contact_id || '');
  };

  const cancelEditingTransaction = () => {
    setEditingTransactionId(null);
    setEditDescription('');
    setEditCategoryId('');
    setEditContactId('');
  };

  const saveTransactionEdit = async (transactionId) => {
    if (!transactionId) return;

    const updates = {
      description: editDescription,
      category_account_id: editCategoryId || null,
      contact_id: editContactId || null
    };

    updateTransactionMutation.mutate({ transactionId, updates });
  };

  // Determine if this is a bank account (asset/liability with bank-related detail)
  const isBankAccount = useMemo(() => {
    if (!account) return false;
    const accountClass = account.account_class || account.class;
    const accountDetail = account.account_detail;

    // Check if it's an asset or liability with bank-related account_detail
    if ((accountClass === 'asset' || accountClass === 'liability') && accountDetail) {
      const bankDetails = ['checking_account', 'savings_account', 'money_market', 'certificate_of_deposit'];
      return bankDetails.includes(accountDetail);
    }
    return false;
  }, [account]);

  const isActive = account?.is_active !== false;
  const accountClass = account?.account_class || account?.class || 'Asset';

  const { allActivity, analytics, beginningBalance, endingBalance } = useMemo(() => {
    const accountClass = account?.account_class || account?.class || 'asset';
    const isDebitNormal = accountClass === 'asset' || accountClass === 'expense';

    // ALL accounts show only posted journal lines (no pending transactions)
    let combined = journalLines.map(jl => {
      const entryType = jl.entry_type || 'adjustment';

      return {
        ...jl,
        id: jl.line_id,
        activityType: 'posted',
        displayDate: jl.entry_date,
        displayDescription: jl.line_description || jl.entry_description,
        debitAmount: jl.debit_amount,
        creditAmount: jl.credit_amount,
        entryNumber: jl.entry_number,
        journalEntryId: jl.entry_id,
        transactionId: jl.transaction_id,
        entryType,
        account_name: jl.offsetting_accounts,
        category: jl.account_name,
        contact: jl.contact_name,
        offsettingAccounts: jl.offsetting_accounts,
        runningBalance: parseFloat(jl.running_balance || 0)
      };
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      combined = combined.filter(item =>
        item.displayDescription?.toLowerCase().includes(query) ||
        item.entryNumber?.toLowerCase().includes(query) ||
        item.offsettingAccounts?.toLowerCase().includes(query)
      );
    }

    if (filters.entryType !== 'all') {
      combined = combined.filter(item => item.entryType === filters.entryType);
    }

    if (filters.minAmount) {
      const minAmt = parseFloat(filters.minAmount);
      combined = combined.filter(item => {
        const amount = Math.abs(parseFloat(item.debitAmount || item.creditAmount || 0));
        return amount >= minAmt;
      });
    }

    if (filters.maxAmount) {
      const maxAmt = parseFloat(filters.maxAmount);
      combined = combined.filter(item => {
        const amount = Math.abs(parseFloat(item.debitAmount || item.creditAmount || 0));
        return amount <= maxAmt;
      });
    }

    if (filters.contact) {
      const contactQuery = filters.contact.toLowerCase();
      combined = combined.filter(item =>
        item.offsettingAccounts?.toLowerCase().includes(contactQuery) ||
        item.contact_name?.toLowerCase().includes(contactQuery)
      );
    }

    combined.sort((a, b) => {
      const dateA = new Date(a.displayDate);
      const dateB = new Date(b.displayDate);
      const dateDiff = dateB - dateA; // Reversed: newest first

      // If dates are the same, ensure opening balance entries come last (when showing newest first)
      if (dateDiff === 0) {
        if (a.entryType === 'opening_balance' && b.entryType !== 'opening_balance') return 1;
        if (a.entryType !== 'opening_balance' && b.entryType === 'opening_balance') return -1;
      }

      return dateDiff;
    });

    // Use natural accounting presentation:
    // - For expenses: debits = expenses (money out), credits = refunds (money in)
    // - For assets: debits = increases (money in), credits = decreases (money out)
    // - For liabilities/credit cards: debits = payments, credits = purchases
    // - For equity: credits = increases (positive), debits = decreases (negative) — same flip as expense
    const flipDebitsCredits = accountClass === 'expense' || accountClass === 'equity';

    // The DB already computes running_balance as a cumulative window function over
    // ALL rows for this account. Use it directly — never re-accumulate in the frontend,
    // as that breaks on any page > 1 and gives wrong values when rows are paginated.
    const activitiesWithBalance = combined.map(activity => ({
      ...activity,
      calculatedDebit: flipDebitsCredits ? activity.creditAmount || 0 : activity.debitAmount || 0,
      calculatedCredit: flipDebitsCredits ? activity.debitAmount || 0 : activity.creditAmount || 0
    }));

    // Beginning balance: balance of the oldest visible row minus its own net change
    let beginningBal = null;
    if (dateRange.start && activitiesWithBalance.length > 0) {
      const oldestActivity = activitiesWithBalance[activitiesWithBalance.length - 1];
      const oldestDebit = oldestActivity.debitAmount || 0;
      const oldestCredit = oldestActivity.creditAmount || 0;
      const oldestChange = isDebitNormal ? (oldestDebit - oldestCredit) : (oldestCredit - oldestDebit);
      beginningBal = parseFloat(oldestActivity.runningBalance || 0) - oldestChange;
    }

    const endingBal = activitiesWithBalance.length > 0
      ? activitiesWithBalance[0].runningBalance
      : 0;

    const totalDebits = activitiesWithBalance.reduce((sum, a) => sum + (a.calculatedDebit || 0), 0);
    const totalCredits = activitiesWithBalance.reduce((sum, a) => sum + (a.calculatedCredit || 0), 0);
    const netChange = totalDebits - totalCredits;

    const analyticsData = {
      transactionCount: combined.length,
      totalDebits,
      totalCredits,
      netChange,
      avgTransaction: combined.length > 0 ? Math.abs(totalDebits + totalCredits) / combined.length : 0,
      firstTransaction: combined.length > 0 ? combined[combined.length - 1].displayDate : null,
      lastTransaction: combined.length > 0 ? combined[0].displayDate : null
    };

    return {
      allActivity: activitiesWithBalance,
      analytics: analyticsData,
      beginningBalance: dateRange.start ? beginningBal : null,
      endingBalance: endingBal
    };
  }, [journalLines, account, searchQuery, dateRange, filters]);

  const { allAuditActivity, auditAnalytics } = useMemo(() => {
    if (activeTab !== 'audit' && budgetLedgerTab !== 'audit') return { allAuditActivity: [], auditAnalytics: {} };

    const accountClass = account?.account_class || account?.class || 'asset';
    const isDebitNormal = accountClass === 'asset' || accountClass === 'expense';

    let combined = auditHistoryLines.map(jl => {
      // For transfers and credit card payments, show special labels
      // For regular transactions, show contact name
      const entryType = jl.entry_type || 'adjustment';
      let fromToDisplay = '';

      if (entryType === 'transfer') {
        fromToDisplay = jl.offsetting_accounts || 'Transfer';
      } else if (entryType === 'credit_card_payment') {
        fromToDisplay = 'Credit Card Payment';
      } else if (jl.contact_name) {
        fromToDisplay = jl.contact_name;
      }

      return {
        ...jl,
        id: jl.line_id,
        activityType: 'posted',
        displayDate: jl.transaction_date || jl.entry_date,
        displayDescription: jl.line_description || jl.entry_description,
        debitAmount: jl.debit_amount,
        creditAmount: jl.credit_amount,
        entryNumber: jl.entry_number,
        journalEntryId: jl.entry_id,
        transactionId: jl.transaction_id,
        entryType,
        offsettingAccounts: fromToDisplay,
        runningBalance: parseFloat(jl.running_balance || 0),
        createdAt: jl.created_at,
        actorName: jl.actor_display_name || null,
      };
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      combined = combined.filter(item =>
        item.displayDescription?.toLowerCase().includes(query) ||
        item.entryNumber?.toLowerCase().includes(query) ||
        item.offsettingAccounts?.toLowerCase().includes(query)
      );
    }

    combined.sort((a, b) => {
      const dateA = new Date(a.displayDate);
      const dateB = new Date(b.displayDate);
      return dateB - dateA;
    });

    // Use natural accounting presentation for audit history
    const flipDebitsCredits = accountClass === 'expense' || accountClass === 'equity';

    // The DB already computes running_balance as a cumulative window function over
    // ALL rows (undo rows have bl_net_change=0 so they don't move the balance).
    // Use the DB value directly — never re-accumulate in the frontend.
    const activitiesWithBalance = combined.map(activity => ({
      ...activity,
      calculatedDebit: flipDebitsCredits ? activity.creditAmount || 0 : activity.debitAmount || 0,
      calculatedCredit: flipDebitsCredits ? activity.debitAmount || 0 : activity.creditAmount || 0
    }));

    const totalDebits = activitiesWithBalance.reduce((sum, a) => sum + (a.calculatedDebit || 0), 0);
    const totalCredits = activitiesWithBalance.reduce((sum, a) => sum + (a.calculatedCredit || 0), 0);

    const analyticsData = {
      transactionCount: combined.length,
      totalDebits,
      totalCredits
    };

    return {
      allAuditActivity: activitiesWithBalance,
      auditAnalytics: analyticsData
    };
  }, [auditHistoryLines, account, searchQuery, activeTab, budgetLedgerTab]);

  // Pagination handlers
  const goToNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const goToNextAuditPage = () => {
    if (hasNextAuditPage) {
      setCurrentAuditPage(prev => prev + 1);
    }
  };

  const goToPreviousAuditPage = () => {
    if (hasPreviousAuditPage) {
      setCurrentAuditPage(prev => prev - 1);
    }
  };

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(0);
  }, [datePreset, id, searchQuery, filters]);

  React.useEffect(() => {
    setCurrentAuditPage(0);
  }, [datePreset, id]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.entryType !== 'all') count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    if (filters.contact) count++;
    return count;
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      entryType: 'all',
      minAmount: '',
      maxAmount: '',
      contact: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const data = {
      display_name: editName,
      class: editClass,
      account_type: editAccountType,
      account_detail: editAccountDetail || null,
      is_active: editIsActive
    };

    // For bank accounts (asset/liability with bank-related account_detail)
    if (isBankAccount) {
      data.institution_name = formData.get('institution_name') || undefined;
      // Note: current_balance is managed by journal entry triggers, not manually edited
    } else {
      // For income/expense categories
      data.icon = formData.get('icon') || undefined;
      data.color = formData.get('color') || undefined;
    }

    updateMutation.mutate({ id: account.id, data });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      deleteMutation.mutate({ id: account.id });
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Date', 'Description', 'Reference', 'From/To', 'Amount', 'Balance'].join(','),
      ...allActivity.map(activity => {
        const amount = (activity.calculatedDebit || 0) - (activity.calculatedCredit || 0);
        return [
          format(new Date(activity.displayDate), 'yyyy-MM-dd'),
          `"${activity.displayDescription}"`,
          activity.entryNumber || '',
          `"${activity.offsettingAccounts || ''}"`,
          amount,
          activity.runningBalance
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `account-register-${account.account_number || account.id}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Register exported to CSV');
  };

  const handlePrint = () => {
    window.print();
    toast.info('Opening print dialog...');
  };

  const handleImport = () => {
    setShowImportDialog(true);
    setImportStep('upload');
    setUploadedFile(null);
    setProcessedData(null);
    setMappedTransactions([]);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    setUploadedFile(file);
    try {
      const data = await processStatementFile(file);

      setProcessedData(data);

      if (data.type === 'transactions') {
        await handleOfxImport(data);
      } else {
        setImportStep('mapping');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to process file');
      setUploadedFile(null);
    }
  };

  const handleOfxImport = async (data) => {
    const { transactions, beginningBalance, endingBalance } = data;

    if (!transactions || transactions.length === 0) {
      toast.error('No transactions found in file');
      setUploadedFile(null);
      return;
    }

    setIsImporting(true);
    try {
      // Create opening balance journal entry if this is the first import
      if (beginningBalance !== null && beginningBalance !== undefined && totalJournalLines === 0) {
        const earliestDate = transactions.reduce((earliest, txn) => {
          const txnDate = new Date(txn.date);
          return !earliest || txnDate < earliest ? txnDate : earliest;
        }, null);

        if (earliestDate) {
          const openingDate = new Date(earliestDate);
          openingDate.setDate(openingDate.getDate() - 1);

          try {
            await createOpeningBalanceJournalEntry({
              profileId: activeProfile.id,
              userId: user.id,
              accountId: account.id,
              openingBalance: beginningBalance,
              openingDate: openingDate.toISOString().split('T')[0],
              accountName: account.display_name || account.account_name,
              accountClass: account.account_class
            });
          } catch (error) {
            toast.error('Failed to create opening balance journal entry');
            setIsImporting(false);
            return;
          }
        }
      }

      const { duplicates, uniqueTransactions } = await detectDuplicateTransactions(
        account.id,
        transactions
      );

      const allTransactions = uniqueTransactions
        .filter(txn => txn.description && !txn.description.toLowerCase().includes('beginning balance'))
        .map(txn => ({
          profile_id: activeProfile.id,
          user_id: user.id,
          bank_account_id: account.id,
          status: 'pending',
          date: txn.date,
          description: txn.description,
          original_description: txn.original_description,
          amount: txn.type === 'expense' ? -Math.abs(txn.amount) : Math.abs(txn.amount),
          type: txn.type
        }));

      if (allTransactions.length > 0) {
        const { error } = await firstsavvy
          .from('transactions')
          .insert(allTransactions);

        if (error) throw error;
      }

      if (endingBalance !== null && endingBalance !== undefined) {
        const { error: bankBalanceError } = await firstsavvy
          .from('user_chart_of_accounts')
          .update({
            bank_balance: endingBalance,
            last_synced_at: new Date().toISOString()
          })
          .eq('id', account.id);

        if (bankBalanceError) {
        }
      }

      await autoMatchTransfers(allTransactions);

      queryClient.invalidateQueries({ queryKey: ['account-activity', id] });
      queryClient.invalidateQueries({ queryKey: ['account', id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      const balanceMsg = beginningBalance !== null && beginningBalance !== undefined ? ` Beginning balance set to ${formatCurrency(beginningBalance)}.` : '';
      const endingBalanceMsg = endingBalance !== null && endingBalance !== undefined ? ` Bank balance set to ${formatCurrency(endingBalance)}.` : '';
      const duplicateMsg = duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : '';
      toast.success(`Successfully imported ${allTransactions.length} transactions${duplicateMsg}.${balanceMsg}${endingBalanceMsg}`);

      setShowImportDialog(false);
      setUploadedFile(null);
      setProcessedData(null);
      setMappedTransactions([]);
      setImportStep('upload');
    } catch (error) {
      toast.error(error.message || 'Failed to import transactions');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCsvMapping = async (mappingConfig) => {
    const { columnMappings, dateFormat, amountType, debitColumn, creditColumn, beginningBalance, endingBalance } = mappingConfig;

    const accountClass = account.account_class || account.class || 'asset';

    const transactions = mapCsvToTransactions(
      processedData,
      columnMappings,
      amountType,
      debitColumn,
      creditColumn,
      accountClass
    );

    setMappedTransactions(transactions);

    if (transactions.length === 0) {
      toast.error('No transactions to import');
      setIsImporting(false);
      return;
    }

    setIsImporting(true);
    try {
      // Create opening balance journal entry if this is the first import
      if (beginningBalance !== null && beginningBalance !== undefined && totalJournalLines === 0) {
        const earliestDate = transactions.reduce((earliest, txn) => {
          const txnDate = new Date(txn.date);
          return !earliest || txnDate < earliest ? txnDate : earliest;
        }, null);

        if (earliestDate) {
          const openingDate = new Date(earliestDate);
          openingDate.setDate(openingDate.getDate() - 1);

          try {
            await createOpeningBalanceJournalEntry({
              profileId: activeProfile.id,
              userId: user.id,
              accountId: account.id,
              openingBalance: beginningBalance,
              openingDate: openingDate.toISOString().split('T')[0],
              accountName: account.display_name || account.account_name,
              accountClass: account.account_class
            });
          } catch (error) {
            toast.error('Failed to create opening balance journal entry');
            setIsImporting(false);
            return;
          }
        }
      }

      const { duplicates, uniqueTransactions } = await detectDuplicateTransactions(
        account.id,
        transactions
      );

      const allTransactions = uniqueTransactions
        .filter(txn => txn.description && !txn.description.toLowerCase().includes('beginning balance'))
        .map(txn => ({
          profile_id: activeProfile.id,
          user_id: user.id,
          bank_account_id: account.id,
          status: 'pending',
          date: txn.date,
          description: txn.description,
          original_description: txn.original_description,
          amount: txn.type === 'expense' ? -Math.abs(txn.amount) : Math.abs(txn.amount),
          type: txn.type
        }));

      if (allTransactions.length > 0) {
        const { error } = await firstsavvy
          .from('transactions')
          .insert(allTransactions);

        if (error) throw error;
      }

      if (endingBalance !== null && endingBalance !== undefined) {
        const { error: bankBalanceError } = await firstsavvy
          .from('user_chart_of_accounts')
          .update({
            bank_balance: endingBalance,
            last_synced_at: new Date().toISOString()
          })
          .eq('id', account.id);

        if (bankBalanceError) {
        }
      }

      await autoMatchTransfers(allTransactions);

      queryClient.invalidateQueries({ queryKey: ['account-activity', id] });
      queryClient.invalidateQueries({ queryKey: ['account', id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      const balanceMsg = beginningBalance !== null && beginningBalance !== undefined ? ` Beginning balance set to ${formatCurrency(beginningBalance)}.` : '';
      const endingBalanceMsg = endingBalance !== null && endingBalance !== undefined ? ` Bank balance set to ${formatCurrency(endingBalance)}.` : '';
      const duplicateMsg = duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : '';
      toast.success(`Successfully imported ${allTransactions.length} transactions${duplicateMsg}.${balanceMsg}${endingBalanceMsg}`);

      setShowImportDialog(false);
      setUploadedFile(null);
      setProcessedData(null);
      setMappedTransactions([]);
      setImportStep('upload');
    } catch (error) {
      toast.error(error.message || 'Failed to import transactions');
    } finally {
      setIsImporting(false);
    }
  };

  if (accountLoading) {
    return (
      <div className="p-8">
        <div className="mx-auto">
          <div className="text-center text-slate-500">Loading account...</div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8">
        <div className="mx-auto">
          <div className="text-center text-slate-500">Account not found</div>
          <div className="text-center mt-4">
            <Button onClick={() => navigate(-1)} variant="outline">
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Initialize edit mode state when entering edit mode
  const initializeEditMode = () => {
    setEditName(account.display_name || account.name || '');
    setEditClass(account.class || '');
    setEditAccountType(account.account_type || '');
    setEditAccountDetail(account.account_detail || '');
    setEditIsActive(account.is_active !== false);
    setIsEditMode(true);
  };

  return (
    <div className="p-3 md:p-4">
      <div className="mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-1.5 h-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
            {isBudgetableAccount && !isEditMode && isBudgetEditMode && (
              <div className="flex items-center gap-2 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsBudgetEditMode(false)}
                  className="gap-1.5 h-8"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsBudgetEditMode(false)}
                  className="gap-1.5 h-8"
                >
                  <Save className="w-3.5 h-3.5" />
                  Done
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!isEditMode ? (
              <>
                {isBudgetableAccount && !isBudgetEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBudgetEditMode(true)}
                    className="gap-1.5 h-8 px-2.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Budget
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImport}
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelEditMode}
                className="gap-1.5 h-8 px-2.5"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        {isBudgetableAccount && !isEditMode && (
          <BudgetOverviewCard
            budget={budget}
            categoryAccount={account}
            childAccounts={childAccounts}
            childBudgets={childBudgets}
            isEditing={isBudgetEditMode}
            onEditChange={setIsBudgetEditMode}
          />
        )}

        {isBudgetableAccount && !isEditMode ? (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BudgetPerformanceCard
              budget={budget}
              currentSpending={currentMonthSpending}
              performanceHistory={performanceHistory}
              comparativeData={comparativeData}
              historicalData={historicalData}
              childAccounts={childAccounts}
              childBudgets={childBudgets}
              childSpending={childSpending}
              childAnalytics={childAnalytics}
              parentName={account?.name || account?.display_name}
              account={account}
              selectedMonth={budgetMonth}
              onMonthChange={setBudgetMonth}
            />
            <SpendingAndVendorCard historicalData={historicalData} budget={budget} vendorData={vendorData} />
          </div>

          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Account Ledger</p>
            </CardHeader>
            <CardContent className="pt-2">
              <Tabs value={budgetLedgerTab} onValueChange={setBudgetLedgerTab} className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <TabsList>
                    <TabsTrigger value="register" className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Register
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      Audit History
                    </TabsTrigger>
                  </TabsList>
                  <div className="flex items-center gap-2">
                    {!isBudgetableAccount && (
                      <DatePresetDropdown
                        value={datePreset}
                        onValueChange={setDatePreset}
                        triggerClassName="w-40 h-8 text-sm"
                      />
                    )}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        placeholder="Search transactions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64 h-8 text-sm"
                      />
                    </div>
                    <Button
                      variant={activeFilterCount > 0 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="h-8 gap-2"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </div>
                </div>

                {showFilters && (
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <div className="flex items-end gap-3 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        <Label className="text-xs mb-1.5 block">Transaction Type</Label>
                        <Select
                          value={filters.entryType}
                          onValueChange={(value) => setFilters({ ...filters, entryType: value })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="transaction">Regular Transaction</SelectItem>
                            <SelectItem value="transfer">Transfer</SelectItem>
                            <SelectItem value="credit_card_payment">Credit Card Payment</SelectItem>
                            <SelectItem value="adjustment">Adjustment</SelectItem>
                            <SelectItem value="opening_balance">Opening Balance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-xs mb-1.5 block">Min Amount</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={filters.minAmount}
                          onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                          className="h-8 text-sm"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-xs mb-1.5 block">Max Amount</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={filters.maxAmount}
                          onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                          className="h-8 text-sm"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <Label className="text-xs mb-1.5 block">Contact/Vendor</Label>
                        <Input
                          placeholder="Filter by contact..."
                          value={filters.contact}
                          onChange={(e) => setFilters({ ...filters, contact: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      {activeFilterCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="h-8"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <TabsContent value="register" className="mt-0">
                  {journalLinesLoading ? (
                    <p className="text-center text-slate-500 py-3 text-sm">Loading register...</p>
                  ) : journalLinesError ? (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-sm text-red-600">Failed to load register data</p>
                      <p className="text-xs text-slate-500">{journalLinesError.message}</p>
                    </div>
                  ) : allActivity.length === 0 ? (
                    <p className="text-center text-slate-500 py-6 text-sm">No activity found</p>
                  ) : (
                    <div ref={registerTableRef} className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className={TRANSACTION_TABLE_CONFIG.header.rowClass}>
                            {TRANSACTION_TABLE_CONFIG.columns.map((col) => (
                              <TableHead key={col.id} className={getHeaderCellClassName(col)}>
                                {col.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allActivity.map((activity, index) => (
                            <TableRow
                              key={`${activity.id || index}`}
                              className={getRowClassName(index)}
                            >
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[0])}>
                                {format(parseISO(activity.displayDate), 'MM/dd/yy')}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[1])}>
                                {activity.account_name || '\u2014'}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[2])}>
                                {editingTransactionId !== null && editingTransactionId === activity.transactionId ? (
                                  <input
                                    type="text"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className={TRANSACTION_TABLE_CONFIG.editField.inputClass}
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    onClick={() => activity.transactionId && startEditingTransaction(activity)}
                                    className={TRANSACTION_TABLE_CONFIG.editField.buttonClass}
                                    disabled={!activity.transactionId}
                                  >
                                    {activity.displayDescription}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[3])}>
                                {editingTransactionId !== null && editingTransactionId === activity.transactionId ? (
                                  <ContactDropdown
                                    value={editContactId}
                                    onChange={setEditContactId}
                                    className={TRANSACTION_TABLE_CONFIG.editField.dropdownClass}
                                    profileId={activeProfile?.id}
                                    allowClear
                                  />
                                ) : (
                                  <button
                                    onClick={() => activity.transactionId && startEditingTransaction(activity)}
                                    className={TRANSACTION_TABLE_CONFIG.editField.buttonClass}
                                    disabled={!activity.transactionId}
                                  >
                                    {activity.contact || '\u2014'}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[4])}>
                                {editingTransactionId !== null && editingTransactionId === activity.transactionId ? (
                                  <CategoryDropdown
                                    value={editCategoryId}
                                    onChange={setEditCategoryId}
                                    className={TRANSACTION_TABLE_CONFIG.editField.dropdownClass}
                                    profileId={activeProfile?.id}
                                  />
                                ) : (
                                  <button
                                    onClick={() => activity.transactionId && startEditingTransaction(activity)}
                                    className={TRANSACTION_TABLE_CONFIG.editField.buttonClass}
                                    disabled={!activity.transactionId}
                                  >
                                    {activity.category || '\u2014'}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[5])}>
                                {(() => {
                                  const amount = (activity.calculatedDebit || 0) - (activity.calculatedCredit || 0);
                                  return (
                                    <span className={amount < 0 ? 'text-red-600' : amount > 0 ? 'text-green-600' : ''}>
                                      {formatCurrency(amount)}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[6])}>
                                {activity.transactionId && activity.journalEntryId && (
                                  editingTransactionId !== null && editingTransactionId === activity.transactionId ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          cancelEditingTransaction();
                                        }}
                                        className={TRANSACTION_TABLE_CONFIG.actionButtons.cancelClass}
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          saveTransactionEdit(activity.transactionId);
                                        }}
                                        disabled={updateTransactionMutation.isPending}
                                        className={TRANSACTION_TABLE_CONFIG.actionButtons.saveClass}
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={async (e) => {
                                        e?.stopPropagation();
                                        try {
                                          const { data, error } = await firstsavvy.rpc('undo_posted_transaction', {
                                            p_transaction_id: activity.transactionId
                                          });

                                          if (error) {
                                            console.error('RPC Error:', error);
                                            toast.error(error.message || 'Failed to undo transaction');
                                            return;
                                          }

                                          if (data?.success) {
                                            toast.success('Transaction moved back to pending');
                                            queryClient.invalidateQueries(['journal-lines-paginated']);
                                            queryClient.invalidateQueries(['transactions']);
                                          } else {
                                            console.error('Function returned error:', data);
                                            toast.error(data?.error || 'Failed to undo transaction');
                                          }
                                        } catch (error) {
                                          console.error('Error undoing transaction:', error);
                                          toast.error(error.message || 'Failed to undo transaction');
                                        }
                                      }}
                                      className={TRANSACTION_TABLE_CONFIG.actionButtons.undoClass}
                                    >
                                      Undo
                                    </Button>
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {totalJournalLines > 0 && (
                        <div className="text-xs text-slate-500 text-center py-1.5 border-t flex items-center justify-between px-3">
                          <span>Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalJournalLines)} of {totalJournalLines} transactions</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={goToPreviousPage}
                              disabled={!hasPreviousPage || journalLinesLoading}
                              className="h-7 text-xs"
                            >
                              Previous
                            </Button>
                            <span className="text-xs text-slate-600">Page {currentPage + 1} of {totalPages}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={goToNextPage}
                              disabled={!hasNextPage || journalLinesLoading}
                              className="h-7 text-xs"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="mt-0">
                  {auditHistoryLoading ? (
                    <p className="text-center text-slate-500 py-3 text-sm">Loading audit history...</p>
                  ) : auditHistoryError ? (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-sm text-red-600">Failed to load audit history</p>
                      <p className="text-xs text-slate-500">{auditHistoryError.message}</p>
                    </div>
                  ) : allAuditActivity.length === 0 ? (
                    <p className="text-center text-slate-500 py-6 text-sm">No audit history found</p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="h-8 bg-slate-100">
                            <TableHead className="py-1.5 text-[11px] font-semibold">Action Time</TableHead>
                            <TableHead className="py-1.5 text-[11px] font-semibold">Date</TableHead>
                            <TableHead className="py-1.5 text-[11px] font-semibold">Reference</TableHead>
                            <TableHead className="py-1.5 text-[11px] font-semibold">Type</TableHead>
                            <TableHead className="py-1.5 text-[11px] font-semibold">Description</TableHead>
                            {childAccounts.length > 0 && (
                              <TableHead className="py-1.5 text-[11px] font-semibold">Account</TableHead>
                            )}
                            <TableHead className="py-1.5 text-[11px] font-semibold">From/To</TableHead>
                            <TableHead className="py-1.5 text-[11px] font-semibold">By</TableHead>
                            <TableHead className="text-right py-1.5 text-[11px] font-semibold">Amount</TableHead>
                            <TableHead className="text-right py-1.5 text-[11px] font-semibold">Balance</TableHead>
                            <TableHead className="w-[40px] py-1.5"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allAuditActivity.map((activity, index) => (
                            <TableRow
                              key={`${activity.id || index}`}
                              className={`h-7 ${
                                index % 2 === 0
                                  ? 'bg-white hover:bg-slate-50'
                                  : 'bg-slate-50/50 hover:bg-slate-100'
                              }`}
                            >
                              <TableCell className="py-1 text-[11px] text-slate-600 whitespace-nowrap">
                                {activity.createdAt ? format(new Date(activity.createdAt), 'MMM d, h:mm a') : '\u2014'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-[11px] py-1">
                                {format(parseISO(activity.displayDate), 'MMM d, yyyy')}
                              </TableCell>
                              <TableCell className="py-1">
                                <span
                                  className="font-mono text-[10px] text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"
                                  onClick={() => activity.journalEntryId && setSelectedJournalEntryId(activity.journalEntryId)}
                                >
                                  {activity.entryNumber}
                                </span>
                              </TableCell>
                              <TableCell className="py-1">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-5 capitalize ${activity.entryType === 'undo' ? 'border-amber-300 text-amber-700 bg-amber-50' : ''}`}
                                >
                                  {getAuditEntryTypeLabel(activity.entryType, accountClass, activity.debitAmount, activity.creditAmount)}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-1 max-w-[250px]">
                                <div className="text-[11px] truncate">
                                  {activity.displayDescription}
                                </div>
                              </TableCell>
                              {childAccounts.length > 0 && (
                                <TableCell className="text-[11px] text-slate-600 py-1">
                                  <div className="truncate max-w-[150px]">
                                    {activity.account_name || '\u2014'}
                                  </div>
                                </TableCell>
                              )}
                              <TableCell className="text-[11px] text-slate-600 py-1">
                                {activity.offsettingAccounts || '\u2014'}
                              </TableCell>
                              <TableCell className="text-[11px] py-1">
                                {activity.actorName ? (
                                  <span className="inline-flex items-center gap-1 text-slate-500">
                                    <span className="inline-flex h-4 w-4 rounded-full bg-slate-200 items-center justify-center text-[9px] font-semibold text-slate-600 flex-shrink-0">
                                      {activity.actorName.charAt(0).toUpperCase()}
                                    </span>
                                    {activity.actorName.split(' ')[0]}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">{'\u2014'}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-[11px] py-1">
                                {(() => {
                                  const amount = (activity.calculatedDebit || 0) - (activity.calculatedCredit || 0);
                                  return (
                                    <span className={amount < 0 ? 'text-red-600' : amount > 0 ? 'text-green-600' : ''}>
                                      {formatCurrency(amount)}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-right text-[11px] py-1 font-medium text-slate-700">
                                {formatCurrency(activity.runningBalance || 0)}
                              </TableCell>
                              <TableCell className="py-1">
                                <div className="flex items-center gap-1">
                                  {editingTransactionId !== null && editingTransactionId === activity.transactionId ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => saveTransactionEdit(activity.transactionId)}
                                        className="h-6 w-6 p-0"
                                        title="Save"
                                        disabled={updateTransactionMutation.isPending}
                                      >
                                        <Save className="w-3 h-3 text-green-600" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={cancelEditingTransaction}
                                        className="h-6 w-6 p-0"
                                        title="Cancel"
                                        disabled={updateTransactionMutation.isPending}
                                      >
                                        <X className="w-3 h-3 text-slate-400" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      {activity.entryType !== 'undo' && activity.journalEntryId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setSelectedJournalEntryId(activity.journalEntryId)}
                                          className="h-6 w-6 p-0"
                                          title="View Journal Entry"
                                        >
                                          <ExternalLink className="w-3 h-3 text-slate-400" />
                                        </Button>
                                      )}
                                      {activity.transactionId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setSelectedTransactionForAudit(activity.transactionId)}
                                          className="h-6 w-6 p-0"
                                          title="View Audit History"
                                        >
                                          <History className="w-3 h-3 text-slate-400" />
                                        </Button>
                                      )}
                                      {activity.entryType !== 'undo' && activity.transactionId && activity.journalEntryId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={async (e) => {
                                            e?.stopPropagation();
                                            try {
                                              const { data, error } = await firstsavvy.rpc('undo_posted_transaction', {
                                                p_transaction_id: activity.transactionId
                                              });

                                              if (error) {
                                                console.error('RPC Error:', error);
                                                toast.error(error.message || 'Failed to undo transaction');
                                                return;
                                              }

                                              if (data?.success) {
                                                toast.success('Transaction moved back to pending');
                                                queryClient.invalidateQueries(['journal-lines-paginated']);
                                                queryClient.invalidateQueries(['transactions']);
                                              } else {
                                                console.error('Function returned error:', data);
                                                toast.error(data?.error || 'Failed to undo transaction');
                                              }
                                            } catch (error) {
                                              console.error('Error undoing transaction:', error);
                                              toast.error(error.message || 'Failed to undo transaction');
                                            }
                                          }}
                                          className="h-6 w-6 p-0"
                                          title="Undo Transaction"
                                        >
                                          <Undo className="w-3 h-3 text-slate-400" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {totalAuditLines > 0 && (
                        <div className="text-xs text-slate-500 text-center py-1.5 border-t flex items-center justify-between px-3">
                          <span>Showing {currentAuditPage * PAGE_SIZE + 1}-{Math.min((currentAuditPage + 1) * PAGE_SIZE, totalAuditLines)} of {totalAuditLines} entries</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={goToPreviousAuditPage}
                              disabled={!hasPreviousAuditPage || auditHistoryLoading}
                              className="h-7 text-xs"
                            >
                              Previous
                            </Button>
                            <span className="text-xs text-slate-600">Page {currentAuditPage + 1} of {totalAuditPages}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={goToNextAuditPage}
                              disabled={!hasNextAuditPage || auditHistoryLoading}
                              className="h-7 text-xs"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          </>
        ) : (
          <Card>
            <CardHeader className="pb-3 pt-4">
              {isEditMode ? (
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  {/* Line 1: Name, Account Number, Active Badge */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Input
                      name="name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Account name"
                      className="h-9 flex-1 min-w-[200px] max-w-[400px] font-semibold text-base"
                    />
                    {account.account_number && (
                      <span className="text-sm text-slate-500 font-mono">
                        ({account.account_number})
                      </span>
                    )}
                    <Badge
                      variant={editIsActive ? "default" : "secondary"}
                      className="cursor-pointer select-none"
                      onClick={() => setEditIsActive(!editIsActive)}
                    >
                      {editIsActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Line 2: Class, Account Type, Account Detail */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[150px] max-w-[200px]">
                      <Select value={editClass} onValueChange={setEditClass}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Class" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asset">Asset</SelectItem>
                          <SelectItem value="liability">Liability</SelectItem>
                          <SelectItem value="equity">Equity</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[150px] max-w-[200px]">
                      <Select
                        value={editAccountType}
                        onValueChange={(value) => {
                          setEditAccountType(value);
                          setEditAccountDetail('');
                        }}
                        disabled={!editClass || accountTypes.length === 0}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Account Type" />
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
                    {accountDetails.length > 0 && (
                      <div className="flex-1 min-w-[150px] max-w-[200px]">
                        <Select
                          value={editAccountDetail}
                          onValueChange={setEditAccountDetail}
                          disabled={!editAccountType}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Account Detail" />
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
                </div>
                <div className="text-right ml-6">
                  <TooltipProvider>
                    <div className="space-y-1">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500">Bank Balance</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`text-lg font-semibold cursor-help ${
                              account.entityType === 'Asset' ? 'text-forest-green' :
                              account.entityType === 'Liability' ? 'text-burgundy' :
                              'text-slate-900'
                            }`}>
                              {account.bank_balance !== null && account.bank_balance !== undefined
                                ? formatCurrency(account.bank_balance)
                                : 'Not synced'}
                            </span>
                          </TooltipTrigger>
                          {account.last_synced_at && (
                            <TooltipContent>
                              <p className="text-xs">Last synced: {format(new Date(account.last_synced_at), 'MMM d, yyyy h:mm a')}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500">Savvy Balance</span>
                        <span className={`text-lg font-semibold ${
                          account.entityType === 'Asset' || account.entityType === 'Income' ? 'text-forest-green' :
                          account.entityType === 'Liability' || account.entityType === 'Expense' ? 'text-burgundy' :
                          'text-slate-900'
                        }`}>
                          {formatCurrency(endingBalance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1 border-t">
                        <span className="text-xs text-slate-500">Difference</span>
                        <span className={`text-base font-bold ${
                          account.bank_balance !== null && account.bank_balance !== undefined
                            ? ((account.bank_balance - endingBalance) >= 0 ? 'text-forest-green' : 'text-burgundy')
                            : 'text-slate-400'
                        }`}>
                          {account.bank_balance !== null && account.bank_balance !== undefined
                            ? formatCurrency(account.bank_balance - endingBalance)
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </TooltipProvider>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  {/* Line 1: Name, Account Number */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-lg font-semibold">
                      {isBudgetableAccount && budget?.custom_name
                        ? budget.custom_name
                        : (account.display_name || account.name)}
                    </h1>
                    {account.account_number && (
                      <span className="text-sm text-slate-500 font-mono">
                        ({account.account_number})
                      </span>
                    )}
                    {isBudgetableAccount && budget && (
                      <Badge variant={budget.is_active ? 'default' : 'secondary'}>
                        {budget.is_active ? 'Budget Active' : 'Budget Inactive'}
                      </Badge>
                    )}
                  </div>

                </div>
                {(account.entityType === 'Asset' || account.entityType === 'Liability' || account.entityType === 'Equity') && (
                  <div className="text-right">
                    <TooltipProvider>
                      <div className="space-y-1">
                        {account.entityType === 'Equity' ? (
                          <>
                            {!isOpeningBalanceEquity && beginningBalance !== null && (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-slate-500">Beginning Balance</span>
                                <span className="text-base font-medium text-slate-700">
                                  {formatCurrency(beginningBalance)}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-500">
                                {isOpeningBalanceEquity ? 'Total Opening Balances' : 'Current Balance'}
                              </span>
                              <span className="text-2xl font-bold text-blue-600">
                                {formatCurrency(endingBalance)}
                              </span>
                            </div>
                            {!isOpeningBalanceEquity && beginningBalance !== null && (
                              <div className="flex items-center justify-end gap-2 pt-1 border-t">
                                <span className="text-xs text-slate-500">Net Change</span>
                                <span className={`text-base font-semibold ${
                                  (endingBalance - beginningBalance) >= 0 ? 'text-forest-green' : 'text-burgundy'
                                }`}>
                                  {formatCurrency(endingBalance - beginningBalance)}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-500">Bank Balance</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`text-lg font-semibold cursor-help ${
                                    account.entityType === 'Asset' ? 'text-forest-green' :
                                    account.entityType === 'Liability' ? 'text-burgundy' :
                                    'text-slate-900'
                                  }`}>
                                    {account.bank_balance !== null && account.bank_balance !== undefined
                                      ? formatCurrency(account.bank_balance)
                                      : 'Not synced'}
                                  </span>
                                </TooltipTrigger>
                                {account.last_synced_at && (
                                  <TooltipContent>
                                    <p className="text-xs">Last synced: {format(new Date(account.last_synced_at), 'MMM d, yyyy h:mm a')}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-500">Savvy Balance</span>
                              <span className={`text-lg font-semibold ${
                                account.entityType === 'Asset' || account.entityType === 'Income' ? 'text-forest-green' :
                                account.entityType === 'Liability' || account.entityType === 'Expense' ? 'text-burgundy' :
                                'text-slate-900'
                              }`}>
                                {formatCurrency(endingBalance)}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-1 border-t">
                              <span className="text-xs text-slate-500">Difference</span>
                              <span className={`text-base font-bold ${
                                account.bank_balance !== null && account.bank_balance !== undefined
                                  ? ((account.bank_balance - endingBalance) >= 0 ? 'text-forest-green' : 'text-burgundy')
                                  : 'text-slate-400'
                              }`}>
                                {account.bank_balance !== null && account.bank_balance !== undefined
                                  ? formatCurrency(account.bank_balance - endingBalance)
                                  : '—'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {isBankAccount ? (
                  <Input
                    id="institution_name"
                    name="institution_name"
                    defaultValue={account.institution_name || account.institution}
                    placeholder="e.g., Chase, Wells Fargo"
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <IconPicker name="icon" defaultValue={account.icon} />
                    <ColorPicker name="color" defaultValue={account.color} />
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button type="submit" className="gap-2 bg-primary hover:bg-primary/90">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isBankAccount ? (
                    <>
                      {(account.bank_name || account.institution || account.institution_name) && (
                        <div>
                          <p className="text-sm">{account.bank_name || account.institution || account.institution_name}</p>
                        </div>
                      )}
                    </>
                  ) : account.entityType === 'Asset' ? (
                    <>
                      {account.detail_type === 'vehicle' && account.vehicle_make && (
                        <div className="flex items-start gap-2.5">
                          <Car className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-slate-500">Make & Model</p>
                            <p className="text-sm">{account.vehicle_year} {account.vehicle_make} {account.vehicle_model}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : account.entityType === 'Liability' ? (
                    <>
                      {(account.institution || account.institution_name) && (
                        <div className="flex items-start gap-2.5">
                          <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-slate-500">Lender</p>
                            <p className="text-sm">{account.institution || account.institution_name}</p>
                          </div>
                        </div>
                      )}
                      {account.interest_rate && (
                        <div className="flex items-start gap-2.5">
                          <Hash className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-slate-500">Interest Rate</p>
                            <p className="text-sm">{account.interest_rate}%</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : account.entityType === 'Equity' ? (
                    <>
                      {!isOpeningBalanceEquity && (
                        <>
                          {totalJournalLines > 0 && (
                            <div className="flex items-start gap-2.5">
                              <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-slate-500">Total Entries</p>
                                <p className="text-sm">{totalJournalLines.toLocaleString()} journal entries</p>
                              </div>
                            </div>
                          )}
                          {analytics.totalDebits > 0 && (
                            <div className="flex items-start gap-2.5">
                              <TrendingUp className="w-4 h-4 text-forest-green mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-slate-500">Total Increases</p>
                                <p className="text-sm font-semibold text-forest-green">{formatCurrency(analytics.totalDebits)}</p>
                              </div>
                            </div>
                          )}
                          {analytics.totalCredits > 0 && (
                            <div className="flex items-start gap-2.5">
                              <TrendingDown className="w-4 h-4 text-burgundy mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-slate-500">Total Decreases</p>
                                <p className="text-sm font-semibold text-burgundy">{formatCurrency(analytics.totalCredits)}</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2.5">
                        <Hash className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-slate-500">Type</p>
                          <p className="text-sm capitalize">{account.type}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {(account.entityType === 'Asset' || account.entityType === 'Liability') && linkedAccounts.length > 0 && (
          <Card>
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-slate-600" />
                <h2 className="text-base font-semibold">
                  {account.entityType === 'Asset' ? 'Linked Liabilities' : 'Linked Assets'}
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {linkedAccounts.map((linkedAccount) => (
                  <div
                    key={linkedAccount.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/account/${linkedAccount.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {linkedAccount.entityType === 'Asset' ? (
                          <Car className="w-4 h-4 text-primary" />
                        ) : (
                          <CreditCardIcon className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{linkedAccount.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-xs capitalize h-4">
                            {linkedAccount.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-semibold ${linkedAccount.entityType === 'Liability' ? 'text-burgundy' : 'text-forest-green'}`}>
                        {formatCurrency(linkedAccount.current_balance || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!isBudgetableAccount && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    {isOpeningBalanceEquity
                      ? 'Opening Balance Entries'
                      : (isTransactionBasedAccount ? 'Account Register' : 'General Ledger Activity')}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {!isOpeningBalanceEquity && (
                    <DatePresetDropdown
                      value={datePreset}
                      onValueChange={setDatePreset}
                      triggerClassName="w-40 h-8"
                    />
                  )}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-52 h-8 text-sm"
                    />
                  </div>
                  <Button
                    variant={activeFilterCount > 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="h-8 gap-2"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>

              {showFilters && (
                <div className="border-b bg-slate-50 px-4 py-3 -mx-6 -mt-3 mb-3">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <Label className="text-xs mb-1.5 block">Transaction Type</Label>
                      <Select
                        value={filters.entryType}
                        onValueChange={(value) => setFilters({ ...filters, entryType: value })}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="transaction">Regular Transaction</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                          <SelectItem value="credit_card_payment">Credit Card Payment</SelectItem>
                          <SelectItem value="adjustment">Adjustment</SelectItem>
                          <SelectItem value="opening_balance">Opening Balance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <Label className="text-xs mb-1.5 block">Min Amount</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={filters.minAmount}
                        onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                        className="h-8 text-sm"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <Label className="text-xs mb-1.5 block">Max Amount</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={filters.maxAmount}
                        onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                        className="h-8 text-sm"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <Label className="text-xs mb-1.5 block">Contact/Vendor</Label>
                      <Input
                        placeholder="Filter by contact..."
                        value={filters.contact}
                        onChange={(e) => setFilters({ ...filters, contact: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
          <CardContent>
            {isOpeningBalanceEquity ? (
              <div className="mt-0">
                {journalLinesLoading ? (
                  <p className="text-center text-slate-500 py-3 text-sm">Loading entries...</p>
                ) : journalLinesError ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm text-red-600">Failed to load entries</p>
                    <p className="text-xs text-slate-500">{journalLinesError.message}</p>
                  </div>
                ) : allActivity.length === 0 ? (
                  <p className="text-center text-slate-500 py-6 text-sm">No opening balance entries found</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="h-8 bg-slate-100">
                          <TableHead className="py-1.5 text-[11px] font-semibold">Date</TableHead>
                          <TableHead className="py-1.5 text-[11px] font-semibold">Reference</TableHead>
                          <TableHead className="py-1.5 text-[11px] font-semibold">Description</TableHead>
                          <TableHead className="py-1.5 text-[11px] font-semibold">From/To</TableHead>
                          <TableHead className="text-right py-1.5 text-[11px] font-semibold">Amount</TableHead>
                          <TableHead className="text-right py-1.5 text-[11px] font-semibold">Balance</TableHead>
                          <TableHead className="w-[40px] py-1.5"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allActivity.map((activity, index) => {
                          const amount = (activity.calculatedDebit || 0) - (activity.calculatedCredit || 0);
                          return (
                            <TableRow
                              key={`${activity.id || index}`}
                              className={`h-7 ${
                                index % 2 === 0
                                  ? 'bg-white hover:bg-slate-50'
                                  : 'bg-slate-50/50 hover:bg-slate-100'
                              }`}
                            >
                              <TableCell className="whitespace-nowrap text-[11px] py-1">
                                {format(parseISO(activity.displayDate), 'MMM d, yyyy')}
                              </TableCell>
                              <TableCell className="py-1">
                                <span
                                  className="font-mono text-[10px] text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"
                                  onClick={() => activity.journalEntryId && setSelectedJournalEntryId(activity.journalEntryId)}
                                >
                                  {activity.entryNumber}
                                </span>
                              </TableCell>
                              <TableCell className="py-1 max-w-[300px]">
                                <div className="text-[11px] truncate">{activity.displayDescription}</div>
                              </TableCell>
                              <TableCell className="text-[11px] text-slate-600 py-1">
                                {activity.offsettingAccounts || '—'}
                              </TableCell>
                              <TableCell className={`text-right text-[11px] py-1 font-medium ${
                                amount > 0 ? 'text-forest-green' : amount < 0 ? 'text-burgundy' : ''
                              }`}>
                                {amount !== 0 ? formatCurrency(amount) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-[11px] py-1">
                              {formatCurrency(activity.runningBalance)}
                            </TableCell>
                            <TableCell className="py-1">
                              <div className="flex items-center gap-1">
                                {activity.journalEntryId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedJournalEntryId(activity.journalEntryId)}
                                    className="h-6 w-6 p-0"
                                    title="View Journal Entry"
                                  >
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {totalJournalLines > 0 && (
                      <div className="text-xs text-slate-500 text-center py-1.5 border-t flex items-center justify-between px-3">
                        <span>Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalJournalLines)} of {totalJournalLines} entries</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToPreviousPage}
                            disabled={!hasPreviousPage || journalLinesLoading}
                            className="h-7 text-xs"
                          >
                            Previous
                          </Button>
                          <span className="text-xs text-slate-600">Page {currentPage + 1} of {totalPages}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToNextPage}
                            disabled={!hasNextPage || journalLinesLoading}
                            className="h-7 text-xs"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start mb-3">
                  <TabsTrigger value="register" className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Register
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Audit History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="register" className="mt-0">
                  {journalLinesLoading ? (
                    <p className="text-center text-slate-500 py-3 text-sm">Loading register...</p>
                  ) : journalLinesError ? (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-sm text-red-600">Failed to load register data</p>
                      <p className="text-xs text-slate-500">{journalLinesError.message}</p>
                    </div>
                  ) : allActivity.length === 0 ? (
                    <p className="text-center text-slate-500 py-6 text-sm">No activity found</p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="h-8 bg-slate-100">
                            <TableHead className="py-1.5 text-[11px] font-semibold">Date</TableHead>
                            <TableHead className="py-1.5 text-[11px] font-semibold">Reference</TableHead>
                            <TableHead className="py-1.5 text-[11px] font-semibold">Description</TableHead>
                            <TableHead className="py-1.5 text-[11px] font-semibold">Category</TableHead>
                            <TableHead className="py-1.5 text-[11px] font-semibold">Contact</TableHead>
                            <TableHead className="text-right py-1.5 text-[11px] font-semibold">Amount</TableHead>
                            <TableHead className="text-right py-1.5 text-[11px] font-semibold">Balance</TableHead>
                            <TableHead className="w-[40px] py-1.5"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allActivity.map((activity, index) => (
                            <TableRow
                              key={`${activity.id || index}`}
                              className={`h-7 ${
                                index % 2 === 0
                                  ? 'bg-white hover:bg-slate-50'
                                  : 'bg-slate-50/50 hover:bg-slate-100'
                              }`}
                            >
                              <TableCell className="whitespace-nowrap text-[11px] py-1">
                                {format(parseISO(activity.displayDate), 'MMM d, yyyy')}
                              </TableCell>
                              <TableCell className="whitespace-nowrap py-1">
                                <span
                                  className="font-mono text-[10px] text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"
                                  onClick={() => activity.journalEntryId && setSelectedJournalEntryId(activity.journalEntryId)}
                                >
                                  {activity.entryNumber}
                                </span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap py-1 max-w-[300px]">
                                {editingTransactionId !== null && editingTransactionId === activity.transactionId ? (
                                  <Input
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="h-6 text-[11px] px-1.5 py-0.5"
                                  />
                                ) : (
                                  <div className="text-[11px] truncate">{activity.displayDescription}</div>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-[11px] text-slate-600 py-1">
                                {editingTransactionId !== null && editingTransactionId === activity.transactionId ? (
                                  <CategoryDropdown
                                    value={editCategoryId}
                                    onChange={setEditCategoryId}
                                    className="h-6 text-[11px]"
                                    profileId={activeProfile?.id}
                                  />
                                ) : (
                                  <button
                                    onClick={() => activity.transactionId && startEditingTransaction(activity)}
                                    className="text-left hover:bg-slate-100 px-1 py-0.5 rounded transition-colors w-full"
                                    disabled={!activity.transactionId}
                                  >
                                    {activity.category || '\u2014'}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-[11px] text-slate-600 py-1">
                                {editingTransactionId !== null && editingTransactionId === activity.transactionId ? (
                                  <ContactDropdown
                                    value={editContactId}
                                    onChange={setEditContactId}
                                    className="h-6 text-[11px]"
                                    profileId={activeProfile?.id}
                                    allowClear
                                  />
                                ) : (
                                  <button
                                    onClick={() => activity.transactionId && startEditingTransaction(activity)}
                                    className="text-left hover:bg-slate-100 px-1 py-0.5 rounded transition-colors w-full"
                                    disabled={!activity.transactionId}
                                  >
                                    {activity.contact || '\u2014'}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right text-[11px] py-1">
                                {(() => {
                                  const amount = (activity.calculatedDebit || 0) - (activity.calculatedCredit || 0);
                                  return (
                                    <span className={amount < 0 ? 'text-red-600' : amount > 0 ? 'text-green-600' : ''}>
                                      {formatCurrency(amount)}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right font-semibold text-[11px] py-1">
                                {formatCurrency(activity.runningBalance)}
                              </TableCell>
                              <TableCell className="py-1">
                                <div className="flex items-center gap-1">
                                  {editingTransactionId !== null && editingTransactionId === activity.transactionId ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => saveTransactionEdit(activity.transactionId)}
                                        className="h-6 w-6 p-0"
                                        title="Save"
                                        disabled={updateTransactionMutation.isPending}
                                      >
                                        <Save className="w-3 h-3 text-green-600" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={cancelEditingTransaction}
                                        className="h-6 w-6 p-0"
                                        title="Cancel"
                                        disabled={updateTransactionMutation.isPending}
                                      >
                                        <X className="w-3 h-3 text-slate-400" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      {activity.entryType !== 'undo' && activity.journalEntryId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setSelectedJournalEntryId(activity.journalEntryId)}
                                          className="h-6 w-6 p-0"
                                          title="View Journal Entry"
                                        >
                                          <ExternalLink className="w-3 h-3 text-slate-400" />
                                        </Button>
                                      )}
                                      {activity.transactionId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setSelectedTransactionForAudit(activity.transactionId)}
                                          className="h-6 w-6 p-0"
                                          title="View Audit History"
                                        >
                                          <History className="w-3 h-3 text-slate-400" />
                                        </Button>
                                      )}
                                      {activity.entryType !== 'undo' && activity.transactionId && activity.journalEntryId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={async (e) => {
                                            e?.stopPropagation();
                                            try {
                                              const { data, error } = await firstsavvy.rpc('undo_posted_transaction', {
                                                p_transaction_id: activity.transactionId
                                              });

                                              if (error) {
                                                console.error('RPC Error:', error);
                                                toast.error(error.message || 'Failed to undo transaction');
                                                return;
                                              }

                                              if (data?.success) {
                                                toast.success('Transaction moved back to pending');
                                                queryClient.invalidateQueries(['journal-lines-paginated']);
                                                queryClient.invalidateQueries(['transactions']);
                                              } else {
                                                console.error('Function returned error:', data);
                                                toast.error(data?.error || 'Failed to undo transaction');
                                              }
                                            } catch (error) {
                                              console.error('Error undoing transaction:', error);
                                              toast.error(error.message || 'Failed to undo transaction');
                                            }
                                          }}
                                          className="h-6 w-6 p-0"
                                          title="Undo Transaction"
                                        >
                                          <Undo className="w-3 h-3 text-slate-400" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {totalJournalLines > 0 && (
                        <div className="text-xs text-slate-500 text-center py-1.5 border-t flex items-center justify-between px-3">
                          <span>Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, totalJournalLines)} of {totalJournalLines} transactions</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={goToPreviousPage}
                              disabled={!hasPreviousPage || journalLinesLoading}
                              className="h-7 text-xs"
                            >
                              Previous
                            </Button>
                            <span className="text-xs text-slate-600">Page {currentPage + 1} of {totalPages}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={goToNextPage}
                              disabled={!hasNextPage || journalLinesLoading}
                              className="h-7 text-xs"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

              <TabsContent value="audit" className="mt-0">
                <div className="mb-2 px-1">
                  <p className="text-xs text-slate-600">
                    Complete journal entry history including edits and all accounting changes.
                  </p>
                </div>
                {auditHistoryLoading ? (
                  <p className="text-center text-slate-500 py-3 text-sm">Loading audit history...</p>
                ) : auditHistoryError ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm text-red-600">Failed to load audit history</p>
                    <p className="text-xs text-slate-500">{auditHistoryError.message}</p>
                  </div>
                ) : allAuditActivity.length === 0 ? (
                  <p className="text-center text-slate-500 py-6 text-sm">No audit history found</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="h-8 bg-slate-100">
                          <TableHead className="py-1.5 text-[11px] font-semibold">Action Time</TableHead>
                          <TableHead className="py-1.5 text-[11px] font-semibold">Date</TableHead>
                          <TableHead className="py-1.5 text-[11px] font-semibold">Reference</TableHead>
                          <TableHead className="py-1.5 text-[11px] font-semibold">Type</TableHead>
                          <TableHead className="py-1.5 text-[11px] font-semibold">Description</TableHead>
                          {childAccounts.length > 0 && (
                            <TableHead className="py-1.5 text-[11px] font-semibold">Account</TableHead>
                          )}
                          <TableHead className="py-1.5 text-[11px] font-semibold">From/To</TableHead>
                          <TableHead className="py-1.5 text-[11px] font-semibold">By</TableHead>
                          <TableHead className="text-right py-1.5 text-[11px] font-semibold">Amount</TableHead>
                          <TableHead className="text-right py-1.5 text-[11px] font-semibold">Balance</TableHead>
                          <TableHead className="w-[40px] py-1.5"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allAuditActivity.map((activity, index) => (
                          <TableRow
                            key={`${activity.id || index}`}
                            className={`h-7 ${
                              index % 2 === 0
                                ? 'bg-white hover:bg-slate-50'
                                : 'bg-slate-50/50 hover:bg-slate-100'
                            }`}
                          >
                            <TableCell className="py-1 text-[11px] text-slate-600 whitespace-nowrap">
                              {activity.createdAt ? format(new Date(activity.createdAt), 'MMM d, h:mm a') : '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-[11px] py-1">
                              {format(parseISO(activity.displayDate), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="py-1">
                              <span
                                className="font-mono text-[10px] text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"
                                onClick={() => activity.journalEntryId && setSelectedJournalEntryId(activity.journalEntryId)}
                              >
                                {activity.entryNumber}
                              </span>
                            </TableCell>
                            <TableCell className="py-1">
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-5 capitalize ${activity.entryType === 'undo' ? 'border-amber-300 text-amber-700 bg-amber-50' : ''}`}
                              >
                                {getAuditEntryTypeLabel(activity.entryType, accountClass, activity.debitAmount, activity.creditAmount)}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1 max-w-[250px]">
                              <div className="text-[11px] truncate">
                                {activity.displayDescription}
                              </div>
                            </TableCell>
                            {childAccounts.length > 0 && (
                              <TableCell className="text-[11px] text-slate-600 py-1">
                                <div className="truncate max-w-[150px]">
                                  {activity.account_name || '\u2014'}
                                </div>
                              </TableCell>
                            )}
                            <TableCell className="text-[11px] text-slate-600 py-1">
                              {activity.offsettingAccounts || '—'}
                            </TableCell>
                            <TableCell className="text-[11px] py-1">
                              {activity.actorName ? (
                                <span className="inline-flex items-center gap-1 text-slate-500">
                                  <span className="inline-flex h-4 w-4 rounded-full bg-slate-200 items-center justify-center text-[9px] font-semibold text-slate-600 flex-shrink-0">
                                    {activity.actorName.charAt(0).toUpperCase()}
                                  </span>
                                  {activity.actorName.split(' ')[0]}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-[11px] py-1">
                              {(() => {
                                const amount = (activity.calculatedCredit || 0) - (activity.calculatedDebit || 0);
                                return (
                                  <span className={amount < 0 ? 'text-red-600' : amount > 0 ? 'text-green-600' : ''}>
                                    {formatCurrency(amount)}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right text-[11px] py-1 font-medium text-slate-700">
                              {formatCurrency(activity.runningBalance || 0)}
                            </TableCell>
                            <TableCell className="py-1">
                              <div className="flex items-center gap-1">
                                {activity.journalEntryId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedJournalEntryId(activity.journalEntryId)}
                                    className="h-6 w-6 p-0"
                                    title="View Journal Entry"
                                  >
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  </Button>
                                )}
                                {activity.transactionId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedTransactionForAudit(activity.transactionId)}
                                    className="h-6 w-6 p-0"
                                    title="View Audit History"
                                  >
                                    <History className="w-3 h-3 text-slate-400" />
                                  </Button>
                                )}
                                {activity.transactionId && activity.journalEntryId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async (e) => {
                                      e?.stopPropagation();
                                      try {
                                        const { data, error } = await firstsavvy.rpc('undo_posted_transaction', {
                                          p_transaction_id: activity.transactionId
                                        });

                                        if (error) {
                                          console.error('RPC Error:', error);
                                          toast.error(error.message || 'Failed to undo transaction');
                                          return;
                                        }

                                        if (data?.success) {
                                          toast.success('Transaction moved back to pending');
                                          queryClient.invalidateQueries(['audit-history-paginated']);
                                          queryClient.invalidateQueries(['transactions']);
                                        } else {
                                          console.error('Function returned error:', data);
                                          toast.error(data?.error || 'Failed to undo transaction');
                                        }
                                      } catch (error) {
                                        console.error('Error undoing transaction:', error);
                                        toast.error(error.message || 'Failed to undo transaction');
                                      }
                                    }}
                                    className="h-6 w-6 p-0"
                                    title="Undo Transaction"
                                  >
                                    <Undo className="w-3 h-3 text-slate-400" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {totalAuditLines > 0 && (
                      <div className="text-xs text-slate-500 text-center py-1.5 border-t flex items-center justify-between px-3">
                        <span>Showing {currentAuditPage * PAGE_SIZE + 1}-{Math.min((currentAuditPage + 1) * PAGE_SIZE, totalAuditLines)} of {totalAuditLines} entries</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToPreviousAuditPage}
                            disabled={!hasPreviousAuditPage || auditHistoryLoading}
                            className="h-7 text-xs"
                          >
                            Previous
                          </Button>
                          <span className="text-xs text-slate-600">Page {currentAuditPage + 1} of {totalAuditPages}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToNextAuditPage}
                            disabled={!hasNextAuditPage || auditHistoryLoading}
                            className="h-7 text-xs"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
        )}

        {selectedJournalEntryId && (
          <JournalEntryDialog
            entryId={selectedJournalEntryId}
            open={!!selectedJournalEntryId}
            onClose={() => setSelectedJournalEntryId(null)}
          />
        )}

        {selectedTransactionForAudit && (
          <AuditHistoryModal
            transactionId={selectedTransactionForAudit}
            open={!!selectedTransactionForAudit}
            onClose={() => setSelectedTransactionForAudit(null)}
          />
        )}

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
            <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-200 flex-shrink-0">
              <DialogTitle className="text-lg font-semibold">
                {importStep === 'upload' && 'Import Transactions'}
                {importStep === 'mapping' && 'Map CSV Columns'}
                {importStep === 'confirm' && 'Confirm Import'}
              </DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto px-6 py-5 flex-1">

            {importStep === 'upload' && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Upload a CSV file containing your transactions. We'll help you map the columns and import them into this account.
                </div>
                <div
                  onClick={() => document.getElementById('import-file-input')?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileUpload(file);
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
                    id="import-file-input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {importStep === 'mapping' && processedData && (
              <CsvColumnMapper
                csvData={processedData}
                onMap={handleCsvMapping}
                onCancel={() => {
                  setImportStep('upload');
                  setProcessedData(null);
                  setUploadedFile(null);
                }}
                isImporting={isImporting}
                isFirstImport={totalJournalLines === 0}
                suggestedBeginningBalance={account?.current_balance || 0}
                profileId={activeProfile?.id}
                institutionName={account?.institution_name || account?.display_name || 'Unknown Bank'}
                accountClass={account?.class || 'asset'}
              />
            )}

            {importStep === 'confirm' && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <Download className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-900">
                        Ready to Import
                      </p>
                      <p className="text-xs text-green-700">
                        {mappedTransactions.length} transactions will be imported to {account.display_name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportStep('mapping');
                    }}
                    disabled={isImporting}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isImporting ? 'Importing...' : `Import ${mappedTransactions.length} Transactions`}
                  </Button>
                </div>
              </div>
            )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
