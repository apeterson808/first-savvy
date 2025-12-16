import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { startOfMonth, endOfMonth, format } from 'date-fns';

import BudgetOverviewCards from '../components/budgeting/BudgetOverviewCards';
import BudgetCategoryList from '../components/budgeting/BudgetCategoryList';
import BudgetSetupTab from '../components/budgeting/BudgetSetupTab';

export default function Budgeting() {

  const { data: budgetGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['budgetGroups'],
    queryFn: () => base44.entities.BudgetGroup.list()
  });

  const hasSetupStarted = budgetGroups.length > 0;

  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlTab = urlParams.get('tab');
    return urlTab || null;
  });

  useEffect(() => {
    if (!groupsLoading && activeTab === null) {
      const tab = hasSetupStarted ? 'overview' : 'setup';
      const newUrl = `${window.location.pathname}?tab=${tab}`;
      window.history.replaceState({}, '', newUrl);
      setActiveTab(tab);
    }
  }, [groupsLoading, hasSetupStarted, activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      setActiveTab(urlParams.get('tab') || 'overview');
    };
    window.addEventListener('popstate', handlePopState);
    const interval = setInterval(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const currentTab = urlParams.get('tab') || 'overview';
      setActiveTab(prev => prev !== currentTab ? currentTab : prev);
    }, 100);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, []);

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.Budget.filter({ is_active: true })
  });

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
    queryFn: () => base44.entities.Category.list('name')
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

  if (groupsLoading || activeTab === null) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {activeTab === 'overview' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Budgeting</h1>
              <p className="text-sm text-slate-500">{format(today, 'MMMM yyyy')}</p>
            </div>
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

            const budgetedCategoryIds = new Set(groupBudgets.map(b => b.category_id));
            const unbudgetedAmount = Object.entries(dataByCategory).reduce((sum, [categoryId, amount]) => {
              if (categoryId === '__uncategorized__' || categoryId === '__uncategorized_income__' || !budgetedCategoryIds.has(categoryId)) {
                return sum + amount;
              }
              return sum;
            }, 0);

            if (groupBudgets.length === 0 && unbudgetedAmount === 0) return null;

            return (
              <Card key={group.id} className="mt-4 shadow-sm border-slate-200 bg-white">
                <CardHeader className="pb-3 pt-4 px-6">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{group.name}</p>
                </CardHeader>
                <CardContent className="px-6 pb-4">
                  <BudgetCategoryList
                    budgets={groupBudgets}
                    spendingByCategory={dataByCategory}
                    isIncome={isIncomeGroup}
                    unbudgetedAmount={unbudgetedAmount}
                  />
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {activeTab === 'setup' && (
        <div className="-m-3">
          <BudgetSetupTab />
        </div>
      )}
    </div>
  );
}