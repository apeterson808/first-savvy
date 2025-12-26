import React, { useState, useEffect } from 'react';
import { useBudgetData } from '@/hooks/useBudgetData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatCadenceAmount, getAllCadenceValues } from '@/utils/cadenceUtils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import AddBudgetItemSheet from './AddBudgetItemSheet';
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

  const handleAddBudget = (category) => {
    setSelectedCategory(category);
    setEditingBudget(null);
    setAddBudgetSheetOpen(true);
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

  const renderBudgetedCategoryRow = (category) => {
    const budget = getBudgetForCategory(category.id);
    if (!budget) return null;

    const cadence = budget.cadence || 'monthly';
    const amount = budget.allocated_amount || 0;
    const values = getAllCadenceValues(amount, cadence);

    return (
      <tr key={category.id} className="border-b hover:bg-muted/50">
        <td className="px-4 font-medium">{category.display_name}</td>
        <td className={`px-4 text-right ${cadence === 'daily' ? 'font-semibold' : 'text-muted-foreground'}`}>
          {formatCadenceAmount(values.daily, 2)}
        </td>
        <td className={`px-4 text-right ${cadence === 'weekly' ? 'font-semibold' : 'text-muted-foreground'}`}>
          {formatCadenceAmount(values.weekly, 2)}
        </td>
        <td className={`px-4 text-right ${cadence === 'monthly' ? 'font-semibold' : 'text-muted-foreground'}`}>
          {formatCadenceAmount(values.monthly, 2)}
        </td>
        <td className={`px-4 text-right ${cadence === 'yearly' ? 'font-semibold' : 'text-muted-foreground'}`}>
          {formatCadenceAmount(values.yearly, 0)}
        </td>
        <td className="px-4 text-right">
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditBudget(budget)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteBudget(budget.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const renderAvailableCategoryRow = (category) => {
    const usage = categoryUsage[category.id];
    const everUsed = usage?.everUsed || false;
    const lastUsed = usage?.lastUsed;

    return (
      <tr
        key={category.id}
        className="border-b hover:bg-muted/50 cursor-pointer"
        onClick={() => handleAddBudget(category)}
      >
        <td className="px-4 font-medium">{category.display_name}</td>
        <td className="px-4">
          {everUsed ? (
            <Badge variant="secondary" className="text-xs">Yes</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">No</span>
          )}
        </td>
        <td className="px-4 text-muted-foreground text-sm">
          {lastUsed ? format(new Date(lastUsed), 'MMM d, yyyy') : '-'}
        </td>
        <td className="px-4 text-right">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleAddBudget(category);
            }}
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

    return (
      <div className="mb-6">
        <div
          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
          onClick={() => toggleSection(sectionKey)}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {title}
            <Badge variant="secondary">{count}</Badge>
          </h3>
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>

        {!isCollapsed && (
          <div className="mt-4">
            {categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {renderRow === renderBudgetedCategoryRow ? (
                        <>
                          <th className="px-4 text-left font-semibold">Category</th>
                          <th className="px-4 text-right font-semibold">Daily</th>
                          <th className="px-4 text-right font-semibold">Weekly</th>
                          <th className="px-4 text-right font-semibold">Monthly</th>
                          <th className="px-4 text-right font-semibold">Yearly</th>
                          <th className="px-4 text-right font-semibold">Actions</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 text-left font-semibold">Category</th>
                          <th className="px-4 text-left font-semibold">Ever Used</th>
                          <th className="px-4 text-left font-semibold">Last Used</th>
                          <th className="px-4 text-right font-semibold"></th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(renderRow)}
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
          <CardTitle>Budgeted Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {renderSection(
            'Budgeted Income Categories',
            budgetedIncomeCategories,
            'budgetedIncome',
            renderBudgetedCategoryRow,
            'No income categories have been budgeted yet. Add a budget to get started.'
          )}

          {renderSection(
            'Budgeted Expense Categories',
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
