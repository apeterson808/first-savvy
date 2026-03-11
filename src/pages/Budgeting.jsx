import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Plus, AlertCircle, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { PageTabs } from '@/components/common/PageTabs';
import { format, subMonths, startOfMonth } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';

import { useBudgetData } from '@/hooks/useBudgetData';
import BudgetTrackerContainer from '../components/budgeting/BudgetTrackerContainer';
import AddBudgetItemSheet from '../components/budgeting/AddBudgetItemSheet';
import CategoriesTab from '../components/budgeting/CategoriesTab';
import BudgetLinearBar from '../components/budgeting/BudgetLinearBar';

export default function Budgeting() {
  const queryClient = useQueryClient();
  const { user, connectionError } = useAuth();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || 'overview';
  });
  const categoriesTabRef = useRef();
  const [categoryFilters, setCategoryFilters] = useState({
    hideNotBudgeted: false,
    hideSuggestedBudget: false
  });

  React.useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab') || 'overview';
      setActiveTab(tab);
    };

    const interval = setInterval(handleUrlChange, 100);
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  React.useEffect(() => {
    const handleProfileSwitch = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener('profileSwitched', handleProfileSwitch);
    return () => window.removeEventListener('profileSwitched', handleProfileSwitch);
  }, [queryClient]);

  const {
    budgets,
    transactions,
    categories,
    isLoading,
    hasSetupStarted,
    spendingByCategory,
    spendingWithChildren,
    incomeByCategory,
    monthStart,
    monthEnd,
    allIncomeCategories,
    allExpenseCategories
  } = useBudgetData(selectedMonth);

  const availableCategories = categories.filter(c =>
    !allIncomeCategories.some(ic => ic.id === c.id && ic.budgetStatus === 'active') &&
    !allExpenseCategories.some(ec => ec.id === c.id && ec.budgetStatus === 'active')
  );

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
        tabs={['overview', 'modify_budget']}
        dynamicTabConfig={{
          overview: {
            type: 'dropdown',
            label: format(selectedMonth, 'MMMM'),
            options: Array.from({ length: 12 }, (_, i) => {
              const monthDate = subMonths(startOfMonth(new Date()), i);
              return {
                value: monthDate.toISOString(),
                label: format(monthDate, 'MMMM yyyy'),
              };
            }),
            onSelect: (value) => {
              setSelectedMonth(new Date(value));
            },
          },
        }}
        inlineActions={
          activeTab === 'modify_budget' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => categoriesTabRef.current?.openCategoryWizard()}
                >
                  Add New Category
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>View</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => {
                        const newValue = !categoryFilters.hideNotBudgeted;
                        setCategoryFilters(prev => ({
                          ...prev,
                          hideNotBudgeted: newValue
                        }));
                        if (categoriesTabRef.current?.setFilters) {
                          categoriesTabRef.current.setFilters(prev => ({
                            ...prev,
                            hideNotBudgeted: newValue
                          }));
                        }
                      }}
                    >
                      {categoryFilters.hideNotBudgeted ? 'Show' : 'Hide'} Not Budgeted
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const newValue = !categoryFilters.hideSuggestedBudget;
                        setCategoryFilters(prev => ({
                          ...prev,
                          hideSuggestedBudget: newValue
                        }));
                        if (categoriesTabRef.current?.setFilters) {
                          categoriesTabRef.current.setFilters(prev => ({
                            ...prev,
                            hideSuggestedBudget: newValue
                          }));
                        }
                      }}
                    >
                      {categoryFilters.hideSuggestedBudget ? 'Show' : 'Hide'} Suggested Budget
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      {activeTab === 'overview' && hasSetupStarted && (
        <div className="mt-4">
          <BudgetLinearBar
            budgets={budgets}
            spendingByCategory={spendingByCategory}
            incomeByCategory={incomeByCategory}
            activeView="expenses"
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="overview" className="mt-0">
          {!hasSetupStarted ? (
            <div className="min-h-[600px] flex items-center justify-center bg-slate-50/30 rounded-lg border border-slate-200">
              <div className="text-center max-w-xl px-6">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">No Budget Setup Yet</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  Start by creating your first budget item to begin tracking your finances.
                </p>
                <Button onClick={() => setAddSheetOpen(true)} size="lg" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Budget Item
                </Button>
              </div>
            </div>
          ) : (
            <BudgetTrackerContainer
              budgets={budgets}
              spendingByCategory={spendingByCategory}
              incomeByCategory={incomeByCategory}
              monthStart={monthStart}
              monthEnd={monthEnd}
            />
          )}
        </TabsContent>

        <TabsContent value="modify_budget" className="mt-0">
          <CategoriesTab ref={categoriesTabRef} />
        </TabsContent>
      </Tabs>

      <AddBudgetItemSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        availableCategories={availableCategories}
      />

      {editingBudget && (
        <AddBudgetItemSheet
          open={!!editingBudget}
          onOpenChange={(open) => !open && setEditingBudget(null)}
          availableCategories={availableCategories}
          editingBudget={editingBudget}
        />
      )}
    </div>
  );
}
