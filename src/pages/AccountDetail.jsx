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
import { Building2, Hash, DollarSign, Calendar, Edit2, Save, X, Trash2, ArrowLeft, TrendingUp, TrendingDown, Link2, Car, CreditCard as CreditCardIcon, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/utils/formatters';
import IconPicker from '@/components/common/IconPicker';
import ColorPicker from '@/components/common/ColorPicker';
import { getAccountWithLinks } from '@/api/vehiclesAndLoans';
import { getAccountDisplayName } from '@/components/utils/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts, deleteUserCreatedAccount } from '@/api/chartOfAccounts';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeProfile } = useProfile();

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get('from') || '?tab=accounts';

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      const accounts = await firstsavvy.entities.Account.list();
      const chartAccounts = user ? await getUserChartOfAccounts(user.id) : [];
      const assets = await firstsavvy.entities.Asset.list();
      const liabilities = await firstsavvy.entities.Liability.list();
      const equity = await firstsavvy.entities.Equity.list();

      const allAccounts = [
        ...accounts.map(a => ({
          ...a,
          entityType: a.account_type === 'credit_card' ? 'CreditCard' : 'BankAccount'
        })),
        ...chartAccounts.map(c => ({
          ...c,
          entityType: c.class === 'income' ? 'Income' : 'Expense',
          name: getAccountDisplayName(c),
          type: c.class
        })),
        ...assets.map(a => ({ ...a, entityType: 'Asset' })),
        ...liabilities.map(l => ({ ...l, entityType: 'Liability' })),
        ...equity.map(e => ({ ...e, entityType: 'Equity' }))
      ];

      return allAccounts.find(acc => acc.id === id);
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

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'account', id],
    queryFn: async () => {
      if (!id || !account) return [];
      const allTransactions = await firstsavvy.entities.Transaction.list('date', 'desc');

      if (account.entityType === 'BankAccount') {
        return allTransactions.filter(t => t.bank_account_id === id);
      } else {
        return allTransactions.filter(t => t.chart_account_id === id);
      }
    },
    enabled: !!id && !!account
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, entityType }) => {
      if (entityType === 'BankAccount' || entityType === 'CreditCard' || entityType === 'Account') {
        return firstsavvy.entities.Account.update(id, data);
      } else if (entityType === 'Asset') {
        return firstsavvy.entities.Asset.update(id, data);
      } else if (entityType === 'Liability') {
        return firstsavvy.entities.Liability.update(id, data);
      } else if (entityType === 'Equity') {
        return firstsavvy.entities.Equity.update(id, data);
      } else if (entityType === 'Income' || entityType === 'Expense') {
        if (!activeProfile) throw new Error('No active profile');
        return firstsavvy.from('user_chart_of_accounts')
          .update(data)
          .eq('id', id)
          .eq('profile_id', activeProfile.id);
      } else {
        throw new Error('Unknown entity type');
      }
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
    mutationFn: async ({ id, entityType }) => {
      if (entityType === 'BankAccount' || entityType === 'CreditCard' || entityType === 'Account') {
        return firstsavvy.entities.Account.delete(id);
      } else if (entityType === 'Asset') {
        return firstsavvy.entities.Asset.delete(id);
      } else if (entityType === 'Liability') {
        return firstsavvy.entities.Liability.delete(id);
      } else if (entityType === 'Equity') {
        return firstsavvy.entities.Equity.delete(id);
      } else if (entityType === 'Income' || entityType === 'Expense') {
        if (!user) throw new Error('User not authenticated');
        return deleteUserCreatedAccount(user.id, id);
      } else {
        throw new Error('Unknown entity type');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['equity'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      toast.success('Account deleted');
      navigate(`/banking${returnUrl}`);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
      toast.error(`Failed to delete account: ${error.message}`);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, entityType, isActive }) => {
      if (entityType === 'BankAccount' || entityType === 'CreditCard' || entityType === 'Account') {
        return firstsavvy.entities.Account.update(id, { is_active: !isActive });
      } else if (entityType === 'Asset') {
        return firstsavvy.entities.Asset.update(id, { is_active: !isActive });
      } else if (entityType === 'Liability') {
        return firstsavvy.entities.Liability.update(id, { is_active: !isActive });
      } else if (entityType === 'Equity') {
        return firstsavvy.entities.Equity.update(id, { is_active: !isActive });
      } else if (entityType === 'Income' || entityType === 'Expense') {
        if (!activeProfile) throw new Error('No active profile');
        return firstsavvy.from('user_chart_of_accounts')
          .update({ is_active: !isActive })
          .eq('id', id)
          .eq('profile_id', activeProfile.id);
      } else {
        throw new Error('Unknown entity type');
      }
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

  const analytics = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        totalInflow: 0,
        totalOutflow: 0,
        transactionCount: 0,
        avgTransaction: 0,
        firstTransaction: null,
        lastTransaction: null
      };
    }

    const inflow = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const outflow = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const sortedByDate = [...transactions].sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    return {
      totalInflow: inflow,
      totalOutflow: outflow,
      transactionCount: transactions.length,
      avgTransaction: transactions.length > 0 ? (inflow + outflow) / transactions.length : 0,
      firstTransaction: sortedByDate[0]?.date,
      lastTransaction: sortedByDate[sortedByDate.length - 1]?.date
    };
  }, [transactions]);

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

    updateMutation.mutate({ id: account.id, data, entityType: account.entityType });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      deleteMutation.mutate({ id: account.id, entityType: account.entityType });
    }
  };

  const handleToggleActive = () => {
    toggleActiveMutation.mutate({
      id: account.id,
      entityType: account.entityType,
      isActive: account.is_active !== false
    });
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
            <Button onClick={() => navigate(`/banking${returnUrl}`)} variant="outline">
              Back to Accounts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isBankAccount = account.entityType === 'BankAccount';
  const isActive = account.is_active !== false;

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/banking${returnUrl}`)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Accounts
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {!isEditMode ? (
              <>
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
                <h1 className="text-3xl font-bold">{account.name}</h1>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="capitalize">
                    {isBankAccount ? 'Bank Account' :
                     account.entityType === 'CreditCard' ? 'Credit Card' :
                     account.entityType === 'Asset' ? 'Asset' :
                     account.entityType === 'Liability' ? 'Liability' :
                     account.entityType === 'Equity' ? 'Equity' :
                     account.type}
                  </Badge>
                  {(account.type && account.entityType !== 'Income' && account.entityType !== 'Expense') && (
                    <Badge variant="secondary" className="capitalize text-xs">
                      {account.type}
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
              </div>
              {(isBankAccount || account.entityType === 'Asset' || account.entityType === 'Liability' || account.entityType === 'Equity') && (
                <div className="text-right">
                  <p className="text-sm text-slate-500">
                    {account.entityType === 'Asset' ? 'Current Value' :
                     account.entityType === 'Liability' ? 'Amount Owed' :
                     account.entityType === 'Equity' ? 'Current Value' :
                     'Current Balance'}
                  </p>
                  <p className={`text-3xl font-bold ${
                    account.entityType === 'Liability' ? 'text-burgundy' :
                    account.entityType === 'Asset' ? 'text-forest-green' :
                    'text-slate-900'
                  }`}>
                    {formatCurrency(account.current_balance || 0)}
                  </p>
                </div>
              )}
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
                          {account.vehicle_type && (
                            <div className="flex items-start gap-3">
                              <Hash className="w-5 h-5 text-slate-400 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-slate-500">Vehicle Type</p>
                                <p className="text-base capitalize">{account.vehicle_type}</p>
                              </div>
                            </div>
                          )}
                          {account.vin && (
                            <div className="flex items-start gap-3">
                              <Hash className="w-5 h-5 text-slate-400 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-slate-500">VIN</p>
                                <p className="text-base font-mono">{account.vin}</p>
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
                      <div className="flex items-start gap-3">
                        <DollarSign className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-500">Current Balance</p>
                          <p className="text-base text-burgundy">{formatCurrency(account.current_balance || 0)}</p>
                        </div>
                      </div>
                      {account.interest_rate && (
                        <div className="flex items-start gap-3">
                          <Hash className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500">Interest Rate</p>
                            <p className="text-base">{account.interest_rate}%</p>
                          </div>
                        </div>
                      )}
                      {account.monthly_payment && (
                        <div className="flex items-start gap-3">
                          <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500">Monthly Payment</p>
                            <p className="text-base">{formatCurrency(account.monthly_payment)}</p>
                          </div>
                        </div>
                      )}
                      {account.payment_due_date && (
                        <div className="flex items-start gap-3">
                          <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500">Payment Due Date</p>
                            <p className="text-base">Day {account.payment_due_date} of each month</p>
                          </div>
                        </div>
                      )}
                      {account.original_loan_amount && (
                        <div className="flex items-start gap-3">
                          <DollarSign className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500">Original Loan Amount</p>
                            <p className="text-base">{formatCurrency(account.original_loan_amount)}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : account.entityType === 'Equity' ? (
                    <>
                      <div className="flex items-start gap-3">
                        <Hash className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-500">Equity Type</p>
                          <p className="text-base capitalize">{account.type}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <DollarSign className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-slate-500">Current Value</p>
                          <p className="text-base">{formatCurrency(account.current_balance || 0)}</p>
                        </div>
                      </div>
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

        {(account.entityType === 'Asset' || account.entityType === 'Liability') && (
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
              {linkedAccountsLoading ? (
                <div className="text-center py-4 text-slate-500">
                  Loading linked accounts...
                </div>
              ) : linkedAccounts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Link2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">No linked accounts</p>
                  <p className="text-sm mt-1">
                    {account.entityType === 'Asset'
                      ? 'This asset is not currently linked to any loans or liabilities.'
                      : 'This liability is not currently secured by any assets.'}
                  </p>
                </div>
              ) : (
                <>
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
                              {linkedAccount.institution && (
                                <span className="text-xs text-slate-500">{linkedAccount.institution}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-semibold ${linkedAccount.entityType === 'Liability' ? 'text-burgundy' : 'text-forest-green'}`}>
                            {formatCurrency(linkedAccount.current_balance || 0)}
                          </p>
                          {linkedAccount.monthly_payment && (
                            <p className="text-sm text-slate-500 mt-1">
                              {formatCurrency(linkedAccount.monthly_payment)}/mo
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {account.entityType === 'Liability' && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        onClick={() => {
                          toast.info('Payment feature coming soon');
                        }}
                        className="w-full gap-2"
                      >
                        <Wallet className="w-4 h-4" />
                        Make Payment
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Transaction Analytics</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <Hash className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Transactions</p>
                </div>
                <p className="text-2xl font-bold">{analytics.transactionCount}</p>
              </div>

              <div className="p-4 bg-soft-green/20 rounded-lg">
                <div className="flex items-center gap-2 text-forest-green mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Inflow</p>
                </div>
                <p className="text-2xl font-bold text-forest-green">{formatCurrency(analytics.totalInflow)}</p>
              </div>

              <div className="p-4 bg-burgundy/10 rounded-lg">
                <div className="flex items-center gap-2 text-burgundy mb-1">
                  <TrendingDown className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Outflow</p>
                </div>
                <p className="text-2xl font-bold text-burgundy">{formatCurrency(analytics.totalOutflow)}</p>
              </div>

              <div className="p-4 bg-light-blue/20 rounded-lg">
                <div className="flex items-center gap-2 text-sky-blue mb-1">
                  <DollarSign className="w-4 h-4" />
                  <p className="text-sm font-medium">Avg Transaction</p>
                </div>
                <p className="text-2xl font-bold text-sky-blue">{formatCurrency(analytics.avgTransaction)}</p>
              </div>
            </div>

            {analytics.firstTransaction && (
              <div className="mb-6 pb-6 border-b text-sm text-slate-600">
                <p>
                  First transaction: <span className="font-medium">{format(new Date(analytics.firstTransaction), 'MMM d, yyyy')}</span>
                  {analytics.lastTransaction && (
                    <> • Last transaction: <span className="font-medium">{format(new Date(analytics.lastTransaction), 'MMM d, yyyy')}</span></>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Recent Transactions</h2>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <p className="text-center text-slate-500 py-4">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No transactions found for this account</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 20).map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{format(new Date(transaction.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{transaction.description}</TableCell>
                        <TableCell className="capitalize">
                          <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'}>
                            {transaction.type === 'income' && transaction.original_type === 'expense' ? 'refund' : transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
