import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Download, Calendar, Upload } from 'lucide-react';
import { format } from 'date-fns';

export default function Transactions() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('-date');
  const queryClient = useQueryClient();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', sortBy],
    queryFn: () => base44.entities.Transaction.list(sortBy, 1000)
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['activeAccounts'],
    queryFn: async () => {
      const bankAccounts = await base44.entities.BankAccount.filter({ is_active: true });
      return bankAccounts;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDialogOpen(false);
      setEditingTransaction(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Transaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDialogOpen(false);
      setEditingTransaction(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Transaction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      date: formData.get('date'),
      description: formData.get('description'),
      category: formData.get('category'),
      type: formData.get('type'),
      amount: parseFloat(formData.get('amount')),
      bank_account_id: formData.get('bank_account_id'),
      payment_method: formData.get('payment_method'),
      notes: formData.get('notes'),
    };

    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = searchTerm === '' || 
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccount = filterAccount === 'all' || t.bank_account_id === filterAccount;
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchesSearch && matchesAccount && matchesType && matchesCategory;
  });

  const categories = [
    'rent', 'food', 'transportation', 'entertainment', 'shopping',
    'utilities', 'healthcare', 'education', 'insurance', 'salary',
    'investment', 'business_income', 'advertising', 'office_supplies',
    'services', 'other'
  ];

  const getCategoryColor = (category) => {
    const colors = {
      rent: 'bg-amber-100 text-amber-700',
      food: 'bg-orange-100 text-orange-700',
      transportation: 'bg-blue-100 text-blue-700',
      entertainment: 'bg-pink-100 text-pink-700',
      shopping: 'bg-fuchsia-100 text-fuchsia-700',
      utilities: 'bg-yellow-100 text-yellow-700',
      healthcare: 'bg-red-100 text-red-700',
      education: 'bg-green-100 text-green-700',
      insurance: 'bg-teal-100 text-teal-700',
      salary: 'bg-emerald-100 text-emerald-700',
      investment: 'bg-cyan-100 text-cyan-700',
      business_income: 'bg-lime-100 text-lime-700',
      advertising: 'bg-rose-100 text-rose-700',
      office_supplies: 'bg-sky-100 text-sky-700',
      services: 'bg-stone-100 text-stone-700',
      other: 'bg-slate-100 text-slate-700',
    };
    return colors[category] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <p className="text-sm text-slate-600 mt-1">Track and manage all your transactions</p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={() => {
                    setEditingTransaction(null);
                    setDialogOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">
                    <button
                      onClick={() => setSortBy(sortBy === 'date' ? '-date' : 'date')}
                      className="flex items-center hover:text-slate-900"
                    >
                      Date
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Account</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Payment Method</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => {
                    const account = accounts.find(a => a.id === transaction.bank_account_id);
                    return (
                      <TableRow key={transaction.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">
                          {transaction.date && !isNaN(new Date(transaction.date).getTime())
                            ? format(new Date(transaction.date), 'MMM dd, yyyy')
                            : 'Invalid date'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-slate-900">{transaction.description}</div>
                            {transaction.notes && (
                              <div className="text-xs text-slate-500 mt-1">{transaction.notes}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-700">
                            {account?.account_name || 'Unknown'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(transaction.category)}`}>
                            {transaction.category.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600 capitalize">
                            {transaction.payment_method?.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setEditingTransaction(transaction);
                                setDialogOpen(true);
                              }}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm('Delete this transaction?')) {
                                    deleteMutation.mutate(transaction.id);
                                  }
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 p-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>
            <div className="text-sm font-semibold text-slate-900">
              Total: {filteredTransactions.reduce((sum, t) => {
                return sum + (t.type === 'income' ? t.amount : -t.amount);
              }, 0).toFixed(2)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'New Transaction'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={editingTransaction?.date || format(new Date(), 'yyyy-MM-dd')}
                  required
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select name="type" defaultValue={editingTransaction?.type || 'expense'} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                defaultValue={editingTransaction?.description}
                placeholder="e.g., Grocery shopping"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={editingTransaction?.amount}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="bank_account_id">Account</Label>
                <Select name="bank_account_id" defaultValue={editingTransaction?.bank_account_id} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select name="category" defaultValue={editingTransaction?.category || 'other'} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select name="payment_method" defaultValue={editingTransaction?.payment_method || 'card'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={editingTransaction?.notes}
                placeholder="Add any additional details..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingTransaction ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}