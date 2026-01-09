import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Download, Printer, Search, Filter, ExternalLink, FileText
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
import { getUserChartOfAccounts, deleteUserCreatedAccount } from '@/api/chartOfAccounts';
import { getAccountJournalLines } from '@/api/journalEntries';
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
    queryKey: ['account', id, activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return null;

      const chartAccounts = await getUserChartOfAccounts(activeProfile.id);

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

      const allAccounts = chartAccounts.map(c => ({
        ...c,
        entityType: getEntityType(c.class),
        name: getAccountDisplayName(c),
        type: c.class
      }));

      const foundAccount = allAccounts.find(acc => acc.id === id);

      if (!foundAccount) {
        console.log('Account not found. Searching for ID:', id);
        console.log('Available account IDs:', allAccounts.map(a => a.id));
      }

      return foundAccount;
    },
    enabled: !!id && !!activeProfile
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

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'account', id, activeProfile?.id],
    queryFn: async () => {
      if (!id || !account || !activeProfile) return [];

      const { data: txns, error } = await firstsavvy
        .from('transactions')
        .select(`
          *,
          category:user_chart_of_accounts!transactions_category_account_id_fkey(
            id,
            account_number,
            account_name
          )
        `)
        .eq('profile_id', activeProfile.id)
        .eq('bank_account_id', id)
        .order('date', { ascending: true });

      if (error) throw error;

      return txns.map(t => ({
        ...t,
        categoryName: t.category ? `${t.category.account_number} - ${t.category.account_name}` : 'Uncategorized'
      }));
    },
    enabled: !!id && !!account && !!activeProfile && isTransactionBasedAccount
  });

  const { data: journalLines = [], isLoading: journalLinesLoading } = useQuery({
    queryKey: ['journal-lines', 'account', id, activeProfile?.id, dateRange],
    queryFn: async () => {
      if (!id || !activeProfile) return [];
      return await getAccountJournalLines(
        activeProfile.id,
        id,
        formatDateForDb(dateRange.start),
        formatDateForDb(dateRange.end)
      );
    },
    enabled: !!id && !!activeProfile
  });

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
    let combined = [];

    if (isTransactionBasedAccount) {
      // For transaction-based accounts, include both transactions AND opening balance journal entries
      const transactionItems = transactions.map(t => ({
        ...t,
        activityType: 'transaction',
        displayDate: t.date,
        displayDescription: t.description,
        displayAmount: t.amount,
        debitAmount: null,
        creditAmount: null,
        journalEntryId: t.journal_entry_id,
        offsettingAccounts: t.categoryName || 'Uncategorized'
      }));

      // Filter journal lines to only include opening balance entries for transaction-based accounts
      const openingBalanceEntries = journalLines
        .filter(jl => jl.entry_description && jl.entry_description.toLowerCase().includes('opening balance'))
        .map(jl => ({
          ...jl,
          id: jl.line_id,
          activityType: 'journal',
          displayDate: jl.entry_date,
          displayDescription: jl.line_description || jl.entry_description,
          debitAmount: jl.debit_amount,
          creditAmount: jl.credit_amount,
          entryNumber: jl.entry_number,
          journalEntryId: jl.entry_id,
          entryType: 'opening_balance',
          offsettingAccounts: jl.offsetting_accounts
        }));

      // Merge transactions and opening balance entries
      combined = [...openingBalanceEntries, ...transactionItems];
    } else {
      // For GL accounts, show all journal lines
      const journalItems = journalLines.map(jl => ({
        ...jl,
        id: jl.line_id,
        activityType: 'journal',
        displayDate: jl.entry_date,
        displayDescription: jl.line_description || jl.entry_description,
        debitAmount: jl.debit_amount,
        creditAmount: jl.credit_amount,
        entryNumber: jl.entry_number,
        journalEntryId: jl.entry_id,
        entryType: jl.entry_description && jl.entry_description.toLowerCase().includes('opening balance')
          ? 'opening_balance'
          : 'adjustment',
        offsettingAccounts: jl.offsetting_accounts
      }));
      combined = journalItems;
    }

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
      const dateDiff = dateA - dateB;

      // If dates are the same, ensure opening balance entries come first
      if (dateDiff === 0) {
        if (a.entryType === 'opening_balance' && b.entryType !== 'opening_balance') return -1;
        if (a.entryType !== 'opening_balance' && b.entryType === 'opening_balance') return 1;
      }

      return dateDiff;
    });

    const accountClass = account?.account_class || account?.class || 'asset';
    const isDebitNormal = accountClass === 'asset' || accountClass === 'expense';

    let beginningBal = 0;
    let runningBalance = 0;

    const activitiesWithBalance = combined.map(activity => {
      let debit = 0;
      let credit = 0;

      if (activity.activityType === 'journal') {
        debit = activity.debitAmount || 0;
        credit = activity.creditAmount || 0;
      } else {
        const amount = activity.displayAmount || 0;
        if (amount < 0) {
          if (isDebitNormal) {
            credit = Math.abs(amount);
          } else {
            debit = Math.abs(amount);
          }
        } else {
          if (isDebitNormal) {
            debit = Math.abs(amount);
          } else {
            credit = Math.abs(amount);
          }
        }
      }

      if (isDebitNormal) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      return {
        ...activity,
        calculatedDebit: debit,
        calculatedCredit: credit,
        runningBalance
      };
    });

    if (dateRange.start && activitiesWithBalance.length > 0) {
      beginningBal = account?.current_balance || 0;
      const totalChange = activitiesWithBalance[activitiesWithBalance.length - 1].runningBalance;
      beginningBal = beginningBal - totalChange;

      activitiesWithBalance.forEach(activity => {
        activity.runningBalance += beginningBal;
      });
    }

    const endingBal = activitiesWithBalance.length > 0
      ? activitiesWithBalance[activitiesWithBalance.length - 1].runningBalance
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
  }, [transactions, journalLines, account, searchQuery, dateRange, isTransactionBasedAccount]);

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
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/Banking${returnUrl}`)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {!isEditMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  className="gap-2"
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  className="gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditMode(false)}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {account.account_number && (
                    <Badge variant="secondary" className="font-mono">
                      {account.account_number}
                    </Badge>
                  )}
                  <Badge
                    className={
                      isActive
                        ? 'bg-soft-green/30 text-forest-green'
                        : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold">{account.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="capitalize">
                    {accountClass}
                  </Badge>
                  {account.type && (
                    <Badge variant="secondary" className="capitalize text-xs">
                      {account.type}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 mb-1">Current Balance</p>
                <p className={`text-3xl font-bold ${
                  account.entityType === 'Asset' ? 'text-forest-green' :
                  account.entityType === 'Liability' ? 'text-burgundy' :
                  'text-slate-900'
                }`}>
                  {formatCurrency(endingBalance)}
                </p>
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
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {isBankAccount ? (
                    <>
                      {(account.bank_name || account.institution || account.institution_name) && (
                        <div className="flex items-start gap-3">
                          <Building2 className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500">Institution</p>
                            <p className="text-base">{account.bank_name || account.institution || account.institution_name}</p>
                          </div>
                        </div>
                      )}
                      {account.account_type && (
                        <div className="flex items-start gap-3">
                          <Hash className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500">Account Type</p>
                            <p className="text-base capitalize">{account.account_type}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : account.entityType === 'Asset' ? (
                    <>
                      <div className="flex items-start gap-3">
                        <Hash className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-500">Asset Type</p>
                          <p className="text-base capitalize">{account.detail_type?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      {account.detail_type === 'vehicle' && (
                        <>
                          {account.vehicle_make && (
                            <div className="flex items-start gap-3">
                              <Car className="w-5 h-5 text-slate-400 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-slate-500">Make & Model</p>
                                <p className="text-base">{account.vehicle_year} {account.vehicle_make} {account.vehicle_model}</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex items-start gap-3">
                        <DollarSign className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-500">Current Value</p>
                          <p className="text-base">{formatCurrency(account.current_balance || 0)}</p>
                        </div>
                      </div>
                    </>
                  ) : account.entityType === 'Liability' ? (
                    <>
                      <div className="flex items-start gap-3">
                        <Hash className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-500">Liability Type</p>
                          <p className="text-base capitalize">{account.detail_type?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      {(account.institution || account.institution_name) && (
                        <div className="flex items-start gap-3">
                          <Building2 className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500">Lender</p>
                            <p className="text-base">{account.institution || account.institution_name}</p>
                          </div>
                        </div>
                      )}
                      {account.interest_rate && (
                        <div className="flex items-start gap-3">
                          <Hash className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500">Interest Rate</p>
                            <p className="text-base">{account.interest_rate}%</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <Hash className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-500">Type</p>
                          <p className="text-base capitalize">{account.type}</p>
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
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-slate-600" />
                <h2 className="text-xl font-semibold">
                  {account.entityType === 'Asset' ? 'Linked Liabilities' : 'Linked Assets'}
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {linkedAccounts.map((linkedAccount) => (
                  <div
                    key={linkedAccount.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/account/${linkedAccount.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {linkedAccount.entityType === 'Asset' ? (
                          <Car className="w-5 h-5 text-primary" />
                        ) : (
                          <CreditCardIcon className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{linkedAccount.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {linkedAccount.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${linkedAccount.entityType === 'Liability' ? 'text-burgundy' : 'text-forest-green'}`}>
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
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-semibold">Period Summary</h2>
              <div className="flex items-center gap-2">
                <DatePresetDropdown
                  value={datePreset}
                  onValueChange={setDatePreset}
                  triggerClassName="w-48"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {beginningBalance !== null && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <p className="text-sm font-medium">Beginning Balance</p>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(beginningBalance)}</p>
                </div>
              )}

              <div className="p-4 bg-light-blue/20 rounded-lg">
                <div className="flex items-center gap-2 text-sky-blue mb-1">
                  <DollarSign className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Debits</p>
                </div>
                <p className="text-2xl font-bold text-sky-blue">{formatCurrency(analytics.totalDebits)}</p>
              </div>

              <div className="p-4 bg-soft-green/20 rounded-lg">
                <div className="flex items-center gap-2 text-forest-green mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Credits</p>
                </div>
                <p className="text-2xl font-bold text-forest-green">{formatCurrency(analytics.totalCredits)}</p>
              </div>

              <div className="p-4 bg-burgundy/10 rounded-lg">
                <div className="flex items-center gap-2 text-burgundy mb-1">
                  <TrendingDown className="w-4 h-4" />
                  <p className="text-sm font-medium">Net Change</p>
                </div>
                <p className={`text-2xl font-bold ${analytics.netChange >= 0 ? 'text-forest-green' : 'text-burgundy'}`}>
                  {formatCurrency(analytics.netChange)}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <Hash className="w-4 h-4" />
                  <p className="text-sm font-medium">Transactions</p>
                </div>
                <p className="text-2xl font-bold">{analytics.transactionCount}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <p className="text-sm font-medium">Avg Transaction</p>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(analytics.avgTransaction)}</p>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg col-span-2">
                <div className="flex items-center gap-2 text-primary mb-1">
                  <Calendar className="w-4 h-4" />
                  <p className="text-sm font-medium">Ending Balance</p>
                </div>
                <p className="text-2xl font-bold text-primary">{formatCurrency(endingBalance)}</p>
              </div>
            </div>

            {analytics.firstTransaction && analytics.lastTransaction && (
              <div className="mt-4 pt-4 border-t text-sm text-slate-600">
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
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {isTransactionBasedAccount ? 'Transaction Register' : 'General Ledger Activity'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {isTransactionBasedAccount
                    ? 'Showing source transactions (checkbook-style register)'
                    : 'Showing journal entry lines (accounting activity)'
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(transactionsLoading || journalLinesLoading) ? (
              <p className="text-center text-slate-500 py-4">Loading register...</p>
            ) : allActivity.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No activity found</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>{isTransactionBasedAccount ? 'Category' : 'Offsetting Account'}</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allActivity.map((activity, index) => (
                      <TableRow
                        key={`${activity.activityType}-${activity.id || index}`}
                        className={activity.entryType === 'opening_balance' ? 'bg-blue-50/50 hover:bg-blue-50' : ''}
                      >
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(activity.displayDate), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {activity.activityType === 'journal' ? (
                            <Badge
                              variant="outline"
                              className="font-mono text-xs gap-1 cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={() => activity.journalEntryId && setSelectedJournalEntryId(activity.journalEntryId)}
                            >
                              <FileText className="w-3 h-3" />
                              {activity.entryNumber}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">TXN</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{activity.displayDescription}</div>
                          {activity.entryType === 'opening_balance' && (
                            <Badge variant="secondary" className="text-xs mt-1 bg-blue-100 text-blue-700">Opening Balance</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {activity.offsettingAccounts || '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {activity.calculatedDebit > 0 ? formatCurrency(activity.calculatedDebit) : ''}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {activity.calculatedCredit > 0 ? formatCurrency(activity.calculatedCredit) : ''}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(activity.runningBalance)}
                        </TableCell>
                        <TableCell>
                          {activity.journalEntryId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedJournalEntryId(activity.journalEntryId)}
                              className="h-8 w-8 p-0"
                              title="View Journal Entry"
                            >
                              <ExternalLink className="w-4 h-4 text-slate-400" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
