import React, { useState, useEffect } from 'react';
import { useBudgetData } from '@/hooks/useBudgetData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatCadenceAmount, getAllCadenceValues } from '@/utils/cadenceUtils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import AddBudgetItemSheet from './AddBudgetItemSheet';
import InlineEditableAmount from './InlineEditableAmount';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';

const STORAGE_KEY_PREFIX = 'categoriesTab_collapsed_';

export default function CategoriesTab() {
  const queryClient = useQueryClient();
  const {
    budgets,
    budgetGroups,
    budgetedIncomeCategories,
    budgetedExpenseCategories,
    availableIncomeCategories,
    availableExpenseCategories,
    categoryUsage,
    categories,
    isLoading
  } = useBudgetData();

  const [collapsedSections, setCollapsedSections] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'sections');
    return saved ? JSON.parse(saved) : {
      budgetedIncome: false,
      budgetedExpense: false,
      availableIncome: false,
      availableExpense: false
    };
  });

  const [addBudgetSheetOpen, setAddBudgetSheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null);
  const [updatingBudgetId, setUpdatingBudgetId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'sections', JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const deleteBudgetMutation = useMutation({
    mutationFn: (budgetId) => firstsavvy.entities.Budget.delete(budgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget removed successfully');
    },
    onError: (error) => {
      console.error('Error deleting budget:', error);
      toast.error('Failed to remove budget');
    }
  });

  const addBudgetMutation = useMutation({
    mutationFn: (budgetData) => firstsavvy.entities.Budget.create(budgetData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Category added to budget');
    },
    onError: (error) => {
      console.error('Error adding budget:', error);
      toast.error('Failed to add category to budget');
    }
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }) => firstsavvy.entities.Budget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setUpdatingBudgetId(null);
      toast.success('Budget updated successfully');
    },
    onError: (error) => {
      console.error('Error updating budget:', error);
      setUpdatingBudgetId(null);
      toast.error('Failed to update budget');
    }
  });

  const handleAddBudget = (category) => {
    const budgetData = {
      chart_account_id: category.id,
      allocated_amount: 0,
      cadence: 'monthly'
    };
    addBudgetMutation.mutate(budgetData);
  };

  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
    setSelectedCategory(null);
    setAddBudgetSheetOpen(true);
  };

  const handleDeleteBudget = (budgetId) => {
    if (confirm('Are you sure you want to remove this budget?')) {
      deleteBudgetMutation.mutate(budgetId);
    }
  };

  const getBudgetForCategory = (categoryId) => {
    return budgets.find(b => b.chart_account_id === categoryId);
  };

  const handleUpdateBudgetAmount = async (budgetId, newAmount, editedCadence) => {
    setUpdatingBudgetId(budgetId);
    const updateData = {
      allocated_amount: newAmount,
      cadence: editedCadence
    };
    updateBudgetMutation.mutate({ id: budgetId, data: updateData });
  };

  const renderBudgetedCategoryRow = (category, index) => {
    const budget = getBudgetForCategory(category.id);
    if (!budget) return null;

    const cadence = budget.cadence || 'monthly';
    const amount = budget.allocated_amount || 0;
    const values = getAllCadenceValues(amount, cadence);
    const isUpdating = updatingBudgetId === budget.id;
    const isZero = amount === 0;

    return (
      <tr key={category.id} className={`border-b border-slate-200 hover:bg-slate-50/50 ${index % 2 === 0 ? 'bg-background' : 'bg-slate-50/30'} group`}>
        <td className="px-4 py-2.5 font-medium border-r border-slate-200">{category.display_name}</td>
        <InlineEditableAmount
          value={values.daily}
          cadence="daily"
          isActiveCadence={cadence === 'daily'}
          onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
          isLoading={isUpdating}
          isMonthly={false}
          isZero={isZero}
        />
        <InlineEditableAmount
          value={values.weekly}
          cadence="weekly"
          isActiveCadence={cadence === 'weekly'}
          onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
          isLoading={isUpdating}
          isMonthly={false}
          isZero={isZero}
        />
        <InlineEditableAmount
          value={values.monthly}
          cadence="monthly"
          isActiveCadence={cadence === 'monthly'}
          onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
          isLoading={isUpdating}
          isMonthly={true}
          isZero={isZero}
        />
        <InlineEditableAmount
          value={values.yearly}
          cadence="yearly"
          isActiveCadence={cadence === 'yearly'}
          onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
          isLoading={isUpdating}
          isMonthly={false}
          isZero={isZero}
        />
        <td className="px-4 py-2.5 text-right border-l border-slate-200">
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditBudget(budget)}
              className="opacity-40 group-hover:opacity-100 transition-opacity"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteBudget(budget.id)}
              className="opacity-40 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const renderAvailableCategoryRow = (category, index) => {
    const usage = categoryUsage[category.id];
    const everUsed = usage?.everUsed || false;
    const lastUsed = usage?.lastUsed;

    return (
      <tr key={category.id} className={`border-b border-slate-200 hover:bg-slate-50/50 ${index % 2 === 0 ? 'bg-background' : 'bg-slate-50/30'}`}>
        <td className="px-4 py-2.5 font-medium border-r border-slate-200">{category.display_name}</td>
        <td className="px-4 py-2.5">
          {everUsed ? (
            <Badge variant="secondary" className="text-xs">Yes</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">No</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-muted-foreground text-sm">
          {lastUsed ? format(new Date(lastUsed), 'MMM d, yyyy') : '-'}
        </td>
        <td className="px-4 py-2.5 text-right">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddBudget(category)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </td>
      </tr>
    );
  };

  const renderSection = (title, categories, sectionKey, renderRow, emptyMessage) => {
    const isCollapsed = collapsedSections[sectionKey];
    const count = categories.length;
    const isBudgetedSection = renderRow === renderBudgetedCategoryRow;

    return (
      <div className="mb-6">
        <div
          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
          onClick={() => toggleSection(sectionKey)}
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            {title}
            <Badge variant="secondary">{count}</Badge>
          </h3>
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>

        {!isCollapsed && (
          <div className="mt-4">
            {isBudgetedSection && (
              <div className="mb-3 border-b border-slate-200 pb-3">
                <p className="text-xs text-muted-foreground">
                  Amounts shown as Daily / Weekly / Monthly / Yearly equivalents
                </p>
              </div>
            )}
            {categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b border-slate-300 bg-muted/50">
                      {isBudgetedSection ? (
                        <>
                          <th className="py-3 px-4 text-left font-semibold text-slate-700 border-r border-slate-200 w-[25%]">Category</th>
                          <th className="py-3 px-4 text-right font-medium text-slate-600 w-[14%]">Daily</th>
                          <th className="py-3 px-4 text-right font-medium text-slate-600 w-[14%]">Weekly</th>
                          <th className="py-3 px-4 text-right font-bold text-slate-900 bg-slate-50/50 w-[14%]">Monthly</th>
                          <th className="py-3 px-4 text-right font-medium text-slate-600 w-[14%]">Yearly</th>
                          <th className="py-3 px-4 text-right font-semibold text-slate-700 border-l border-slate-200 w-[19%]">Actions</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3 px-4 text-left font-semibold text-slate-700 border-r border-slate-200 w-[40%]">Category</th>
                          <th className="py-3 px-4 text-left font-medium text-slate-600 w-[20%]">Ever Used</th>
                          <th className="py-3 px-4 text-left font-medium text-slate-600 w-[20%]">Last Used</th>
                          <th className="py-3 px-4 text-right font-medium text-slate-600 w-[20%]"></th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category, index) => renderRow(category, index))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading categories...</div>
      </div>
    );
  }

  const incomeGroup = budgetGroups.find(g => g.type === 'income');
  const expenseGroup = budgetGroups.find(g => g.type === 'expense');

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {renderSection(
            'Income',
            budgetedIncomeCategories,
            'budgetedIncome',
            renderBudgetedCategoryRow,
            'No income categories have been budgeted yet. Add a budget to get started.'
          )}

          {renderSection(
            'Expenses',
            budgetedExpenseCategories,
            'budgetedExpense',
            renderBudgetedCategoryRow,
            'No expense categories have been budgeted yet. Add a budget to get started.'
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Categories (Not Budgeted)</CardTitle>
        </CardHeader>
        <CardContent>
          {renderSection(
            'Available Income Categories',
            availableIncomeCategories,
            'availableIncome',
            renderAvailableCategoryRow,
            'All income categories have been budgeted.'
          )}

          {renderSection(
            'Available Expense Categories',
            availableExpenseCategories,
            'availableExpense',
            renderAvailableCategoryRow,
            'All expense categories have been budgeted.'
          )}
        </CardContent>
      </Card>

      <AddBudgetItemSheet
        open={addBudgetSheetOpen}
        onOpenChange={setAddBudgetSheetOpen}
        groups={budgetGroups}
        categories={categories}
        editingBudget={editingBudget}
        preselectedCategoryId={selectedCategory?.id}
        preselectedGroupId={selectedCategory ? (
          selectedCategory.class === 'income' ? incomeGroup?.id : expenseGroup?.id
        ) : null}
      />
    </div>
  );
}
