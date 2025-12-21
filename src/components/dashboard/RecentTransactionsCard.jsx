import React, { useState, useEffect, useRef } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { format, parseISO } from 'date-fns';
import CategoryDropdown from '../common/CategoryDropdown';
import AddFinancialAccountSheet from '../banking/AddFinancialAccountSheet';
import PlaidLinkButton from '../banking/PlaidLinkButton';
import PlaidImportSimulator from '../banking/PlaidImportSimulator';
import FileImporter from '../banking/FileImporter';
import { sanitizeForLLM } from '../utils/validation';
import { suggestCategory } from '../banking/CategorySuggestion';
import { formatTransactionDescription } from '../utils/formatters';
import { Search, Building2, Upload, FlaskConical } from 'lucide-react';

const POPULAR_INSTITUTIONS = [
  { name: 'Chase', color: 'bg-sky-blue' },
  { name: 'Bank of America', color: 'bg-burgundy' },
  { name: 'Wells Fargo', color: 'bg-burgundy' },
  { name: 'Capital One', color: 'bg-sky-blue' },
  { name: 'American Express', color: 'bg-sky-blue' },
  { name: 'Discover', color: 'bg-orange' },
];

export default function RecentTransactionsCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [autoCategorizingIds, setAutoCategorizingIds] = useState(new Set());
  const [addCategorySheetOpen, setAddCategorySheetOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [plaidSimulatorOpen, setPlaidSimulatorOpen] = useState(false);
  const [fileImporterOpen, setFileImporterOpen] = useState(false);
  const inputRef = useRef(null);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['activeBankAccounts'],
    queryFn: () => firstsavvy.entities.BankAccount.filter({ is_active: true })
  });

  const accounts = bankAccounts;

  const { data: allPendingTransactions = [] } = useQuery({
    queryKey: ['fullPendingTransactions'],
    queryFn: () => firstsavvy.entities.Transaction.filter({ status: 'pending' }, '-date', 10000)
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => firstsavvy.entities.Category.list('name')
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
  const activeAccountIds = accounts.map(a => a.id);
  const pendingTransactions = allPendingTransactions
    .filter(t => activeAccountIds.includes(t.account_id))
    .slice(0, 5);

  useEffect(() => {
    const needsSuggestion = allPendingTransactions
      .filter(t => activeAccountIds.includes(t.account_id))
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
                    ai_suggested_category_id: matchingCategory.id
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

  const filteredInstitutions = POPULAR_INSTITUTIONS.filter(inst =>
    inst.name.toLowerCase().includes(linkSearchTerm.toLowerCase())
  );

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['allAccounts'] });
    queryClient.invalidateQueries({ queryKey: ['activeBankAccounts'] });
    queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
    queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
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
          <div className="py-3">
            <div className="text-center mb-3">
              <p className="text-xs text-slate-600 mb-3">Connect an account to start tracking transactions</p>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search institutions"
                value={linkSearchTerm}
                onChange={(e) => setLinkSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>

            {!linkSearchTerm ? (
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 mb-2">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">POPULAR</h3>
                <div className="grid grid-cols-3 gap-2">
                  {POPULAR_INSTITUTIONS.map((inst) => (
                    <PlaidLinkButton
                      key={inst.name}
                      onSuccess={handleSuccess}
                      className="p-0 h-auto bg-transparent hover:bg-transparent border-0"
                    >
                      <div className="flex flex-col items-center gap-1 group cursor-pointer">
                        <div className={`w-10 h-10 rounded-full ${inst.color} flex items-center justify-center text-white text-sm font-bold group-hover:scale-105 transition-transform`}>
                          {inst.name.charAt(0)}
                        </div>
                        <span className="text-[9px] text-slate-600 text-center leading-tight">{inst.name}</span>
                      </div>
                    </PlaidLinkButton>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 mb-2">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  {filteredInstitutions.length} RESULTS
                </h3>
                {filteredInstitutions.length > 0 ? (
                  <div className="space-y-1">
                    {filteredInstitutions.map((inst) => (
                      <PlaidLinkButton
                        key={inst.name}
                        onSuccess={handleSuccess}
                        className="w-full p-2 bg-white border border-slate-200 rounded hover:border-slate-300 hover:shadow-sm transition-all h-auto justify-start font-normal"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full ${inst.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {inst.name.charAt(0)}
                          </div>
                          <span className="text-xs font-medium text-slate-900">{inst.name}</span>
                        </div>
                      </PlaidLinkButton>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">No institutions found</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-2">
              <PlaidLinkButton
                onSuccess={handleSuccess}
                className="p-2 bg-slate-50 border border-slate-200 rounded hover:border-slate-300 hover:shadow-sm transition-all h-auto justify-start font-normal"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-light-blue/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-sky-blue" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-900">Link Account</span>
                </div>
              </PlaidLinkButton>
              <button
                onClick={() => setFileImporterOpen(true)}
                className="p-2 bg-slate-50 border border-slate-200 rounded hover:border-slate-300 hover:shadow-sm transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-4 h-4 text-teal-600" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-900">Import File</span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setPlaidSimulatorOpen(true)}
              className="w-full p-2 bg-yellow/20 border border-yellow/30 rounded hover:border-yellow/50 hover:shadow-sm transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-yellow/30 flex items-center justify-center flex-shrink-0">
                  <FlaskConical className="w-4 h-4 text-olive" />
                </div>
                <div>
                  <span className="text-[10px] font-medium text-slate-900 block">Simulate Import</span>
                  <span className="text-[9px] text-slate-500">Generate sample data</span>
                </div>
              </div>
            </button>
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
                  <p className="text-[10px] text-slate-500">{format(parseISO(transaction.date), 'MMM d')} · {accounts.find(a => a.id === transaction.account_id)?.account_name || 'N/A'}</p>
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                  {transaction.type === 'expense' ? '-' : '+'}${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      <PlaidImportSimulator
        open={plaidSimulatorOpen}
        onOpenChange={setPlaidSimulatorOpen}
        onImportComplete={handleSuccess}
      />

      <FileImporter
        open={fileImporterOpen}
        onOpenChange={setFileImporterOpen}
        onImportComplete={handleSuccess}
      />
    </Card>
  );
}