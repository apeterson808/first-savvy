import React, { useState, useEffect } from 'react';
import { useBudgetData } from '@/hooks/useBudgetData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatAccountingAmount, getAllCadenceValues } from '@/utils/cadenceUtils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import AddBudgetItemSheet from './AddBudgetItemSheet';
import BudgetAllocationBar from './BudgetAllocationBar';
import InlineEditableAmount from './InlineEditableAmount';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';

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
    const IconComponent = Icons[category.icon] || Icons.Circle;

    return (
      <tr key={category.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${index % 2 === 0 ? 'bg-background' : 'bg-slate-50/30'}`}>
        <td className="px-4 border-r border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${category.color}20` }}
            >
              <IconComponent className="w-3.5 h-3.5" style={{ color: category.color }} />
            </div>
            <span>{category.display_name}</span>
          </div>
        </td>
        <InlineEditableAmount
          value={values.daily}
          cadence="daily"
          isActiveCadence={cadence === 'daily'}
          onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
          isLoading={isUpdating}
          hasBorder={true}
        />
        <InlineEditableAmount
          value={values.weekly}
          cadence="weekly"
          isActiveCadence={cadence === 'weekly'}
          onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
          isLoading={isUpdating}
          hasBorder={true}
        />
        <InlineEditableAmount
          value={values.monthly}
          cadence="monthly"
          isActiveCadence={cadence === 'monthly'}
          onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
          isLoading={isUpdating}
          hasBorder={true}
          isMonthlyColumn={true}
        />
        <InlineEditableAmount
          value={values.yearly}
          cadence="yearly"
          isActiveCadence={cadence === 'yearly'}
          onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
          isLoading={isUpdating}
          hasBorder={true}
        />
        <td className="px-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditBudget(budget)}
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteBudget(budget.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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
    const IconComponent = Icons[category.icon] || Icons.Circle;

    return (
      <tr key={category.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${index % 2 === 0 ? 'bg-background' : 'bg-slate-50/30'}`}>
        <td className="px-4 font-medium border-r border-slate-200">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${category.color}20` }}
            >
              <IconComponent className="w-3.5 h-3.5" style={{ color: category.color }} />
            </div>
            <span>{category.display_name}</span>
          </div>
        </td>
        <td className="px-4 border-r border-slate-200">
          {everUsed ? (
            <Badge variant="secondary" className="text-xs">Yes</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">No</span>
          )}
        </td>
        <td className="px-4 text-muted-foreground text-sm border-r border-slate-200">
          {lastUsed ? format(new Date(lastUsed), 'MMM d, yyyy') : '-'}
        </td>
        <td className="px-4 text-right">
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

  const calculateTotals = (categories) => {
    return categories.reduce((totals, category) => {
      const budget = getBudgetForCategory(category.id);
      if (!budget) return totals;

      const cadence = budget.cadence || 'monthly';
      const amount = budget.allocated_amount || 0;
      const values = getAllCadenceValues(amount, cadence);

      return {
        daily: totals.daily + values.daily,
        weekly: totals.weekly + values.weekly,
        monthly: totals.monthly + values.monthly,
        yearly: totals.yearly + values.yearly
      };
    }, { daily: 0, weekly: 0, monthly: 0, yearly: 0 });
  };

  const renderSection = (title, categories, sectionKey, renderRow, emptyMessage) => {
    const isCollapsed = collapsedSections[sectionKey];
    const count = categories.length;
    const isBudgetedSection = renderRow === renderBudgetedCategoryRow;
    const totals = isBudgetedSection && categories.length > 0 ? calculateTotals(categories) : null;
    const categoryColumnLabel = isBudgetedSection
      ? (title === 'Income Categories' ? 'Income Categories' : 'Expense Categories')
      : (title.includes('Income') ? 'Income Categories' : 'Expense Categories');
    const totalLabel = title === 'Income Categories' ? 'Income Total' : 'Expense Total';

    const dailyFormatted = totals ? formatAccountingAmount(totals.daily) : null;
    const weeklyFormatted = totals ? formatAccountingAmount(totals.weekly) : null;
    const monthlyFormatted = totals ? formatAccountingAmount(totals.monthly) : null;
    const yearlyFormatted = totals ? formatAccountingAmount(totals.yearly) : null;

    return (
      <div className="mb-6">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-100/60">
                    {isBudgetedSection ? (
                      <>
                        <th
                          className="py-2 px-4 text-left font-bold w-[30%] cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleSection(sectionKey)}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            {categoryColumnLabel}
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        </th>
                        <th className="py-2 px-4 text-left font-normal w-[14%]">Daily</th>
                        <th className="py-2 px-4 text-left font-normal w-[14%]">Weekly</th>
                        <th className="py-2 px-4 text-left font-bold w-[14%] bg-blue-100/70">Monthly</th>
                        <th className="py-2 px-4 text-left font-normal w-[14%]">Yearly</th>
                        <th className="py-2 px-4 text-right font-bold w-[14%]">Action</th>
                      </>
                    ) : (
                      <>
                        <th
                          className="py-2 px-4 text-left font-bold w-[40%] cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleSection(sectionKey)}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            {categoryColumnLabel}
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        </th>
                        <th className="py-2 px-4 text-left font-normal w-[20%]">Ever Used</th>
                        <th className="py-2 px-4 text-left font-normal w-[20%]">Last Used</th>
                        <th className="py-2 px-4 text-right font-normal w-[20%]">Action</th>
                      </>
                    )}
                  </tr>
                </thead>
                {!isCollapsed && (
                  <tbody>
                    {categories.map((category, index) => renderRow(category, index))}
                  </tbody>
                )}
                {totals && (
                  <tbody>
                    <tr className="border-t-2 border-slate-200 bg-slate-100/60">
                      <td className="px-4 py-2 border-r border-slate-200">{totalLabel}</td>
                      <td className="px-4 py-2 border-r border-slate-100">
                        <div className="flex justify-between tabular-nums">
                          <span className={totals.daily === 0 ? 'font-semibold' : ''}>{dailyFormatted.sign}</span>
                          <span className={`text-right ${totals.daily === 0 ? 'font-semibold' : ''}`}>{dailyFormatted.amount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 border-r border-slate-100">
                        <div className="flex justify-between tabular-nums">
                          <span className={totals.weekly === 0 ? 'font-semibold' : ''}>{weeklyFormatted.sign}</span>
                          <span className={`text-right ${totals.weekly === 0 ? 'font-semibold' : ''}`}>{weeklyFormatted.amount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 border-r border-slate-100 bg-blue-100/70">
                        <div className="flex justify-between tabular-nums font-semibold">
                          <span>{monthlyFormatted.sign}</span>
                          <span className="text-right">{monthlyFormatted.amount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 border-r border-slate-100">
                        <div className="flex justify-between tabular-nums">
                          <span className={totals.yearly === 0 ? 'font-semibold' : ''}>{yearlyFormatted.sign}</span>
                          <span className={`text-right ${totals.yearly === 0 ? 'font-semibold' : ''}`}>{yearlyFormatted.amount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2"></td>
                    </tr>
                  </tbody>
                )}
              </table>
            </div>
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
    <div className="space-y-4">
      <BudgetAllocationBar
        budgets={budgets}
        budgetGroups={budgetGroups}
      />

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 pt-4 px-6">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Budgeted</p>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {renderSection(
            'Income Categories',
            budgetedIncomeCategories,
            'budgetedIncome',
            renderBudgetedCategoryRow,
            'No income categories have been budgeted yet. Add a budget to get started.'
          )}

          {renderSection(
            'Expense Categories',
            budgetedExpenseCategories,
            'budgetedExpense',
            renderBudgetedCategoryRow,
            'No expense categories have been budgeted yet. Add a budget to get started.'
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 pt-4 px-6">
          <CardTitle className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Not Budgeted</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
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
