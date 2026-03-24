import React, { useState, useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, FileText, History, Search } from 'lucide-react';
import { Circle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { budgetAnalytics } from '@/api/budgetAnalytics';
import { BudgetPerformanceCard } from '@/components/budgeting/BudgetPerformanceCard';
import { SpendingAndVendorCard } from '@/components/budgeting/SpendingAndVendorCard';
import DatePresetDropdown from '@/components/common/DatePresetDropdown';
import { getAccountJournalLinesPaginated, getAccountAuditHistoryPaginated } from '@/api/journalEntries';
import { formatCurrency, formatTransactionDescription } from '@/components/utils/formatters';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { getDateRangeFromPreset, formatDateForDb } from '@/utils/dateRangeUtils';
import JournalEntryDialog from '@/components/accounting/JournalEntryDialog';
import AuditHistoryModal from '@/components/accounting/AuditHistoryModal';
import { toast } from 'sonner';
import ContactDropdown from '@/components/common/ContactDropdown';
import CategoryDropdown from '@/components/common/CategoryDropdown';
import AddContactSheet from '@/components/contacts/AddContactSheet';
import AccountCreationWizard from '@/components/banking/AccountCreationWizard';
import { withRetry } from '@/components/utils/errorHandler';

export function ChildBudgetSection({ childAccount, profileId }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [ledgerTab, setLedgerTab] = useState('register');
  const [datePreset, setDatePreset] = useState('thisMonth');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState(null);
  const [selectedTransactionForAudit, setSelectedTransactionForAudit] = useState(null);
  const [budgetMonth, setBudgetMonth] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [columnWidths, setColumnWidths] = useState({
    account: 200,
    description: 250,
    contact: 150,
    category: 200
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [addContactSheetOpen, setAddContactSheetOpen] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [triggeringContactTransactionId, setTriggeringContactTransactionId] = useState(null);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [triggeringTransactionId, setTriggeringTransactionId] = useState(null);
  const [addAccountSheetOpen, setAddAccountSheetOpen] = useState(false);

  const dateRange = useMemo(() => getDateRangeFromPreset(datePreset), [datePreset]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', profileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('bank_accounts')
        .select('*')
        .eq('profile_id', profileId)
        .order('display_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId && isOpen
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', profileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('contacts')
        .select('*')
        .eq('profile_id', profileId)
        .order('display_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId && isOpen
  });

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts-all', profileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('profile_id', profileId)
        .order('display_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId && isOpen
  });

  const activeAccountIds = useMemo(() => {
    return accounts.filter(a => a.is_active).map(a => a.id);
  }, [accounts]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      return withRetry(() => firstsavvy.entities.Transaction.update(id, data), { maxRetries: 2 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['journal-lines-paginated']);
      queryClient.invalidateQueries(['fullPendingTransactions']);
      queryClient.invalidateQueries(['fullPostedTransactions']);
    },
    onError: (error) => {
      toast.error('Failed to update transaction: ' + error.message);
    }
  });

  const { data: budget } = useQuery({
    queryKey: ['budget-for-category', childAccount.id, profileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('budgets')
        .select('*')
        .eq('chart_account_id', childAccount.id)
        .eq('profile_id', profileId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: currentMonthSpending } = useQuery({
    queryKey: ['current-month-spending', childAccount.id, profileId, budgetMonth.toISOString()],
    queryFn: async () => {
      const monthStart = startOfMonth(budgetMonth);
      const monthEnd = endOfMonth(budgetMonth);
      const { data, error } = await firstsavvy.supabase
        .from('transactions')
        .select('amount')
        .eq('profile_id', profileId)
        .eq('category_account_id', childAccount.id)
        .eq('status', 'posted')
        .eq('type', childAccount.class === 'expense' ? 'expense' : 'income')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString());
      if (error) throw error;
      return data?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;
    },
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: historicalData } = useQuery({
    queryKey: ['historical-spending', childAccount.id, profileId],
    queryFn: () => budgetAnalytics.getHistoricalSpending(childAccount.id, 12, profileId),
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendor-breakdown', childAccount.id, profileId],
    queryFn: () => budgetAnalytics.getVendorBreakdown(childAccount.id, null, profileId),
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: performanceHistory } = useQuery({
    queryKey: ['budget-performance-history', childAccount.id, profileId],
    queryFn: () => budgetAnalytics.getBudgetPerformanceHistory(childAccount.id, 12, profileId),
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const { data: comparativeData } = useQuery({
    queryKey: ['comparative-analysis', childAccount.id, profileId],
    queryFn: () => budgetAnalytics.getComparativeAnalysis(childAccount.id, profileId),
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const {
    data: journalLinesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: journalLinesLoading,
  } = useInfiniteQuery({
    queryKey: ['journal-lines-paginated', 'account', childAccount.id, profileId, datePreset],
    queryFn: async ({ pageParam = 0 }) => {
      if (!childAccount.id || !profileId) return { lines: [], totalCount: 0, hasMore: false };
      return await getAccountJournalLinesPaginated({
        profileId,
        accountId: childAccount.id,
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
    enabled: !!childAccount.id && !!profileId && isOpen
  });

  const {
    data: auditHistoryData,
    fetchNextPage: fetchNextAuditPage,
    hasNextPage: hasNextAuditPage,
    isFetchingNextPage: isFetchingNextAuditPage,
  } = useInfiniteQuery({
    queryKey: ['audit-history-paginated', 'account', childAccount.id, profileId, datePreset],
    queryFn: async ({ pageParam = 0 }) => {
      if (!childAccount.id || !profileId) return { lines: [], totalCount: 0, hasMore: false };
      return await getAccountAuditHistoryPaginated({
        profileId,
        accountId: childAccount.id,
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
    enabled: !!childAccount.id && !!profileId && isOpen && ledgerTab === 'audit'
  });

  const journalLines = useMemo(() => {
    if (!journalLinesData?.pages) return [];
    return journalLinesData.pages.flatMap(page => page.lines);
  }, [journalLinesData]);

  const auditHistoryLines = useMemo(() => {
    if (!auditHistoryData?.pages) return [];
    return auditHistoryData.pages.flatMap(page => page.lines);
  }, [auditHistoryData]);

  const { data: transactionsMap = {} } = useQuery({
    queryKey: ['transactions-for-journal-lines', profileId, journalLines.map(jl => jl.transaction_id).filter(Boolean)],
    queryFn: async () => {
      const transactionIds = journalLines.map(jl => jl.transaction_id).filter(Boolean);
      if (transactionIds.length === 0) return {};

      const { data, error } = await firstsavvy.supabase
        .from('transactions')
        .select('*')
        .in('id', transactionIds);

      if (error) throw error;

      const map = {};
      (data || []).forEach(txn => {
        map[txn.id] = txn;
      });
      return map;
    },
    enabled: !!profileId && isOpen && journalLines.length > 0
  });

  const allActivity = useMemo(() => {
    let combined = journalLines.map(jl => {
      const transaction = transactionsMap[jl.transaction_id];
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
        transaction,
        runningBalance: parseFloat(jl.running_balance || 0)
      };
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      combined = combined.filter(item =>
        item.displayDescription?.toLowerCase().includes(query) ||
        item.entryNumber?.toLowerCase().includes(query) ||
        item.transaction?.description?.toLowerCase().includes(query)
      );
    }

    combined.sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate));
    return combined;
  }, [journalLines, searchQuery, transactionsMap]);

  const IconComponent = childAccount.icon && Icons[childAccount.icon] ? Icons[childAccount.icon] : Circle;
  const iconColor = childAccount.color || '#94a3b8';

  const itemsPerPage = 10;
  const totalPages = Math.ceil(allActivity.length / itemsPerPage);
  const paginatedActivity = allActivity.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startResize = (column, e) => {
    setIsResizing(true);
    setResizingColumn(column);
    setStartX(e.clientX);
    setStartWidth(columnWidths[column]);

    const handleMouseMove = (moveEvent) => {
      const diff = moveEvent.clientX - e.clientX;
      const newWidth = Math.max(50, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getAccountDisplayName = (account) => {
    if (!account) return 'Unknown';
    return account.display_name || account.account_name || 'Unknown';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4" style={{ borderLeftColor: iconColor }}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 pt-3 px-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <IconComponent className="h-5 w-5 flex-shrink-0" style={{ color: iconColor }} />
                <span className="text-base font-semibold">{childAccount.display_name}</span>
                {budget && (
                  <Badge variant={budget.is_active ? 'default' : 'secondary'} className="text-xs">
                    {budget.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                )}
                {!budget && (
                  <Badge variant="outline" className="text-xs text-slate-400">No Budget</Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {currentMonthSpending !== undefined && (
                  <span className="text-sm text-slate-500">
                    {formatCurrency(currentMonthSpending)} this month
                  </span>
                )}
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BudgetPerformanceCard
                budget={budget}
                currentSpending={currentMonthSpending}
                performanceHistory={performanceHistory}
                comparativeData={comparativeData}
                historicalData={historicalData}
                parentName={childAccount?.display_name}
                selectedMonth={budgetMonth}
                onMonthChange={setBudgetMonth}
              />
              <SpendingAndVendorCard
                historicalData={historicalData}
                budget={budget}
                vendorData={vendorData}
              />
            </div>

            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Account Ledger</p>
              </CardHeader>
              <CardContent className="pt-2">
                <Tabs value={ledgerTab} onValueChange={setLedgerTab} className="w-full">
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
                      <DatePresetDropdown
                        value={datePreset}
                        onValueChange={setDatePreset}
                        triggerClassName="w-40 h-8 text-sm"
                      />
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                          placeholder="Search transactions..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 w-56 h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <TabsContent value="register" className="mt-0">
                    {journalLinesLoading ? (
                      <p className="text-center text-slate-500 py-3 text-sm">Loading register...</p>
                    ) : allActivity.length === 0 ? (
                      <p className="text-center text-slate-500 py-6 text-sm">No activity found</p>
                    ) : (
                      <>
                        <div className="rounded-md border overflow-x-auto max-h-[520px]">
                          <table className="w-max min-w-full" style={{ tableLayout: 'auto' }}>
                            <colgroup>
                              <col style={{ width: 110, minWidth: 110 }} />
                              <col style={{ width: columnWidths.account, minWidth: 100 }} />
                              <col style={{ width: 100, minWidth: 100 }} />
                              <col style={{ width: columnWidths.description, minWidth: 150 }} />
                              <col style={{ width: columnWidths.category, minWidth: 100 }} />
                              <col style={{ width: columnWidths.contact, minWidth: 100 }} />
                              <col style={{ width: 90, minWidth: 90 }} />
                              <col style={{ width: 90, minWidth: 90 }} />
                              <col style={{ width: 100, minWidth: 100 }} />
                            </colgroup>
                            <thead className="sticky top-0 z-30 bg-slate-100 shadow-sm">
                              <tr className="h-8">
                                <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 py-2">
                                  Date
                                </th>
                                <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.account }}>
                                  Account
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                                    onMouseDown={(e) => startResize('account', e)}
                                  />
                                </th>
                                <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 py-2">
                                  Reference
                                </th>
                                <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.description }}>
                                  Description
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                                    onMouseDown={(e) => startResize('description', e)}
                                  />
                                </th>
                                <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.category }}>
                                  Category
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                                    onMouseDown={(e) => startResize('category', e)}
                                  />
                                </th>
                                <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.contact }}>
                                  Contact
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                                    onMouseDown={(e) => startResize('contact', e)}
                                  />
                                </th>
                                <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-right pr-2 py-2 whitespace-nowrap">
                                  Money In
                                </th>
                                <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-right pr-2 py-2 whitespace-nowrap">
                                  Money Out
                                </th>
                                <th className="font-semibold text-slate-700 bg-slate-100 text-right pr-2 py-2 whitespace-nowrap">
                                  Balance
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedActivity.map((activity, index) => {
                                const transaction = activity.transaction;
                                const account = transaction ? accounts.find(a => a.id === transaction.bank_account_id) : null;
                                const isInactive = transaction && !activeAccountIds.includes(transaction.bank_account_id);
                                const category = transaction && transaction.category_account_id ? chartAccounts.find(c => c.id === transaction.category_account_id) : null;
                                const contact = transaction && transaction.contact_id ? contacts.find(c => c.id === transaction.contact_id) : null;

                                return (
                                  <tr
                                    key={`${activity.id || index}`}
                                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} h-8`}
                                  >
                                    <td className="text-sm border-r border-slate-200 py-1 pl-2 pr-1">
                                      {activity.displayDate && !isNaN(new Date(activity.displayDate).getTime())
                                        ? format(parseISO(activity.displayDate), 'MMM d, yyyy')
                                        : '—'}
                                    </td>
                                    <td className="text-sm border-r border-slate-200 py-1 px-4 pl-2 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: columnWidths.account, minWidth: columnWidths.account, maxWidth: columnWidths.account }}>
                                      {account ? `${getAccountDisplayName(account)}` : '—'}
                                    </td>
                                    <td className="text-sm border-r border-slate-200 py-1 pl-2 pr-1 text-slate-500">
                                      {activity.entryNumber || '—'}
                                    </td>
                                    <td className="text-sm border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.description, minWidth: columnWidths.description, maxWidth: columnWidths.description }}>
                                      {transaction ? (
                                        <Input
                                          defaultValue={formatTransactionDescription(transaction.description)}
                                          disabled={isInactive}
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
                                        <span className="text-xs px-1">{activity.displayDescription || '—'}</span>
                                      )}
                                    </td>
                                    <td className="border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.category, minWidth: columnWidths.category, maxWidth: columnWidths.category }}>
                                      {transaction ? (
                                        transaction.is_split ? (
                                          <span className="text-xs px-1 text-blue-600 font-medium">Split</span>
                                        ) : transaction.type === 'income' && transaction.original_type === 'expense' ? (
                                          <span className="text-xs px-1 text-emerald-600 font-medium">Refund</span>
                                        ) : activity.entryType === 'transfer' ? (
                                          <span className="text-xs px-1">Bank Transfer</span>
                                        ) : activity.entryType === 'credit_card_payment' ? (
                                          <span className="text-xs px-1">Credit Card Payment</span>
                                        ) : (
                                          <div onClick={(e) => e.stopPropagation()}>
                                            <CategoryDropdown
                                              value={transaction.category_account_id}
                                              matchMode={false}
                                              onValueChange={async (value) => {
                                                if (isInactive) return;
                                                const categoryValue = value === '' ? null : value;
                                                updateMutation.mutate({
                                                  id: transaction.id,
                                                  data: { category_account_id: categoryValue }
                                                });
                                              }}
                                              transactionType={transaction.type}
                                              disabled={isInactive}
                                              onAddNew={(searchTerm) => {
                                                setCategorySearchTerm(searchTerm);
                                                setTriggeringTransactionId(transaction.id);
                                                setAddAccountSheetOpen(true);
                                              }}
                                              triggerClassName="h-7 border-transparent bg-transparent shadow-none hover:border-slate-300 hover:bg-white focus:border-slate-300 focus:bg-white transition-colors text-xs"
                                              placeholder="Select category"
                                              isTransactionTransfer={false}
                                              transactionAmount={transaction.amount}
                                            />
                                          </div>
                                        )
                                      ) : (
                                        <span className="text-xs px-1">{category?.display_name || category?.name || '—'}</span>
                                      )}
                                    </td>
                                    <td className="border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.contact, minWidth: columnWidths.contact, maxWidth: columnWidths.contact }}>
                                      {transaction ? (
                                        activity.entryType === 'transfer' || activity.entryType === 'credit_card_payment' ? (
                                          <span className="text-xs px-1">—</span>
                                        ) : (
                                          <div onClick={(e) => e.stopPropagation()}>
                                            <ContactDropdown
                                              value={transaction.contact_id}
                                              onValueChange={(value) => {
                                                if (isInactive) return;
                                                updateMutation.mutate({
                                                  id: transaction.id,
                                                  data: {
                                                    contact_id: value,
                                                    contact_manually_set: true
                                                  }
                                                });
                                              }}
                                              transactionDescription={transaction.description}
                                              disabled={isInactive}
                                              onAddNew={(searchTerm) => {
                                                setContactSearchTerm(searchTerm);
                                                setTriggeringContactTransactionId(transaction.id);
                                                setAddContactSheetOpen(true);
                                              }}
                                              triggerClassName="h-7 border-transparent bg-transparent shadow-none hover:border-slate-300 hover:bg-white focus:border-slate-300 focus:bg-white transition-colors text-xs"
                                              placeholder="Select contact"
                                            />
                                          </div>
                                        )
                                      ) : (
                                        <span className="text-xs px-1">{contact?.display_name || '—'}</span>
                                      )}
                                    </td>
                                    <td className="text-right text-sm border-r border-slate-200 py-1 pl-1 pr-2 whitespace-nowrap">
                                      {activity.debitAmount > 0 ? formatCurrency(activity.debitAmount) : ''}
                                    </td>
                                    <td className="text-right text-sm border-r border-slate-200 py-1 pl-1 pr-2 whitespace-nowrap">
                                      {activity.creditAmount > 0 ? formatCurrency(activity.creditAmount) : ''}
                                    </td>
                                    <td className="text-right text-sm py-1 pl-1 pr-2 whitespace-nowrap font-semibold">
                                      {formatCurrency(activity.runningBalance)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {totalPages > 1 && (
                          <div className="flex items-center justify-between border-t border-slate-200 pt-3 mt-3">
                            <div className="text-sm text-slate-600">
                              Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, allActivity.length)} of {allActivity.length} transactions
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8"
                              >
                                Previous
                              </Button>
                              <span className="text-sm text-slate-600">
                                Page {currentPage} of {totalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-8"
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="audit" className="mt-0">
                    {auditHistoryLines.length === 0 ? (
                      <p className="text-center text-slate-500 py-6 text-sm">No audit history found</p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="h-8 bg-slate-100">
                              <TableHead className="py-1.5 text-[11px] font-semibold">Date</TableHead>
                              <TableHead className="py-1.5 text-[11px] font-semibold">Action</TableHead>
                              <TableHead className="py-1.5 text-[11px] font-semibold">Description</TableHead>
                              <TableHead className="text-right py-1.5 text-[11px] font-semibold">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {auditHistoryLines.map((line, index) => (
                              <TableRow
                                key={`audit-${line.id || index}`}
                                className={`h-7 ${index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100'}`}
                                onClick={() => setSelectedTransactionForAudit(line)}
                              >
                                <TableCell className="whitespace-nowrap text-[11px] py-1">
                                  {line.changed_at ? format(parseISO(line.changed_at), 'MMM d, yyyy') : '—'}
                                </TableCell>
                                <TableCell className="text-[11px] py-1">
                                  <Badge variant="outline" className="text-[10px] py-0">{line.action || '—'}</Badge>
                                </TableCell>
                                <TableCell className="text-[11px] py-1">{line.description || '—'}</TableCell>
                                <TableCell className="text-right text-[11px] py-1 font-medium">
                                  {line.amount != null ? formatCurrency(line.amount) : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {hasNextAuditPage && (
                          <div className="flex justify-center py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchNextAuditPage()}
                              disabled={isFetchingNextAuditPage}
                              className="text-xs"
                            >
                              {isFetchingNextAuditPage ? 'Loading...' : 'Load more'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </CardContent>
        </CollapsibleContent>
      </Card>

      {selectedJournalEntryId && (
        <JournalEntryDialog
          entryId={selectedJournalEntryId}
          open={!!selectedJournalEntryId}
          onOpenChange={(open) => { if (!open) setSelectedJournalEntryId(null); }}
        />
      )}

      {selectedTransactionForAudit && (
        <AuditHistoryModal
          transaction={selectedTransactionForAudit}
          open={!!selectedTransactionForAudit}
          onOpenChange={(open) => { if (!open) setSelectedTransactionForAudit(null); }}
        />
      )}

      {addContactSheetOpen && (
        <AddContactSheet
          open={addContactSheetOpen}
          onOpenChange={setAddContactSheetOpen}
          initialSearch={contactSearchTerm}
          onContactCreated={(contactId) => {
            if (triggeringContactTransactionId) {
              updateMutation.mutate({
                id: triggeringContactTransactionId,
                data: { contact_id: contactId, contact_manually_set: true }
              });
            }
          }}
        />
      )}

      {addAccountSheetOpen && (
        <AccountCreationWizard
          open={addAccountSheetOpen}
          onOpenChange={setAddAccountSheetOpen}
          initialName={categorySearchTerm}
          onAccountCreated={(accountId) => {
            if (triggeringTransactionId) {
              updateMutation.mutate({
                id: triggeringTransactionId,
                data: { category_account_id: accountId }
              });
            }
          }}
        />
      )}
    </Collapsible>
  );
}
