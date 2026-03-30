import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { TRANSACTION_TABLE_CONFIG, getRowClassName, getHeaderCellClassName, getBodyCellClassName } from '../common/TransactionTableConfig';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import CategoryDropdown from '../common/CategoryDropdown';
import ContactDropdown from '../common/ContactDropdown';
import { Check, X } from 'lucide-react';

export default function FilteredTransactionsTable({
  transactions = [],
  accounts = [],
  categories = [],
  contacts = [],
  chartAccounts = [],
  filters = null
}) {
  const [editingLineId, setEditingLineId] = useState(null);
  const [editingLine, setEditingLine] = useState(null);
  const [isSavingLine, setIsSavingLine] = useState(false);
  const queryClient = useQueryClient();
  const filteredTransactions = useMemo(() => {
    // Don't show anything if no filters are provided
    if (!filters) {
      return [];
    }

    let filtered = [...transactions];

    // Filter by date if provided
    if (filters.date) {
      filtered = filtered.filter(t => t.date === filters.date);
    }

    // Filter by month if provided
    if (filters.month !== undefined) {
      const today = new Date();
      const targetDate = subMonths(today, parseInt(filters.month));
      const isCurrentMonth = parseInt(filters.month) === 0;
      const currentDay = today.getDate();

      filtered = filtered.filter(t => {
        if (!t.date) return false;
        const tDate = new Date(t.date);
        if (isNaN(tDate.getTime())) return false;

        // Check if transaction is in the target month and year
        const matchesMonth = tDate.getMonth() === targetDate.getMonth() &&
                            tDate.getFullYear() === targetDate.getFullYear();

        if (!matchesMonth) return false;

        // For current month, only include transactions up to today
        if (isCurrentMonth) {
          return tDate.getDate() <= currentDay;
        }

        return true;
      });
    }

    // Filter by account if provided
    if (filters.account && filters.account !== 'all') {
      filtered = filtered.filter(t => t.bank_account_id === filters.account);
    } else if (filters.account === 'all') {
      // Only include active accounts
      const activeAccountIds = accounts.filter(a => a.is_active !== false).map(a => a.id);
      filtered = filtered.filter(t => activeAccountIds.includes(t.bank_account_id));
    }

    // Filter by category (chart account) if provided
    if (filters.category) {
      if (Array.isArray(filters.category)) {
        filtered = filtered.filter(t => filters.category.includes(t.category_account_id));
      } else {
        filtered = filtered.filter(t => t.category_account_id === filters.category);
      }
    }

    // Filter by type (only expenses for spending chart)
    if (filters.type) {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    // Always filter by status
    filtered = filtered.filter(t => t.status === 'posted');

    // Sort by date descending
    filtered.sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });

    return filtered;
  }, [transactions, filters, accounts]);

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown';
  };

  const getCategoryName = (categoryAccountId) => {
    const chartAccount = chartAccounts.find(c => c.id === categoryAccountId);
    return chartAccount?.display_name || chartAccount?.account_detail || 'Uncategorized';
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || '';
  };

  const formatAmount = (transaction) => {
    const amount = transaction.amount || 0;
    const absAmount = Math.abs(amount);
    const sign = transaction.type === 'expense' ? '-' : '';
    const formatted = `${sign}$${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      if (Array.isArray(filters.category)) {
        return 'Other Categories Transactions';
      } else {
        const categoryName = getCategoryName(filters.category);
        return `${categoryName} Transactions`;
      }
    }

    return 'Filtered Transactions';
  };

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => {
      const amount = parseFloat(t.amount) || 0;
      return sum + Math.abs(amount);
    }, 0);
  }, [filteredTransactions]);

  const formatCurrency = (amount) => {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleEditTransaction = (transaction, e) => {
    e.stopPropagation();
    setEditingLineId(transaction.id);
    setEditingLine({
      description: transaction.description || '',
      account_id: transaction.category_account_id || null,
      contact_id: transaction.contact_id || null
    });
  };

  const handleSaveLine = async (transactionId) => {
    if (!editingLine.description.trim()) {
      toast.error('Description is required');
      return;
    }

    const transaction = filteredTransactions.find(t => t.id === transactionId);
    if (!transaction) {
      toast.error('Transaction not found');
      return;
    }

    setIsSavingLine(true);
    try {
      await firstsavvy.entities.Transaction.update(transactionId, {
        description: editingLine.description.trim(),
        category_account_id: editingLine.account_id,
        contact_id: editingLine.contact_id
      });

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaction updated');
      setEditingLineId(null);
      setEditingLine(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction');
    } finally {
      setIsSavingLine(false);
    }
  };

  const handleCancelLine = () => {
    setEditingLineId(null);
    setEditingLine(null);
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
            <p className="text-[10px] text-slate-500">
              Total =
            </p>
            <p className="text-[10px] font-semibold text-slate-900">
              ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            {!filters ? 'Select filters to view transactions' : 'No transactions found for the selected filters'}
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {filteredTransactions.map((transaction, index) => {
                  const isEditing = editingLineId === transaction.id;

                  return (
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
                        {isEditing && editingLine ? (
                          <input
                            type="text"
                            value={editingLine.description}
                            onChange={(e) => setEditingLine(prev => ({ ...prev, description: e.target.value }))}
                            className={TRANSACTION_TABLE_CONFIG.editField.inputClass}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={(e) => handleEditTransaction(transaction, e)}
                            className={TRANSACTION_TABLE_CONFIG.editField.buttonClass}
                          >
                            {transaction.description || '—'}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[3])}>
                        {isEditing && editingLine ? (
                          <ContactDropdown
                            value={editingLine.contact_id}
                            onValueChange={(value) => setEditingLine(prev => ({ ...prev, contact_id: value }))}
                            triggerClassName={TRANSACTION_TABLE_CONFIG.editField.dropdownClass}
                          />
                        ) : (
                          <button
                            onClick={(e) => handleEditTransaction(transaction, e)}
                            className={TRANSACTION_TABLE_CONFIG.editField.buttonClass}
                          >
                            {transaction.contact_id ? getContactName(transaction.contact_id) : '—'}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[4])}>
                        {isEditing && editingLine ? (
                          <CategoryDropdown
                            value={editingLine.account_id}
                            onValueChange={(value) => setEditingLine(prev => ({ ...prev, account_id: value }))}
                            triggerClassName={TRANSACTION_TABLE_CONFIG.editField.dropdownClass}
                            transactionType={transaction.type}
                          />
                        ) : (
                          <button
                            onClick={(e) => handleEditTransaction(transaction, e)}
                            className={TRANSACTION_TABLE_CONFIG.editField.buttonClass}
                          >
                            {transaction.category_account_id ? getCategoryName(transaction.category_account_id) : 'Uncategorized'}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[5])}>
                        {formatAmount(transaction)}
                      </TableCell>
                      <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[6])}>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelLine();
                              }}
                              disabled={isSavingLine}
                              className="text-slate-400 hover:text-slate-600 p-1 disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveLine(transaction.id);
                              }}
                              disabled={isSavingLine}
                              className="text-emerald-500 hover:text-emerald-700 p-1 disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
