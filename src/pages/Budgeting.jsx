import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';

import BudgetOverviewCards from '../components/budgeting/BudgetOverviewCards';
import BudgetCategoryList from '../components/budgeting/BudgetCategoryList';
import AddBudgetItemSheet from '../components/budgeting/AddBudgetItemSheet';
import BudgetSetupTab from '../components/budgeting/BudgetSetupTab';

export default function Budgeting() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const { data: budgetGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['budgetGroups'],
    queryFn: () => base44.entities.BudgetGroup.list()
  });

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.Budget.filter({ is_active: true })
  });

  const hasSetupStarted = budgets.length > 0;

  useEffect(() => {
    if (!groupsLoading && !budgetsLoading && !hasSetupStarted) {
      setShowSetupModal(true);
    }
  }, [groupsLoading, budgetsLoading, hasSetupStarted]);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date', 1000)
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true })
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list()
  });



  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Budget.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    }
  });

  // Calculate spending per category for current month
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // Get active account IDs for filtering
  const activeAccountIds = accounts.map(a => a.id);
  
  // Helper to get all child category IDs for a parent
  const getChildCategoryIds = (parentId) => {
    return categories.filter(c => c.parent_account_id === parentId).map(c => c.id);
  };
  
  const currentMonthTransactions = transactions.filter(t => {
    if (!t.date) return false;
    const tDate = new Date(t.date);
    if (isNaN(tDate.getTime())) return false;
    const matchesActiveAccount = activeAccountIds.includes(t.bank_account_id);
    // Exclude transfers from expense calculations
    const isTransfer = t.type === 'transfer';
    return tDate >= monthStart && tDate <= monthEnd && t.type === 'expense' && t.status === 'posted' && matchesActiveAccount && !isTransfer;
  });

  const spendingByCategory = currentMonthTransactions.reduce((acc, t) => {
    // Use special key for uncategorized transactions
    const key = t.category_id || t.category || '__uncategorized__';
    acc[key] = (acc[key] || 0) + t.amount;
    
    // Also add to parent category if this is a subcategory
    const category = categories.find(c => c.id === t.category_id);
    if (category?.parent_account_id) {
      acc[category.parent_account_id] = (acc[category.parent_account_id] || 0) + t.amount;
    }
    
    return acc;
  }, {});

  const currentMonthIncomeTransactions = transactions.filter(t => {
    if (!t.date) return false;
    const tDate = new Date(t.date);
    if (isNaN(tDate.getTime())) return false;
    const matchesActiveAccount = activeAccountIds.includes(t.bank_account_id);
    // Exclude transfers from income calculations
    const isTransfer = t.type === 'transfer';
    return tDate >= monthStart && tDate <= monthEnd && t.type === 'income' && t.status === 'posted' && matchesActiveAccount && !isTransfer;
  });

  const incomeByCategory = currentMonthIncomeTransactions.reduce((acc, t) => {
    // Use special key for uncategorized transactions
    const key = t.category_id || t.category || '__uncategorized_income__';
    acc[key] = (acc[key] || 0) + t.amount;
    
    // Also add to parent category if this is a subcategory
    const category = categories.find(c => c.id === t.category_id);
    if (category?.parent_account_id) {
      acc[category.parent_account_id] = (acc[category.parent_account_id] || 0) + t.amount;
    }
    
    return acc;
  }, {});

  const totalActualIncome = currentMonthIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate budgeted income total (from income budget groups)
  const incomeGroupIds = new Set(budgetGroups.filter(g => g.type === 'income').map(g => g.id));

  console.log('=== INCOME DEBUG ===');
  console.log('Current month income transactions:', currentMonthIncomeTransactions);
  console.log('Income by category:', incomeByCategory);
  console.log('Income budgets:', budgets.filter(b => incomeGroupIds.has(b.group_id)));
  const budgetedIncome = budgets
    .filter(b => incomeGroupIds.has(b.group_id))
    .reduce((sum, b) => sum + (b.limit_amount || 0), 0);

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.limit_amount, 0);
  const totalSpent = Object.values(spendingByCategory).reduce((sum, amt) => sum + amt, 0);

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  if (groupsLoading || budgetsLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="p-0">
      <Dialog open={showSetupModal} onOpenChange={(open) => {
        if (!open && hasSetupStarted) {
          setShowSetupModal(false);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0" onInteractOutside={(e) => {
          if (!hasSetupStarted) {
            e.preventDefault();
          }
        }}>
          <BudgetSetupTab onSetupComplete={() => setShowSetupModal(false)} />
        </DialogContent>
      </Dialog>

      {!showSetupModal && (
        <>
          <div className="bg-white border-b border-slate-200">
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-medium text-slate-900 mb-4">Welcome, User</h2>
              <div className="flex gap-6">
                <button
                  onClick={() => handleTabChange('overview')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'overview'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => handleTabChange('setup')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'setup'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Setup
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'overview' && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Budgeting</h1>
              <p className="text-sm text-slate-500">{format(today, 'MMMM yyyy')}</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Budget
            </Button>
          </div>

          <BudgetOverviewCards 
            totalIncome={totalActualIncome}
            totalBudgeted={totalBudgeted}
            totalSpent={totalSpent}
          />

          {budgetGroups.sort((a, b) => (a.order || 0) - (b.order || 0)).map(group => {
            const groupBudgets = budgets.filter(b => b.group_id === group.id);
            
            const isIncomeGroup = group.type === 'income';
            const dataByCategory = isIncomeGroup ? incomeByCategory : spendingByCategory;
            
            // Calculate unbudgeted amount for this group
            const budgetedCategoryIds = new Set(groupBudgets.map(b => b.category_id));
            const unbudgetedAmount = Object.entries(dataByCategory).reduce((sum, [categoryId, amount]) => {
              // Include uncategorized transactions and categorized transactions without budgets
              if (categoryId === '__uncategorized__' || categoryId === '__uncategorized_income__' || !budgetedCategoryIds.has(categoryId)) {
                return sum + amount;
              }
              return sum;
            }, 0);
            
            // Only show group if it has budgets or unbudgeted transactions
            if (groupBudgets.length === 0 && unbudgetedAmount === 0) return null;
            
            return (
              <Card key={group.id} className="mt-3 shadow-sm border-slate-200">
                <CardHeader className="pb-2 pt-4 px-4">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{group.name}</p>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <BudgetCategoryList
                    budgets={groupBudgets}
                    spendingByCategory={dataByCategory}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isIncome={isIncomeGroup}
                    totalIncome={budgetedIncome}
                    allBudgets={budgets}
                    groups={budgetGroups}
                    unbudgetedAmount={unbudgetedAmount}
                  />
                </CardContent>
              </Card>
            );
          })}

          <AddBudgetItemSheet
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingBudget(null);
            }}
            groups={budgetGroups}
            editingBudget={editingBudget}
            onDelete={handleDelete}
          />
        </div>
      )}

          {activeTab === 'setup' && (
            <BudgetSetupTab />
          )}
        </>
      )}
    </div>
  );
}