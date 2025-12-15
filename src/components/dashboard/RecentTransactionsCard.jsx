import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { format, parseISO } from 'date-fns';
import CategoryDropdown from '../common/CategoryDropdown';
import AddFinancialAccountSheet from '../banking/AddFinancialAccountSheet';
import { sanitizeForLLM } from '../utils/validation';
import { suggestCategory } from '../banking/CategorySuggestion';

export default function RecentTransactionsCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [autoCategorizingIds, setAutoCategorizingIds] = useState(new Set());
  const [addCategorySheetOpen, setAddCategorySheetOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['activeBankAccounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true })
  });

  const { data: creditCards = [] } = useQuery({
    queryKey: ['activeCreditCards'],
    queryFn: () => base44.entities.CreditCard.filter({ is_active: true })
  });

  // Filter out BankAccounts with account_type='credit_card' to avoid duplicates with CreditCard entities
  const filteredBankAccounts = bankAccounts.filter(a => a.account_type !== 'credit_card');
  const accounts = [...filteredBankAccounts, ...creditCards];

  const { data: allPendingTransactions = [] } = useQuery({
    queryKey: ['fullPendingTransactions'],
    queryFn: () => base44.entities.Transaction.filter({ status: 'pending' }, '-date', 10000)
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name')
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['fullPostedTransactions'],
    queryFn: () => base44.entities.Transaction.filter({ status: 'posted' }, '-date', 10000)
  });

  const { data: categorizationRules = [] } = useQuery({
    queryKey: ['categorizationRules'],
    queryFn: () => base44.entities.CategorizationRule.list('-priority')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Transaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
    }
  });

  // Get AI suggestions for uncategorized transactions
  const activeAccountIds = accounts.map(a => a.id);
  const pendingTransactions = allPendingTransactions
    .filter(t => activeAccountIds.includes(t.bank_account_id))
    .slice(0, 5);

  useEffect(() => {
    const needsSuggestion = allPendingTransactions
      .filter(t => activeAccountIds.includes(t.bank_account_id))
      .filter(t => !t.ai_suggested_category_id && !autoCategorizingIds.has(t.id));
    
    if (needsSuggestion.length === 0 || categories.length === 0) return;

    // Mark as being processed
    setAutoCategorizingIds(prev => {
      const next = new Set(prev);
      needsSuggestion.forEach(t => next.add(t.id));
      return next;
    });

    const getSuggestions = async () => {
      try {
        for (const transaction of needsSuggestion) {
          try {
            const suggestion = await suggestCategory(
              transaction.description,
              transactions,
              categorizationRules,
              transaction.amount
            );

            if (suggestion && suggestion.category) {
              const matchingCategory = categories.find(c =>
                c.name.toLowerCase() === suggestion.category.toLowerCase() &&
                c.type === suggestion.type
              );

              if (matchingCategory) {
                updateMutation.mutate({
                  id: transaction.id,
                  data: {
                    ai_suggested_category_id: matchingCategory.id,
                    ...(transaction.category_id ? {} : { category_id: matchingCategory.id })
                  }
                });
              }
            }
          } catch (err) {
            console.error(`Failed to categorize transaction ${transaction.id}:`, err);
          }
        }
      } catch (err) {
        console.error('Auto-categorize error:', err);
      }
    };

    getSuggestions();
  }, [allPendingTransactions.length, categories.length]);

  const recentTransactions = pendingTransactions;

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
          <div className="text-center py-4 text-slate-500 text-sm">
            No pending transactions
          </div>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate">{transaction.description}</p>
                  <p className="text-[10px] text-slate-500">{format(parseISO(transaction.date), 'MMM d')} · {accounts.find(a => a.id === transaction.bank_account_id)?.account_name || 'N/A'}</p>
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                  {transaction.type === 'expense' ? '-' : '+'}${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <CategoryDropdown
                  value={transaction.category_id}
                  onValueChange={(value) => {
                    updateMutation.mutate({
                      id: transaction.id,
                      data: { ...transaction, category_id: value }
                    });
                  }}
                  transactionType={transaction.type}
                  aiSuggestionId={transaction.ai_suggested_category_id}
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

      <AddFinancialAccountSheet
        open={addCategorySheetOpen}
        onOpenChange={setAddCategorySheetOpen}
        mode="category"
        initialCategoryName={categorySearchTerm}
        onAccountCreated={() => {
          setCategorySearchTerm('');
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        }}
      />
    </Card>
  );
}