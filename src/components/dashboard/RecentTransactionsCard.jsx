import React, { useState, useEffect, useRef, useMemo } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../pages/utils';
import { format, parseISO } from 'date-fns';
import CategoryDropdown from '../common/CategoryDropdown';
import AccountCreationWizard from '../banking/AccountCreationWizard';
import { sanitizeForLLM } from '../utils/validation';
import { suggestCategory } from '../banking/CategorySuggestion';
import { formatTransactionDescription } from '../utils/formatters';
import { Sparkles, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';

export default function RecentTransactionsCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [addCategorySheetOpen, setAddCategorySheetOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [accountWizardOpen, setAccountWizardOpen] = useState(false);
  const inputRef = useRef(null);

  const { data: chartOfAccounts = [] } = useQuery({
    queryKey: ['activeTransactionalAccounts'],
    queryFn: async () => {
      const allAccounts = await firstsavvy.entities.Account.filter({ is_active: true });
      return allAccounts.filter(acc =>
        ['checking_account', 'savings_account', 'credit_card'].includes(acc.account_detail)
      );
    }
  });

  const accounts = chartOfAccounts;

  const { data: allPendingTransactions = [] } = useQuery({
    queryKey: ['fullPendingTransactions'],
    queryFn: () => firstsavvy.entities.Transaction.filter({ status: 'pending' }, '-date', 10000)
  });

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const accounts = await getUserChartOfAccounts(user.id);
      return accounts.filter(a => a.level === 3);
    },
    enabled: !!user
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['fullPostedTransactions'],
    queryFn: () => firstsavvy.entities.Transaction.filter({ status: 'posted' }, '-date', 10000)
  });

  const { data: categorizationRules = [] } = useQuery({
    queryKey: ['categorizationRules'],
    queryFn: () => firstsavvy.entities.CategorizationRule.list('-priority')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => firstsavvy.entities.Transaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
    }
  });

  // Get AI suggestions for uncategorized transactions
  const activeAccountIds = useMemo(() => accounts.map(a => a.id), [accounts]);

  const pendingTransactions = useMemo(() => {
    return allPendingTransactions
      .filter(t => activeAccountIds.includes(t.bank_account_id))
      .slice(0, 5);
  }, [allPendingTransactions, activeAccountIds]);


  const recentTransactions = pendingTransactions;

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.select();
    }
  }, [editingId]);

  const handleSaveEdit = (transaction) => {
    if (editingValue.trim() && editingValue !== transaction.description) {
      updateMutation.mutate({
        id: transaction.id,
        data: { ...transaction, description: editingValue.trim() }
      });
    }
    setEditingId(null);
    setEditingValue('');
  };

  const handleStartEdit = (transaction) => {
    if (editingId && editingId !== transaction.id) {
      const currentTransaction = recentTransactions.find(t => t.id === editingId);
      if (currentTransaction) {
        handleSaveEdit(currentTransaction);
      }
    }
    setEditingId(transaction.id);
    setEditingValue(transaction.description);
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Recent Transactions</p>
        <Button 
          variant="link" 
          className="text-xs p-0 h-auto"
          style={{ color: '#52A5CE' }}
          onClick={() => navigate(createPageUrl('Banking') + '?tab=transactions')}
        >
          View all
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {recentTransactions.length === 0 ? (
          <div className="py-6 text-center">
            {transactions.length === 0 ? (
              <>
                <div className="mb-4 flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-900 mb-1">Ready to take control of your finances?</p>
                <p className="text-xs text-slate-600 mb-4">Connect your first account to start tracking your money</p>
                <Button
                  onClick={() => setAccountWizardOpen(true)}
                  className="mx-auto"
                  style={{ backgroundColor: '#52A5CE' }}
                >
                  Connect Account
                </Button>
              </>
            ) : (
              <>
                <div className="mb-4 flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-900 mb-1">You're all caught up!</p>
                <p className="text-xs text-slate-600">Everything is categorized and ready to go</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  {editingId === transaction.id ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleSaveEdit(transaction)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditingValue('');
                        }
                      }}
                      autoFocus
                      className="text-xs font-medium text-slate-800 bg-white border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0 max-w-full"
                      style={{ width: `${Math.max(editingValue.length * 7, 100)}px` }}
                    />
                  ) : (
                    <p
                      className="text-xs font-medium text-slate-800 truncate cursor-text"
                      onClick={() => handleStartEdit(transaction)}
                    >
                      {formatTransactionDescription(transaction.description)}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500">{format(parseISO(transaction.date), 'MMM d')} · {accounts.find(a => a.id === transaction.bank_account_id)?.display_name || 'N/A'}</p>
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                  {transaction.type === 'expense' ? '-' : '+'}${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <CategoryDropdown
                  value={transaction.category_account_id}
                  onValueChange={(value) => {
                    updateMutation.mutate({
                      id: transaction.id,
                      data: { ...transaction, category_account_id: value }
                    });
                  }}
                  transactionType={transaction.type}
                  aiSuggestionId={transaction.ai_suggested_chart_account_id}
                  triggerClassName="h-6 text-[10px] w-24 px-1"
                  placeholder="Category"
                  onAddNew={(searchTerm) => {
                    setCategorySearchTerm(searchTerm);
                    setAddCategorySheetOpen(true);
                  }}
                />
                <Button
                  size="sm"
                  className="h-6 text-[10px] px-2 hover:opacity-90"
                  style={{ backgroundColor: '#52A5CE' }}
                  onClick={() => {
                    updateMutation.mutate({
                      id: transaction.id,
                      data: { ...transaction, status: 'posted' }
                    });
                  }}
                >
                  Post
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AccountCreationWizard
        open={accountWizardOpen}
        onOpenChange={setAccountWizardOpen}
        onAccountCreated={handleSuccess}
      />

      <AccountCreationWizard
        open={addCategorySheetOpen}
        onOpenChange={setAddCategorySheetOpen}
        onAccountCreated={() => {
          setCategorySearchTerm('');
          queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
        }}
      />
    </Card>
  );
}