import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Download, Printer, Search, Filter, ExternalLink, FileText, Minus, Equal
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/utils/formatters';
import IconPicker from '@/components/common/IconPicker';
import ColorPicker from '@/components/common/ColorPicker';
import DatePresetDropdown from '@/components/common/DatePresetDropdown';
import { getAccountWithLinks } from '@/api/vehiclesAndLoans';
import { getAccountDisplayName } from '@/components/utils/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts, deleteUserCreatedAccount, getChartAccountById } from '@/api/chartOfAccounts';
import { getAccountJournalLinesPaginated } from '@/api/journalEntries';
import { getDateRangeFromPreset, formatDateForDb } from '@/utils/dateRangeUtils';
import JournalEntryDialog from '@/components/accounting/JournalEntryDialog';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const [datePreset, setDatePreset] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJournalEntryId, setSelectedJournalEntryId] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeProfile } = useProfile();

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get('from') || '?tab=accounts';

  const dateRange = useMemo(() => getDateRangeFromPreset(datePreset), [datePreset]);

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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (!activeProfile) throw new Error('No active profile');
      return firstsavvy.from('user_chart_of_accounts')
        .update(data)
        .eq('id', id)
        .eq('profile_id', activeProfile.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['equity'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      setIsEditMode(false);
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

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }) => {
      if (!activeProfile) throw new Error('No active profile');
      return firstsavvy.from('user_chart_of_accounts')
        .update({ is_active: !isActive })
        .eq('id', id)
        .eq('profile_id', activeProfile.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['equity'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      toast.success('Account status updated');
    }
  });

  const { allActivity, analytics, beginningBalance, endingBalance } = useMemo(() => {
    const accountClass = account?.account_class || account?.class || 'asset';
    const isDebitNormal = accountClass === 'asset' || accountClass === 'expense';

    // ALL accounts show only posted journal lines (no pending transactions)
    let combined = journalLines.map(jl => ({
      ...jl,
      id: jl.line_id,
      activityType: 'posted',
      displayDate: jl.entry_date,
      displayDescription: jl.line_description || jl.entry_description,
      debitAmount: jl.debit_amount,
      creditAmount: jl.credit_amount,
      entryNumber: jl.entry_number,
      journalEntryId: jl.entry_id,
      entryType: jl.entry_type || 'adjustment',
      offsettingAccounts: jl.offsetting_accounts,
      runningBalance: parseFloat(jl.running_balance || 0)
    }));

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

  // Infinite scroll observer
  const loadMoreRef = useRef();
  const observerCallback = useCallback((entries) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const data = {
      name: formData.get('name'),
      is_active: account.is_active
    };

    if (account.entityType === 'BankAccount') {
      data.bank_name = formData.get('bank_name') || undefined;
      data.account_type = formData.get('account_type') || undefined;
      data.current_balance = parseFloat(formData.get('current_balance')) || 0;
    } else {
      data.icon = formData.get('icon') || undefined;
      data.color = formData.get('color') || undefined;
      data.type = formData.get('type') || undefined;
    }

    updateMutation.mutate({ id: account.id, data });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      deleteMutation.mutate({ id: account.id });
    }
  };

  const handleToggleActive = () => {
    toggleActiveMutation.mutate({
      id: account.id,
      isActive: account.is_active !== false
    });
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

  const isBankAccount = account.entityType === 'BankAccount';
  const isActive = account.is_active !== false;
  const accountClass = account.account_class || account.class || 'Asset';

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
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  className="gap-1.5 h-8 px-2.5"
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
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
                onClick={() => setIsEditMode(false)}
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
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {account.account_number && (
                    <Badge variant="secondary" className="font-mono text-xs h-5">
                      {account.account_number}
                    </Badge>
                  )}
                  <Badge
                    className={
                      isActive
                        ? 'bg-soft-green/30 text-forest-green h-5 text-xs'
                        : 'bg-gray-100 text-gray-800 h-5 text-xs'
                    }
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <h1 className="text-xl font-bold">{account.name}</h1>
                {account.type && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant="secondary" className="capitalize text-xs h-5">
                      {account.type}
                    </Badge>
                  </div>
                )}
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
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Account Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={account.name}
                      placeholder="Account name"
                      required
                    />
                  </div>

                  {isBankAccount ? (
                    <>
                      <div>
                        <Label htmlFor="bank_name">Institution Name</Label>
                        <Input
                          id="bank_name"
                          name="bank_name"
                          defaultValue={account.bank_name || account.institution}
                          placeholder="e.g., Chase, Wells Fargo"
                        />
                      </div>
                      <div>
                        <Label htmlFor="account_type">Account Type</Label>
                        <ClickThroughSelect
                          name="account_type"
                          defaultValue={account.account_type}
                          placeholder="Select type"
                        >
                          <ClickThroughSelectItem value="checking">Checking</ClickThroughSelectItem>
                          <ClickThroughSelectItem value="savings">Savings</ClickThroughSelectItem>
                          <ClickThroughSelectItem value="credit">Credit Card</ClickThroughSelectItem>
                          <ClickThroughSelectItem value="investment">Investment</ClickThroughSelectItem>
                          <ClickThroughSelectItem value="loan">Loan</ClickThroughSelectItem>
                        </ClickThroughSelect>
                      </div>
                      <div>
                        <Label htmlFor="current_balance">Current Balance</Label>
                        <Input
                          id="current_balance"
                          name="current_balance"
                          type="number"
                          step="0.01"
                          defaultValue={account.current_balance || 0}
                          placeholder="0.00"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="type">Category Type</Label>
                        <ClickThroughSelect
                          name="type"
                          defaultValue={account.type}
                          placeholder="Select type"
                        >
                          <ClickThroughSelectItem value="income">Income</ClickThroughSelectItem>
                          <ClickThroughSelectItem value="expense">Expense</ClickThroughSelectItem>
                        </ClickThroughSelect>
                      </div>
                      <div>
                        <Label htmlFor="icon">Icon</Label>
                        <IconPicker name="icon" defaultValue={account.icon} />
                      </div>
                      <div>
                        <Label htmlFor="color">Color</Label>
                        <ColorPicker name="color" defaultValue={account.color} />
                      </div>
                    </>
                  )}
                </div>

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
                        <div className="flex items-start gap-2.5">
                          <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-slate-500">Institution</p>
                            <p className="text-sm">{account.bank_name || account.institution || account.institution_name}</p>
                          </div>
                        </div>
                      )}
                      {account.account_type && (
                        <div className="flex items-start gap-2.5">
                          <Hash className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-slate-500">Account Type</p>
                            <p className="text-sm capitalize">{account.account_type}</p>
                          </div>
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
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  {isTransactionBasedAccount ? 'Account Register' : 'General Ledger Activity'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isTransactionBasedAccount
                    ? 'Posted transactions from journal entries (checkbook-style register)'
                    : 'All journal entry lines for this account (complete accounting activity)'
                  }
                </p>
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
            {journalLinesLoading ? (
              <p className="text-center text-slate-500 py-3 text-sm">Loading register...</p>
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
          </CardContent>
        </Card>

        {selectedJournalEntryId && (
          <JournalEntryDialog
            entryId={selectedJournalEntryId}
            open={!!selectedJournalEntryId}
            onClose={() => setSelectedJournalEntryId(null)}
          />
        )}
      </div>
    </div>
  );
}
