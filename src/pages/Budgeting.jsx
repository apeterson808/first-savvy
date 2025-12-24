import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { format, subMonths } from 'date-fns';
import { Sparkles, Loader2, Plus, Settings, Undo2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

import { useBudgetData } from '@/hooks/useBudgetData';
import BudgetOverviewCards from '../components/budgeting/BudgetOverviewCards';
import BudgetCategoryList from '../components/budgeting/BudgetCategoryList';
import BudgetAllocationDonut from '../components/budgeting/BudgetAllocationDonut';
import BudgetSetupTable from '../components/budgeting/BudgetSetupTable';
import AddBudgetItemSheet from '../components/budgeting/AddBudgetItemSheet';
import EditBudgetGroupSheet from '../components/budgeting/EditBudgetGroupSheet';
import CategoriesManagementTab from '../components/budgeting/CategoriesManagementTab';
import { suggestIconForName } from '../components/utils/iconMapper';

const BUDGET_COLORS = [
  '#AACC96', '#25533F', '#F4BEAE', '#52A5CE', '#FF7BAC',
  '#876029', '#6D1F42', '#D3B6D3', '#EFCE7B', '#B8CEE8',
  '#EF6F3C', '#AFAB23'
];

const getNextColor = (usedColors) => {
  for (const color of BUDGET_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
};

export default function Budgeting() {
  const queryClient = useQueryClient();
  const { user, connectionError } = useAuth();
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || 'overview';
  });

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

  const {
    budgetGroups,
    budgets,
    transactions,
    isLoading,
    hasSetupStarted,
    spendingByCategory,
    incomeByCategory,
    totalActualIncome,
    totalSpent,
    totalBudgeted
  } = useBudgetData();

  const { data: chartAccounts = [], error: chartAccountsError, isLoading: chartAccountsLoading } = useQuery({
    queryKey: ['chart-accounts-income-expense'],
    queryFn: async () => {
      console.log('Fetching chart accounts...');
      const { data, error } = await firstsavvy.auth.getUser();
      if (error || !data?.user) {
        console.error('Auth error when fetching categories:', error);
        throw new Error(error?.message || 'Not authenticated');
      }
      const user = data.user;
      console.log('Authenticated user:', user.id);

      const [income, expense] = await Promise.all([
        firstsavvy.from('user_chart_of_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('account_type', 'income')
          .eq('level', 3)
          .eq('is_active', true)
          .order('account_number'),
        firstsavvy.from('user_chart_of_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('account_type', 'expense')
          .eq('level', 3)
          .eq('is_active', true)
          .order('account_number')
      ]);

      if (income.error) {
        console.error('Error fetching income categories:', income.error);
        throw income.error;
      }
      if (expense.error) {
        console.error('Error fetching expense categories:', expense.error);
        throw expense.error;
      }

      const result = [...(income.data || []), ...(expense.data || [])];
      console.log('Fetched chart accounts:', result.length);
      return result;
    },
    enabled: !!user && !connectionError,
    retry: 1
  });

  const handleAutoCreate = async () => {
    setIsAutoCreating(true);

    try {
      const twelveMonthsAgo = subMonths(new Date(), 12);
      const recentTransactions = transactions.filter(t =>
        new Date(t.date) >= twelveMonthsAgo && t.status === 'posted'
      );

      const expenseSpending = {};
      const incomeSpending = {};

      recentTransactions.forEach(t => {
        if (t.type === 'expense' && t.chart_account_id) {
          expenseSpending[t.chart_account_id] = (expenseSpending[t.chart_account_id] || 0) + t.amount;
        } else if (t.type === 'income' && t.chart_account_id) {
          incomeSpending[t.chart_account_id] = (incomeSpending[t.chart_account_id] || 0) + t.amount;
        }
      });

      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });

      if (Object.keys(incomeSpending).length > 0) {
        const incomeGroup = await firstsavvy.entities.BudgetGroup.create({
          name: 'Income',
          type: 'income',
          order: 0
        });

        const sortedIncomeAccounts = Object.entries(incomeSpending).sort((a, b) => {
          const accountA = chartAccounts.find(c => c.id === a[0]);
          const accountB = chartAccounts.find(c => c.id === b[0]);
          const nameA = accountA?.custom_display_name || accountA?.category || 'Unknown';
          const nameB = accountB?.custom_display_name || accountB?.category || 'Unknown';
          return nameA.localeCompare(nameB);
        });

        let order = 0;
        const usedColors = new Set();
        for (const [chartAccountId, total] of sortedIncomeAccounts) {
          const monthlyAvg = total / 12;
          const rounded = Math.ceil(monthlyAvg / 10) * 10;
          const chartAccount = chartAccounts.find(c => c.id === chartAccountId);
          const displayName = chartAccount?.custom_display_name || chartAccount?.category || 'Unknown';
          const color = chartAccount?.color || getNextColor(usedColors);
          usedColors.add(color);

          await firstsavvy.entities.Budget.create({
            name: displayName,
            chart_account_id: chartAccountId,
            allocated_amount: Math.max(rounded, 10),
            group_id: incomeGroup.id,
            order: order++,
            color,
            icon: chartAccount?.icon || suggestIconForName(displayName),
            is_active: true
          });
        }
      }

      if (Object.keys(expenseSpending).length > 0) {
        const expenseGroup = await firstsavvy.entities.BudgetGroup.create({
          name: 'Expenses',
          type: 'expense',
          order: 1
        });

        const sortedExpenseAccounts = Object.entries(expenseSpending).sort((a, b) => {
          const accountA = chartAccounts.find(c => c.id === a[0]);
          const accountB = chartAccounts.find(c => c.id === b[0]);
          const nameA = accountA?.custom_display_name || accountA?.category || 'Unknown';
          const nameB = accountB?.custom_display_name || accountB?.category || 'Unknown';
          return nameA.localeCompare(nameB);
        });

        let order = 0;
        const usedExpenseColors = new Set();
        for (const [chartAccountId, total] of sortedExpenseAccounts) {
          const monthlyAvg = total / 12;
          const rounded = Math.ceil(monthlyAvg / 10) * 10;
          const chartAccount = chartAccounts.find(c => c.id === chartAccountId);
          const displayName = chartAccount?.custom_display_name || chartAccount?.category || 'Unknown';
          const color = chartAccount?.color || getNextColor(usedExpenseColors);
          usedExpenseColors.add(color);

          await firstsavvy.entities.Budget.create({
            name: displayName,
            chart_account_id: chartAccountId,
            allocated_amount: Math.max(rounded, 10),
            group_id: expenseGroup.id,
            order: order++,
            color,
            icon: chartAccount?.icon || suggestIconForName(displayName),
            is_active: true
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });

      const newUrl = new URL(window.location);
      newUrl.searchParams.set('tab', 'setup');
      window.history.pushState({}, '', newUrl);
      setActiveTab('setup');

      toast.success('Budget created successfully!');
    } catch (error) {
      console.error('Error auto-creating budget:', error);
      toast.error('Failed to create budget');
    } finally {
      setIsAutoCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-3 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  const today = new Date();

  const handleTabChange = (newTab) => {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('tab', newTab);
    window.history.pushState({}, '', newUrl);
    setActiveTab(newTab);
  };

  return (
    <div className="p-4 md:p-6">
      {connectionError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Unable to connect to the database. Please check your internet connection and refresh the page.
            {connectionError && <div className="mt-2 text-xs opacity-80">Error: {connectionError}</div>}
          </AlertDescription>
        </Alert>
      )}

      {!user && !connectionError && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please log in to view your budget information.
          </AlertDescription>
        </Alert>
      )}

      {chartAccountsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Categories</AlertTitle>
          <AlertDescription>
            Unable to load budget categories. This may be due to a database connection issue.
            <div className="mt-2 text-xs opacity-80">Error: {chartAccountsError.message}</div>
          </AlertDescription>
        </Alert>
      )}

      {activeTab === 'overview' && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Budgeting</h1>
            <p className="text-sm text-slate-500">{format(today, 'MMMM yyyy')}</p>
          </div>
          <Button onClick={() => setAddSheetOpen(true)} size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Budget
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsContent value="overview" className="mt-0">
          {!hasSetupStarted ? (
            <div className="min-h-[600px] flex items-center justify-center bg-slate-50/30 rounded-lg">
              <div className="text-center max-w-xl px-6">
                <div className="w-14 h-14 bg-light-blue/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-7 h-7 text-sky-blue" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">Set Up Your Budget</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  {transactions.length > 0
                    ? "We can automatically create budget categories based on your spending and income history from the last 12 months."
                    : "Start by creating budget groups to organize your spending categories."
                  }
                </p>
                <div className="flex gap-3 justify-center">
                  {transactions.length > 0 && (
                    <Button
                      onClick={handleAutoCreate}
                      disabled={isAutoCreating}
                      className="bg-primary hover:bg-primary/90 text-white shadow-sm"
                      size="lg"
                    >
                      {isAutoCreating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Auto-Create from History
                    </Button>
                  )}
                  <Button onClick={() => setAddSheetOpen(true)} variant="outline" size="lg" className="border-slate-300">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Manually
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <BudgetOverviewCards
                totalIncome={totalActualIncome}
                totalBudgeted={totalBudgeted}
                totalSpent={totalSpent}
              />

              {budgetGroups.sort((a, b) => (a.order || 0) - (b.order || 0)).map(group => {
                const groupBudgets = budgets.filter(b => b.group_id === group.id);

                const isIncomeGroup = group.type === 'income';
                const dataByCategory = isIncomeGroup ? incomeByCategory : spendingByCategory;

                const budgetedCategoryIds = new Set(groupBudgets.map(b => b.chart_account_id));
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
        </TabsContent>

        <TabsContent value="setup" className="mt-0">
          {!hasSetupStarted ? (
            <div className="min-h-[600px] flex items-center justify-center bg-slate-50/30 rounded-lg">
              <div className="text-center max-w-xl px-6">
                <div className="w-14 h-14 bg-light-blue/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-7 h-7 text-sky-blue" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">Set Up Your Budget</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  {transactions.length > 0
                    ? "We can automatically create budget categories based on your spending and income history from the last 12 months."
                    : "Start by creating budget groups to organize your spending categories."
                  }
                </p>
                <div className="flex gap-3 justify-center">
                  {transactions.length > 0 && (
                    <Button
                      onClick={handleAutoCreate}
                      disabled={isAutoCreating}
                      className="bg-primary hover:bg-primary/90 text-white shadow-sm"
                      size="lg"
                    >
                      {isAutoCreating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Auto-Create from History
                    </Button>
                  )}
                  <Button onClick={() => setAddSheetOpen(true)} variant="outline" size="lg" className="border-slate-300">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Manually
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Organize Your Budget Categories Into Groups
              </h2>

              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 border-slate-300"
                    >
                      <Undo2 className="h-4 w-4 text-slate-600" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 border-slate-300"
                      onClick={() => setAddSheetOpen(true)}
                    >
                      <Plus className="h-4 w-4 text-slate-600" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 border-slate-300"
                    >
                      <Settings className="h-4 w-4 text-slate-600" />
                    </Button>
                  </div>

                  <BudgetSetupTable
                    budgets={budgets}
                    groups={budgetGroups}
                    onEditBudget={setEditingBudget}
                    onEditGroup={setEditingGroup}
                  />
                </div>

                <div className="w-80 flex-shrink-0">
                  <BudgetAllocationDonut
                    budgets={budgets}
                    groups={budgetGroups}
                    totalIncome={totalActualIncome}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-0">
          <CategoriesManagementTab categories={chartAccounts} transactions={transactions} />
        </TabsContent>
      </Tabs>

      <AddBudgetItemSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        groups={budgetGroups}
      />

      {editingBudget && (
        <AddBudgetItemSheet
          open={!!editingBudget}
          onOpenChange={(open) => !open && setEditingBudget(null)}
          groups={budgetGroups}
          editingBudget={editingBudget}
        />
      )}

      {editingGroup && (
        <EditBudgetGroupSheet
          open={!!editingGroup}
          onOpenChange={(open) => !open && setEditingGroup(null)}
          group={editingGroup}
        />
      )}
    </div>
  );
}
