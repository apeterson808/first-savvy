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
        // Filter to only active categories
        const activeCategories = categories.filter(c => c.is_active !== false);
        const categoryList = activeCategories.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type
        }));

        const transactionDescriptions = needsSuggestion.map(t => ({
          id: t.id,
          description: sanitizeForLLM(t.description),
          amount: t.amount,
          type: t.type
        }));

        const incomeCategories = categoryList.filter(c => c.type === 'income');
        const expenseCategories = categoryList.filter(c => c.type === 'expense');

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a financial transaction categorizer. Given these transactions and available categories, assign the most appropriate category to each transaction.

CRITICAL RULE: You MUST match the category type to the transaction type:
- Income transactions can ONLY use income categories
- Expense transactions can ONLY use expense categories

Available Income Categories (use ONLY for income transactions):
${incomeCategories.length > 0 ? incomeCategories.map(c => `- "${c.name}" [ID: ${c.id}]`).join('\n') : '(none available)'}

Available Expense Categories (use ONLY for expense transactions):
${expenseCategories.length > 0 ? expenseCategories.map(c => `- "${c.name}" [ID: ${c.id}]`).join('\n') : '(none available)'}

Transactions to categorize:
${transactionDescriptions.map(t => `- ID: ${t.id}, Description: "${t.description}", Amount: $${t.amount}, Type: ${t.type.toUpperCase()}`).join('\n')}

For each transaction, pick the best matching category from the correct type list.`,
          response_json_schema: {
            type: "object",
            properties: {
              categorizations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    transaction_id: { type: "string" },
                    category_id: { type: "string" }
                  },
                  required: ["transaction_id", "category_id"]
                }
              }
            },
            required: ["categorizations"]
          }
        });
        
        if (result.categorizations) {
          // Save AI suggestions to the transaction entity
          for (const cat of result.categorizations) {
            const transaction = needsSuggestion.find(t => t.id === cat.transaction_id);
            if (!transaction) continue;

            let categoryId = cat.category_id;
            const suggestedCat = categoryId ? categories.find(c => c.id === categoryId) : null;

            // If no valid suggestion or type mismatch, use default for income
            if (!suggestedCat || suggestedCat.type !== transaction.type) {
              if (transaction.type === 'income') {
                const otherIncome = categories.find(c => c.name === 'Other Income' && c.type === 'income' && c.is_active !== false);
                categoryId = otherIncome?.id;
              } else {
                categoryId = null; // Skip expense transactions with no valid match
              }
            }

            if (categoryId) {
              updateMutation.mutate({
                id: cat.transaction_id,
                data: { 
                  ai_suggested_category_id: categoryId,
                  // Only auto-populate category if not already set
                  ...(transaction.category_id ? {} : { category_id: categoryId })
                }
              });
            }
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