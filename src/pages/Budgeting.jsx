import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { PageTabs } from '@/components/common/PageTabs';

import { useBudgetData } from '@/hooks/useBudgetData';
import BudgetTrackerContainer from '../components/budgeting/BudgetTrackerContainer';
import AddBudgetItemSheet from '../components/budgeting/AddBudgetItemSheet';
import CategoriesTab from '../components/budgeting/CategoriesTab';

export default function Budgeting() {
  const queryClient = useQueryClient();
  const { user, connectionError } = useAuth();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || 'overview';
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
    incomeByCategory,
    monthStart,
    monthEnd,
    availableIncomeCategories,
    availableExpenseCategories
  } = useBudgetData();

  const availableCategories = [...availableIncomeCategories, ...availableExpenseCategories];

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
        tabs={['overview', 'categories']}
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

        <TabsContent value="categories" className="mt-0">
          <CategoriesTab />
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
