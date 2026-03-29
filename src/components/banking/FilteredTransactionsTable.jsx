import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { TRANSACTION_TABLE_CONFIG, getRowClassName, getHeaderCellClassName, getBodyCellClassName } from '../common/TransactionTableConfig';

export default function FilteredTransactionsTable({
  transactions = [],
  accounts = [],
  categories = [],
  contacts = [],
  filters = null
}) {
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Apply filters if provided
    if (filters) {
      // Filter by date if provided
      if (filters.date) {
        filtered = filtered.filter(t => t.date === filters.date);
      }

      // Filter by month if provided
      if (filters.month !== undefined) {
        const targetDate = subMonths(new Date(), parseInt(filters.month));
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);
        const startStr = format(monthStart, 'yyyy-MM-dd');
        const endStr = format(monthEnd, 'yyyy-MM-dd');
        filtered = filtered.filter(t => t.date >= startStr && t.date <= endStr);
      }

      // Filter by account if provided
      if (filters.account && filters.account !== 'all') {
        filtered = filtered.filter(t => t.bank_account_id === filters.account);
      } else if (filters.account === 'all') {
        // Only include active accounts
        const activeAccountIds = accounts.filter(a => a.is_active !== false).map(a => a.id);
        filtered = filtered.filter(t => activeAccountIds.includes(t.bank_account_id));
      }

      // Filter by category if provided
      if (filters.category) {
        filtered = filtered.filter(t => t.category_id === filters.category);
      }

      // Filter by type (only expenses for spending chart)
      if (filters.type) {
        filtered = filtered.filter(t => t.type === filters.type);
      }
    } else {
      // When no filters, only show active accounts
      const activeAccountIds = accounts.filter(a => a.is_active !== false).map(a => a.id);
      filtered = filtered.filter(t => activeAccountIds.includes(t.bank_account_id));
    }

    // Always filter by status
    filtered = filtered.filter(t => t.status === 'posted');

    // Sort by date descending
    filtered.sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });

    // Limit to 50 transactions when no filters are applied
    if (!filters) {
      return filtered.slice(0, 50);
    }

    return filtered;
  }, [transactions, filters, accounts]);

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown';
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || '';
  };

  const formatAmount = (transaction) => {
    const amount = Math.abs(transaction.amount || 0);
    const formatted = `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (transaction.type === 'expense') {
      return <span className="text-red-600 font-medium">{formatted}</span>;
    } else if (transaction.type === 'income') {
      return <span className="text-green-600 font-medium">{formatted}</span>;
    }
    return <span className="font-medium">{formatted}</span>;
  };

  const getStatusBadge = (status) => {
    if (status === 'pending') {
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Pending</Badge>;
    }
    return null;
  };

  const getTitle = () => {
    if (!filters) return 'Recent Transactions';

    if (filters.date) {
      return `Transactions on ${format(new Date(filters.date), 'MMMM d, yyyy')}`;
    }

    if (filters.category) {
      const categoryName = getCategoryName(filters.category);
      return `${categoryName} Transactions`;
    }

    return 'Filtered Transactions';
  };

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  }, [filteredTransactions]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            {getTitle()}
          </p>
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-slate-500">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </p>
            <span className="text-[10px] text-slate-400">•</span>
            <p className={`text-[10px] font-semibold ${totalAmount < 0 ? 'text-red-600' : totalAmount > 0 ? 'text-green-600' : 'text-slate-500'}`}>
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No transactions found for the selected filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={TRANSACTION_TABLE_CONFIG.header.rowClass}>
                  <TableHead className={getHeaderCellClassName(TRANSACTION_TABLE_CONFIG.columns[0])}>
                    Date
                  </TableHead>
                  <TableHead className={getHeaderCellClassName(TRANSACTION_TABLE_CONFIG.columns[1])}>
                    Account
                  </TableHead>
                  <TableHead className={getHeaderCellClassName(TRANSACTION_TABLE_CONFIG.columns[2])}>
                    Description
                  </TableHead>
                  <TableHead className={getHeaderCellClassName(TRANSACTION_TABLE_CONFIG.columns[3])}>
                    From/To
                  </TableHead>
                  <TableHead className={getHeaderCellClassName(TRANSACTION_TABLE_CONFIG.columns[4])}>
                    Category
                  </TableHead>
                  <TableHead className={getHeaderCellClassName(TRANSACTION_TABLE_CONFIG.columns[5])}>
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction, index) => (
                  <TableRow key={transaction.id} className={getRowClassName(index)}>
                    <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[0])}>
                      {transaction.date ? format(new Date(transaction.date), 'MMM d, yyyy') : '—'}
                      {transaction.status === 'pending' && (
                        <span className="ml-1">{getStatusBadge(transaction.status)}</span>
                      )}
                    </TableCell>
                    <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[1])}>
                      <span className="truncate block">
                        {getAccountName(transaction.bank_account_id)}
                      </span>
                    </TableCell>
                    <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[2])}>
                      <span className="line-clamp-1" title={transaction.description}>
                        {transaction.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[3])}>
                      <span className="truncate block">
                        {transaction.contact_id ? getContactName(transaction.contact_id) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[4])}>
                      <span className="truncate block">
                        {transaction.category_id ? getCategoryName(transaction.category_id) : 'Uncategorized'}
                      </span>
                    </TableCell>
                    <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[5])}>
                      {formatAmount(transaction)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
