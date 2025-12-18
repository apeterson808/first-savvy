import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
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
import { Building2, Hash, DollarSign, Calendar, Edit2, Save, X, Trash2, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/utils/formatters';
import IconPicker from '@/components/common/IconPicker';
import ColorPicker from '@/components/common/ColorPicker';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const queryClient = useQueryClient();

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      const bankAccounts = await base44.entities.BankAccount.list();
      const categories = await base44.entities.Category.list();
      const allAccounts = [...bankAccounts, ...categories];
      return allAccounts.find(acc => acc.id === id);
    },
    enabled: !!id
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'account', id],
    queryFn: async () => {
      if (!id || !account) return [];
      const allTransactions = await base44.entities.Transaction.list('date', 'desc');

      if (account.entityType === 'BankAccount') {
        return allTransactions.filter(t => t.account_id === id);
      } else {
        return allTransactions.filter(t => t.category_id === id);
      }
    },
    enabled: !!id && !!account
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, entityType }) => {
      if (entityType === 'BankAccount') {
        return base44.entities.BankAccount.update(id, data);
      } else {
        return base44.entities.Category.update(id, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', id] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
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
      if (entityType === 'BankAccount') {
        return base44.entities.BankAccount.delete(id);
      } else {
        return base44.entities.Category.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Account deleted');
      navigate('/banking?tab=accounts');
    },
    onError: (error) => {
      console.error('Delete failed:', error);
      toast.error(`Failed to delete account: ${error.message}`);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, entityType, isActive }) => {
      if (entityType === 'BankAccount') {
        return base44.entities.BankAccount.update(id, { is_active: !isActive });
      } else {
        return base44.entities.Category.update(id, { is_active: !isActive });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', id] });
      queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
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
            <Button onClick={() => navigate('/banking?tab=accounts')} variant="outline">
              Back to Banking
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isBankAccount = account.entityType === 'BankAccount';
  const isActive = account.is_active !== false;

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/banking?tab=accounts')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Banking
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
                    {isBankAccount ? 'Bank Account' : account.type}
                  </Badge>
                  <Badge
                    className={
                      isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              {isBankAccount && (
                <div className="text-right">
                  <p className="text-sm text-slate-500">Current Balance</p>
                  <p className="text-3xl font-bold text-slate-900">
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
                  <Button type="submit" className="gap-2 bg-blue-600 hover:bg-blue-700">
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
                      {(account.bank_name || account.institution) && (
                        <div className="flex items-start gap-3">
                          <Building2 className="w-5 h-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500">Institution</p>
                            <p className="text-base">{account.bank_name || account.institution}</p>
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

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Inflow</p>
                </div>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(analytics.totalInflow)}</p>
              </div>

              <div className="p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 mb-1">
                  <TrendingDown className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Outflow</p>
                </div>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(analytics.totalOutflow)}</p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <p className="text-sm font-medium">Avg Transaction</p>
                </div>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(analytics.avgTransaction)}</p>
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
                            {transaction.type}
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
