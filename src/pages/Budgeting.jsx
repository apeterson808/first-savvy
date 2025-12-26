import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { PageTabs } from '@/components/common/PageTabs';

import { useBudgetData } from '@/hooks/useBudgetData';
import BudgetOverviewCards from '../components/budgeting/BudgetOverviewCards';
import BudgetCategoryList from '../components/budgeting/BudgetCategoryList';
import BudgetAllocationDonut from '../components/budgeting/BudgetAllocationDonut';
import BudgetSetupTable from '../components/budgeting/BudgetSetupTable';
import AddBudgetItemSheet from '../components/budgeting/AddBudgetItemSheet';
import EditBudgetGroupSheet from '../components/budgeting/EditBudgetGroupSheet';
import CategoriesTab from '../components/budgeting/CategoriesTab';

export default function Budgeting() {
  const queryClient = useQueryClient();
  const { user, connectionError } = useAuth();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  React.useEffect(() => {
    const handleProfileSwitch = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener('profileSwitched', handleProfileSwitch);
    return () => window.removeEventListener('profileSwitched', handleProfileSwitch);
  }, [queryClient]);

  const {
    budgetGroups,
    budgets,
    transactions,
    categories,
    isLoading,
    hasSetupStarted,
    spendingByCategory,
    incomeByCategory,
    totalActualIncome,
    totalSpent,
    totalBudgeted
  } = useBudgetData();

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

      <PageTabs
        tabs={['overview', 'setup', 'categories']}
        actions={
          activeTab === 'overview' && hasSetupStarted && (
            <Button onClick={() => setAddSheetOpen(true)} size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Budget
            </Button>
          )
        }
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="overview" className="mt-0">
          {!hasSetupStarted ? (
            <div className="min-h-[600px] flex items-center justify-center bg-slate-50/30 rounded-lg border border-slate-200">
              <div className="text-center max-w-xl px-6">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">No Budget Setup Yet</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  Start by going to the Setup tab to create budget groups and budget items.
                </p>
                <Button onClick={() => setActiveTab('setup')} size="lg" className="bg-primary hover:bg-primary/90">
                  Go to Setup
                </Button>
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
            <div className="min-h-[600px] flex items-center justify-center bg-slate-50/30 rounded-lg border border-slate-200">
              <div className="text-center max-w-xl px-6">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">Create Your First Budget</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  Start by creating a budget item. You'll need to select or create a budget group to organize your budget items.
                </p>
                <Button onClick={() => setAddSheetOpen(true)} size="lg" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Budget Item
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Manage Your Budget
              </h2>

              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddSheetOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Budget Item
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
          <CategoriesTab />
        </TabsContent>
      </Tabs>

      <AddBudgetItemSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        groups={budgetGroups}
        categories={categories}
      />

      {editingBudget && (
        <AddBudgetItemSheet
          open={!!editingBudget}
          onOpenChange={(open) => !open && setEditingBudget(null)}
          groups={budgetGroups}
          categories={categories}
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
