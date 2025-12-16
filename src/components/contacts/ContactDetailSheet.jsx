import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Phone, MapPin, Tag, FileText, TrendingUp, DollarSign, Hash, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function ContactDetailSheet({ contact, open, onOpenChange }) {
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'contact', contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const allTransactions = await base44.entities.Transaction.list('date', 'desc');
      return allTransactions.filter(t =>
        t.merchant?.toLowerCase().includes(contact.name.toLowerCase()) ||
        t.description?.toLowerCase().includes(contact.name.toLowerCase())
      );
    },
    enabled: !!contact?.id && open,
  });

  const { data: category } = useQuery({
    queryKey: ['category', contact?.default_category_id],
    queryFn: () => base44.entities.Category.get(contact.default_category_id),
    enabled: !!contact?.default_category_id,
  });

  const analytics = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        totalSpent: 0,
        totalIncome: 0,
        transactionCount: 0,
        averageTransaction: 0,
        lastTransaction: null,
        firstTransaction: null,
      };
    }

    const expenses = transactions.filter(t => t.type === 'expense');
    const income = transactions.filter(t => t.type === 'income');

    const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);
    const totalIncome = income.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const avgTransaction = transactions.length > 0 ? totalSpent / expenses.length : 0;

    const sortedByDate = [...transactions].sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    return {
      totalSpent,
      totalIncome,
      transactionCount: transactions.length,
      averageTransaction: avgTransaction,
      lastTransaction: sortedByDate[0],
      firstTransaction: sortedByDate[sortedByDate.length - 1],
    };
  }, [transactions]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (!contact) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl">{contact.name}</SheetTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="capitalize">
              {contact.type}
            </Badge>
            {contact.status && (
              <Badge
                className={
                  contact.status.toLowerCase() === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }
              >
                {contact.status}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Email</p>
                    <p className="text-sm">{contact.email}</p>
                  </div>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Phone</p>
                    <p className="text-sm">{contact.phone}</p>
                  </div>
                </div>
              )}

              {contact.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Address</p>
                    <p className="text-sm whitespace-pre-line">{contact.address}</p>
                  </div>
                </div>
              )}

              {category && (
                <div className="flex items-start gap-3">
                  <Tag className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Default Category</p>
                    <div className="flex items-center gap-2 mt-1">
                      {category.icon && (
                        <span className="text-sm">{category.icon}</span>
                      )}
                      <span className="text-sm">{category.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {contact.notes && (
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Notes</p>
                    <p className="text-sm whitespace-pre-line">{contact.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Spending Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <p className="text-sm text-slate-500">Loading analytics...</p>
              ) : analytics.transactionCount === 0 ? (
                <p className="text-sm text-slate-500">No transactions found for this contact</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <DollarSign className="w-4 h-4" />
                      <p className="text-xs uppercase tracking-wide">Total Spent</p>
                    </div>
                    <p className="text-xl font-semibold text-red-600">
                      {formatCurrency(analytics.totalSpent)}
                    </p>
                  </div>

                  {analytics.totalIncome > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-500">
                        <TrendingUp className="w-4 h-4" />
                        <p className="text-xs uppercase tracking-wide">Total Income</p>
                      </div>
                      <p className="text-xl font-semibold text-green-600">
                        {formatCurrency(analytics.totalIncome)}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Hash className="w-4 h-4" />
                      <p className="text-xs uppercase tracking-wide">Transactions</p>
                    </div>
                    <p className="text-xl font-semibold">
                      {analytics.transactionCount}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <DollarSign className="w-4 h-4" />
                      <p className="text-xs uppercase tracking-wide">Average</p>
                    </div>
                    <p className="text-xl font-semibold">
                      {formatCurrency(analytics.averageTransaction)}
                    </p>
                  </div>

                  {analytics.lastTransaction && (
                    <div className="space-y-1 col-span-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="w-4 h-4" />
                        <p className="text-xs uppercase tracking-wide">Last Transaction</p>
                      </div>
                      <p className="text-sm">
                        {format(new Date(analytics.lastTransaction.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Recent Transactions ({transactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <p className="text-sm text-slate-500">Loading transactions...</p>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-slate-500">No transactions found</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-9">
                        <TableHead className="h-9">Date</TableHead>
                        <TableHead className="h-9">Description</TableHead>
                        <TableHead className="text-right h-9">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.slice(0, 10).map((transaction) => (
                        <TableRow key={transaction.id} className="h-11">
                          <TableCell className="py-2 text-sm">
                            {format(new Date(transaction.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="py-2">
                            <div>
                              <p className="text-sm font-medium">
                                {transaction.merchant || transaction.description}
                              </p>
                              {transaction.merchant && transaction.merchant !== transaction.description && (
                                <p className="text-xs text-slate-500">{transaction.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`text-sm font-medium ${
                              transaction.type === 'expense'
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}>
                              {transaction.type === 'expense' ? '-' : '+'}
                              {formatCurrency(Math.abs(parseFloat(transaction.amount) || 0))}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {transactions.length > 10 && (
                    <div className="p-3 text-center border-t">
                      <p className="text-xs text-slate-500">
                        Showing 10 of {transactions.length} transactions
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
