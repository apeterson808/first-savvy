import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Download, Printer, Search, Filter, ExternalLink, FileText, Minus, Equal, History, Upload
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
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
import { getAccountJournalLinesPaginated, getAccountAuditHistoryPaginated } from '@/api/journalEntries';
import { getDateRangeFromPreset, formatDateForDb } from '@/utils/dateRangeUtils';
import JournalEntryDialog from '@/components/accounting/JournalEntryDialog';
import AuditHistoryModal from '@/components/accounting/AuditHistoryModal';
import { useAccountTypesByClass, useAccountDetailsByType } from '@/hooks/useChartOfAccounts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CsvColumnMapper from '@/components/banking/CsvColumnMapper';
import { processStatementFile, autoMatchTransfers, mapCsvToTransactions } from '@/components/banking/StatementProcessor';
import { detectDuplicateTransactions } from '@/api/duplicateDetection';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const [datePreset, setDatePreset] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState(null);
  const [selectedTransactionForAudit, setSelectedTransactionForAudit] = useState(null);
  const [activeTab, setActiveTab] = useState('register');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeProfile } = useProfile();

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importStep, setImportStep] = useState('upload');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [mappedTransactions, setMappedTransactions] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editAccountType, setEditAccountType] = useState('');
  const [editAccountDetail, setEditAccountDetail] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get('from') || '?tab=accounts';

  const dateRange = useMemo(() => getDateRangeFromPreset(datePreset), [datePreset]);

  // Hooks for fetching account types and details in edit mode
  const { accountTypes = [] } = useAccountTypesByClass(editClass);
  const { accountDetails = [] } = useAccountDetailsByType(editClass, editAccountType);

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      if (!id) return null;

      const accountData = await getChartAccountById(id);

      if (!accountData) {
        console.log('Account not found. ID:', id);
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

  // NOTE: Pending transactions are NOT shown in the register (QuickBooks behavior)
  // Transactions only appear in the register after they've been posted to journal entries

  // SOURCE OF TRUTH: Query posted journal entry lines with pagination
  const {
    data: journalLinesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: journalLinesLoading,
    error: journalLinesError
  } = useInfiniteQuery({
    queryKey: ['journal-lines-paginated', 'account', id, activeProfile?.id, datePreset],
    queryFn: async ({ pageParam = 0 }) => {
      if (!id || !activeProfile) return { lines: [], totalCount: 0, hasMore: false };
      return await getAccountJournalLinesPaginated({
        profileId: activeProfile.id,
        accountId: id,
        startDate: formatDateForDb(dateRange.start),
        endDate: formatDateForDb(dateRange.end),
        limit: 100,
        offset: pageParam
      });
    },
    getNextPageParam: (lastPage, pages) => {
      const loadedCount = pages.reduce((sum, page) => sum + page.lines.length, 0);
      return lastPage.hasMore ? loadedCount : undefined;
    },
    enabled: !!id && !!activeProfile
  });

  const journalLines = useMemo(() => {
    if (!journalLinesData?.pages) return [];
    return journalLinesData.pages.flatMap(page => page.lines);
  }, [journalLinesData]);

  const totalJournalLines = journalLinesData?.pages?.[0]?.totalCount || 0;

  const {
    data: auditHistoryData,
    fetchNextPage: fetchNextAuditPage,
    hasNextPage: hasNextAuditPage,
    isFetchingNextPage: isFetchingNextAuditPage,
    isLoading: auditHistoryLoading,
    error: auditHistoryError
  } = useInfiniteQuery({
    queryKey: ['audit-history-paginated', 'account', id, activeProfile?.id, datePreset],
    queryFn: async ({ pageParam = 0 }) => {
      if (!id || !activeProfile) return { lines: [], totalCount: 0, hasMore: false };
      return await getAccountAuditHistoryPaginated({
        profileId: activeProfile.id,
        accountId: id,
        startDate: formatDateForDb(dateRange.start),
        endDate: formatDateForDb(dateRange.end),
        limit: 100,
        offset: pageParam
      });
    },
    getNextPageParam: (lastPage, pages) => {
      const loadedCount = pages.reduce((sum, page) => sum + page.lines.length, 0);
      return lastPage.hasMore ? loadedCount : undefined;
    },
    enabled: !!id && !!activeProfile && activeTab === 'audit'
  });

  const auditHistoryLines = useMemo(() => {
    if (!auditHistoryData?.pages) return [];
    return auditHistoryData.pages.flatMap(page => page.lines);
  }, [auditHistoryData]);

  const totalAuditLines = auditHistoryData?.pages?.[0]?.totalCount || 0;

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
      console.error('Update failed:', error);
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
      navigate(`/Banking${returnUrl}`);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
      toast.error(`Failed to delete account: ${error.message}`);
    }
  });


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
      // For transfers and credit card payments, show special labels instead of account names
      const entryType = jl.entry_type || 'adjustment';
      let offsettingAccountsDisplay = jl.offsetting_accounts;

      if (entryType === 'transfer') {
        offsettingAccountsDisplay = 'Transfer';
      } else if (entryType === 'credit_card_payment') {
        offsettingAccountsDisplay = 'Credit Card Payment';
      }

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
        offsettingAccounts: offsettingAccountsDisplay,
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

    // All items are posted with pre-calculated running balance from database
    let activitiesWithBalance = combined.map(activity => ({
      ...activity,
      calculatedDebit: activity.debitAmount || 0,
      calculatedCredit: activity.creditAmount || 0
    }));

    let beginningBal = null;
    if (dateRange.start && activitiesWithBalance.length > 0) {
      beginningBal = account?.current_balance || 0;
      const totalChange = activitiesWithBalance[activitiesWithBalance.length - 1].runningBalance;
      beginningBal = beginningBal - totalChange;

      activitiesWithBalance.forEach(activity => {
        activity.runningBalance += beginningBal;
      });
    }

    const endingBal = activitiesWithBalance.length > 0
      ? activitiesWithBalance[0].runningBalance
      : (account?.current_balance || 0);

    const totalDebits = activitiesWithBalance.reduce((sum, a) => sum + (a.calculatedDebit || 0), 0);
    const totalCredits = activitiesWithBalance.reduce((sum, a) => sum + (a.calculatedCredit || 0), 0);
    const netChange = isDebitNormal ? (totalDebits - totalCredits) : (totalCredits - totalDebits);

    const analyticsData = {
      transactionCount: combined.length,
      totalDebits,
      totalCredits,
      netChange,
      avgTransaction: combined.length > 0 ? Math.abs(totalDebits + totalCredits) / combined.length : 0,
      firstTransaction: combined.length > 0 ? combined[0].displayDate : null,
      lastTransaction: combined.length > 0 ? combined[combined.length - 1].displayDate : null
    };

    return {
      allActivity: activitiesWithBalance,
      analytics: analyticsData,
      beginningBalance: dateRange.start ? beginningBal : null,
      endingBalance: endingBal
    };
  }, [journalLines, account, searchQuery, dateRange]);

  const { allAuditActivity, auditAnalytics } = useMemo(() => {
    if (activeTab !== 'audit') return { allAuditActivity: [], auditAnalytics: {} };

    const accountClass = account?.account_class || account?.class || 'asset';
    const isDebitNormal = accountClass === 'asset' || accountClass === 'expense';

    let combined = auditHistoryLines.map(jl => {
      const entryType = jl.entry_type || 'adjustment';
      let offsettingAccountsDisplay = jl.offsetting_accounts;

      if (entryType === 'transfer') {
        offsettingAccountsDisplay = 'Transfer';
      } else if (entryType === 'credit_card_payment') {
        offsettingAccountsDisplay = 'Credit Card Payment';
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
        offsettingAccounts: offsettingAccountsDisplay,
        runningBalance: parseFloat(jl.running_balance || 0),
        createdAt: jl.created_at
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

    let activitiesWithBalance = combined.map(activity => ({
      ...activity,
      calculatedDebit: activity.debitAmount || 0,
      calculatedCredit: activity.creditAmount || 0
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
  }, [auditHistoryLines, account, searchQuery, activeTab]);

  // Infinite scroll observer for register
  const loadMoreRef = useRef();
  const observerCallback = useCallback((entries) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Infinite scroll observer for audit history
  const loadMoreAuditRef = useRef();
  const observerAuditCallback = useCallback((entries) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasNextAuditPage && !isFetchingNextAuditPage) {
      fetchNextAuditPage();
    }
  }, [hasNextAuditPage, isFetchingNextAuditPage, fetchNextAuditPage]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    });

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [observerCallback]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(observerAuditCallback, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    });

    const currentRef = loadMoreAuditRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [observerAuditCallback]);

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
      ['Date', 'Description', 'Reference', 'Offsetting Account', 'Debit', 'Credit', 'Balance'].join(','),
      ...allActivity.map(activity => [
        format(new Date(activity.displayDate), 'yyyy-MM-dd'),
        `"${activity.displayDescription}"`,
        activity.entryNumber || '',
        `"${activity.offsettingAccounts || ''}"`,
        activity.calculatedDebit || '',
        activity.calculatedCredit || '',
        activity.runningBalance
      ].join(','))
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
      const data = await processStatementFile(file, (status) => {
        console.log('Processing status:', status);
      });

      setProcessedData(data);

      if (data.type === 'transactions') {
        await handleOfxImport(data);
      } else {
        setImportStep('mapping');
      }
    } catch (error) {
      console.error('Error processing file:', error);
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
      if (beginningBalance !== null && beginningBalance !== undefined) {
        const { error: balanceError } = await firstsavvy
          .from('user_chart_of_accounts')
          .update({ current_balance: beginningBalance })
          .eq('id', account.id);

        if (balanceError) {
          console.error('Error updating beginning balance:', balanceError);
          toast.error('Failed to update beginning balance');
          setIsImporting(false);
          return;
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
          console.error('Error updating bank balance:', bankBalanceError);
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
      console.error('Error importing OFX transactions:', error);
      toast.error(error.message || 'Failed to import transactions');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCsvMapping = async (mappingConfig) => {
    const { columnMappings, dateFormat, amountType, debitColumn, creditColumn, beginningBalance, endingBalance } = mappingConfig;

    console.log('=== CSV Import Debug ===');
    console.log('Beginning Balance:', beginningBalance);
    console.log('Ending Balance:', endingBalance);
    console.log('Account ID:', account.id);

    const transactions = mapCsvToTransactions(
      processedData,
      columnMappings,
      amountType,
      debitColumn,
      creditColumn
    );

    setMappedTransactions(transactions);

    if (transactions.length === 0) {
      toast.error('No transactions to import');
      setIsImporting(false);
      return;
    }

    setIsImporting(true);
    try {
      if (beginningBalance !== null && beginningBalance !== undefined) {
        console.log('Updating current_balance to:', beginningBalance);
        const { error: balanceError } = await firstsavvy
          .from('user_chart_of_accounts')
          .update({ current_balance: beginningBalance })
          .eq('id', account.id);

        if (balanceError) {
          console.error('Error updating beginning balance:', balanceError);
          toast.error('Failed to update beginning balance');
          setIsImporting(false);
          return;
        }
        console.log('Current balance updated successfully');
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
        console.log('Updating bank_balance to:', endingBalance);
        const { error: bankBalanceError } = await firstsavvy
          .from('user_chart_of_accounts')
          .update({
            bank_balance: endingBalance,
            last_synced_at: new Date().toISOString()
          })
          .eq('id', account.id);

        if (bankBalanceError) {
          console.error('Error updating bank balance:', bankBalanceError);
        } else {
          console.log('Bank balance updated successfully to:', endingBalance);
        }
      } else {
        console.warn('Ending balance is null or undefined, not updating bank_balance');
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
      console.error('Error importing transactions:', error);
      toast.error(error.message || 'Failed to import transactions');
    } finally {
      setIsImporting(false);
    }
  };

  if (accountLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-slate-500">Loading account...</div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-slate-500">Account not found</div>
          <div className="text-center mt-4">
            <Button onClick={() => navigate(`/Banking${returnUrl}`)} variant="outline">
              Back to Accounts
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
      <div className="max-w-6xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/Banking${returnUrl}`)}
              className="gap-1.5 h-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            {!isEditMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImport}
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Upload className="w-3.5 h-3.5" />
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
                  variant="outline"
                  size="sm"
                  onClick={initializeEditMode}
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
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
                          account.entityType === 'Asset' ? 'text-forest-green' :
                          account.entityType === 'Liability' ? 'text-burgundy' :
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
                  {/* Line 1: Name, Account Number, Active Badge */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-lg font-semibold">{account.display_name || account.name}</h1>
                    {account.account_number && (
                      <span className="text-sm text-slate-500 font-mono">
                        ({account.account_number})
                      </span>
                    )}
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Line 2: Class, Account Type, Account Detail */}
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="capitalize">{formatLabel(account.account_class || account.class || '')}</span>
                    {account.account_type && (
                      <>
                        <span>•</span>
                        <span>{formatLabel(account.account_type)}</span>
                      </>
                    )}
                    {account.account_detail && (
                      <>
                        <span>•</span>
                        <span>{formatLabel(account.account_detail)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
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
                          account.entityType === 'Asset' ? 'text-forest-green' :
                          account.entityType === 'Liability' ? 'text-burgundy' :
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

        <Card>
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-base font-semibold">Period Summary</h2>
              <div className="flex items-center gap-2">
                <DatePresetDropdown
                  value={datePreset}
                  onValueChange={setDatePreset}
                  triggerClassName="w-40 h-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {beginningBalance !== null && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-600 mb-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <p className="text-xs font-medium">Beginning Balance</p>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(beginningBalance)}</p>
                </div>
              )}

              <div className="p-3 bg-light-blue/20 rounded-lg">
                <div className="flex items-center gap-1.5 text-sky-blue mb-0.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <p className="text-xs font-medium">Total Debits</p>
                </div>
                <p className="text-lg font-bold text-sky-blue">{formatCurrency(analytics.totalDebits)}</p>
              </div>

              <div className="p-3 bg-soft-green/20 rounded-lg">
                <div className="flex items-center gap-1.5 text-forest-green mb-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <p className="text-xs font-medium">Total Credits</p>
                </div>
                <p className="text-lg font-bold text-forest-green">{formatCurrency(analytics.totalCredits)}</p>
              </div>

              <div className="p-3 bg-burgundy/10 rounded-lg">
                <div className="flex items-center gap-1.5 text-burgundy mb-0.5">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <p className="text-xs font-medium">Net Change</p>
                </div>
                <p className={`text-lg font-bold ${analytics.netChange >= 0 ? 'text-forest-green' : 'text-burgundy'}`}>
                  {formatCurrency(analytics.netChange)}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-1.5 text-slate-600 mb-0.5">
                  <Hash className="w-3.5 h-3.5" />
                  <p className="text-xs font-medium">Transactions</p>
                </div>
                <p className="text-lg font-bold">{analytics.transactionCount}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-1.5 text-slate-600 mb-0.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <p className="text-xs font-medium">Avg Transaction</p>
                </div>
                <p className="text-lg font-bold">{formatCurrency(analytics.avgTransaction)}</p>
              </div>

              <div className="p-3 bg-primary/10 rounded-lg col-span-2">
                <div className="flex items-center gap-1.5 text-primary mb-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <p className="text-xs font-medium">Ending Balance</p>
                </div>
                <p className="text-lg font-bold text-primary">{formatCurrency(endingBalance)}</p>
              </div>
            </div>

            {analytics.firstTransaction && analytics.lastTransaction && (
              <div className="mt-3 pt-3 border-t text-xs text-slate-600">
                <p>
                  Period: <span className="font-medium">{format(parseISO(analytics.firstTransaction), 'MMM d, yyyy')}</span>
                  {' '} to {' '}
                  <span className="font-medium">{format(parseISO(analytics.lastTransaction), 'MMM d, yyyy')}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  {isTransactionBasedAccount ? 'Account Register' : 'General Ledger Activity'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-52 h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                      <TableHead className="py-1.5 text-[11px] font-semibold">{isTransactionBasedAccount ? 'Category' : 'Offsetting Account'}</TableHead>
                      <TableHead className="text-right py-1.5 text-[11px] font-semibold">Debit</TableHead>
                      <TableHead className="text-right py-1.5 text-[11px] font-semibold">Credit</TableHead>
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
                        <TableCell className="text-right text-[11px] py-1">
                          {activity.calculatedDebit > 0 ? formatCurrency(activity.calculatedDebit) : ''}
                        </TableCell>
                        <TableCell className="text-right text-[11px] py-1">
                          {activity.calculatedCredit > 0 ? formatCurrency(activity.calculatedCredit) : ''}
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {isFetchingNextPage && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-3 text-slate-500 text-xs">
                          Loading more transactions...
                        </TableCell>
                      </TableRow>
                    )}
                    {hasNextPage && !isFetchingNextPage && (
                      <TableRow ref={loadMoreRef}>
                        <TableCell colSpan={8} className="h-4"></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {totalJournalLines > 0 && (
                  <div className="text-xs text-slate-500 text-center py-1.5 border-t">
                    Showing {allActivity.length} of {totalJournalLines} transactions
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
                          <TableHead className="py-1.5 text-[11px] font-semibold">Offsetting Account</TableHead>
                          <TableHead className="text-right py-1.5 text-[11px] font-semibold">Debit</TableHead>
                          <TableHead className="text-right py-1.5 text-[11px] font-semibold">Credit</TableHead>
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
                              <Badge variant="outline" className="text-[10px] h-5 capitalize">
                                {activity.entryType.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1 max-w-[250px]">
                              <div className="text-[11px] truncate">
                                {activity.displayDescription}
                              </div>
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-600 py-1">
                              {activity.offsettingAccounts || '—'}
                            </TableCell>
                            <TableCell className="text-right text-[11px] py-1">
                              {activity.calculatedDebit > 0 ? formatCurrency(activity.calculatedDebit) : ''}
                            </TableCell>
                            <TableCell className="text-right text-[11px] py-1">
                              {activity.calculatedCredit > 0 ? formatCurrency(activity.calculatedCredit) : ''}
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
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {isFetchingNextAuditPage && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-3 text-slate-500 text-xs">
                              Loading more entries...
                            </TableCell>
                          </TableRow>
                        )}
                        {hasNextAuditPage && !isFetchingNextAuditPage && (
                          <TableRow ref={loadMoreAuditRef}>
                            <TableCell colSpan={9} className="h-4"></TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    {totalAuditLines > 0 && (
                      <div className="text-xs text-slate-500 text-center py-1.5 border-t">
                        Showing {allAuditActivity.length} of {totalAuditLines} entries
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {importStep === 'upload' && 'Import Transactions'}
                {importStep === 'mapping' && 'Map CSV Columns'}
                {importStep === 'confirm' && 'Confirm Import'}
              </DialogTitle>
            </DialogHeader>

            {importStep === 'upload' && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Upload a CSV, OFX, or QFX file containing your transactions. We'll help you map the columns and import them into this account.
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
                    CSV, OFX, and QFX files supported
                  </p>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".csv,.ofx,.qfx"
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
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
