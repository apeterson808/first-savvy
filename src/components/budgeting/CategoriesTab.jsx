import React, { useState, useEffect, useMemo } from 'react';
import { useBudgetData } from '@/hooks/useBudgetData';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, Minus, Pencil } from 'lucide-react';
import { formatAccountingAmount, getAllCadenceValues } from '@/utils/cadenceUtils';
import { Badge } from '@/components/ui/badge';
import AddBudgetItemSheet from './AddBudgetItemSheet';
import BudgetAllocationDonut from './BudgetAllocationDonut';
import InlineEditableAmount from './InlineEditableAmount';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { getAccountTypeLabel, getAccountTypeOrder } from '@/utils/accountTypeLabels';

const STORAGE_KEY_PREFIX = 'categoriesTab_collapsed_';

export default function CategoriesTab() {
  const queryClient = useQueryClient();
  const {
    budgets,
    transactions,
    allIncomeCategories,
    allExpenseCategories,
    categoryUsage,
    categories,
    isLoading
  } = useBudgetData();

  const [collapsedSections, setCollapsedSections] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'sections');
    return saved ? JSON.parse(saved) : {
      income: false,
      expense: false
    };
  });

  const [collapsedTypes, setCollapsedTypes] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'types');
    return saved ? JSON.parse(saved) : {};
  });

  const [expandedParents, setExpandedParents] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'parents');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [addBudgetSheetOpen, setAddBudgetSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [updatingBudgetId, setUpdatingBudgetId] = useState(null);
  const [togglingBudgetId, setTogglingBudgetId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'sections', JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'types', JSON.stringify(collapsedTypes));
  }, [collapsedTypes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'parents', JSON.stringify([...expandedParents]));
  }, [expandedParents]);

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleType = (typeKey) => {
    setCollapsedTypes(prev => ({
      ...prev,
      [typeKey]: !prev[typeKey]
    }));
  };

  const toggleParent = (parentId) => {
    setExpandedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  const toggleBudgetActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => firstsavvy.entities.Budget.update(id, { is_active }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setTogglingBudgetId(null);
      toast.success(variables.is_active ? 'Budget activated' : 'Budget deactivated');
    },
    onError: (error) => {
      setTogglingBudgetId(null);
      toast.error('Failed to update budget');
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
      setUpdatingBudgetId(null);
      toast.error('Failed to update budget');
    }
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data) => firstsavvy.entities.Budget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setTogglingBudgetId(null);
      toast.success('Budget created successfully');
    },
    onError: (error) => {
      setTogglingBudgetId(null);
      toast.error('Failed to create budget');
    }
  });

  const historicalAverages = useMemo(() => {
    const averages = {};

    categories.forEach(category => {
      const categoryTransactions = transactions.filter(t =>
        t.category_account_id === category.id &&
        t.status === 'posted' &&
        t.type !== 'transfer'
      );

      if (categoryTransactions.length === 0) {
        averages[category.id] = 0;
        return;
      }

      const monthlyTotals = categoryTransactions.reduce((acc, t) => {
        const date = new Date(t.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        acc[monthKey] = (acc[monthKey] || 0) + Math.abs(t.amount);
        return acc;
      }, {});

      const months = Object.keys(monthlyTotals).length;
      const totalSpent = Object.values(monthlyTotals).reduce((sum, amt) => sum + amt, 0);
      const avgMonthly = months > 0 ? totalSpent / months : 0;

      averages[category.id] = avgMonthly;
    });

    return averages;
  }, [categories, transactions]);

  const handleToggleBudget = (categoryWithBudget) => {
    const { budget, budgetStatus } = categoryWithBudget;

    if (budgetStatus === 'active') {
      setTogglingBudgetId(budget.id);
      toggleBudgetActiveMutation.mutate({ id: budget.id, is_active: false });
    } else if (budgetStatus === 'inactive') {
      setTogglingBudgetId(budget.id);
      toggleBudgetActiveMutation.mutate({ id: budget.id, is_active: true });
    } else {
      const suggestedAmount = historicalAverages[categoryWithBudget.id] || 0;
      if (suggestedAmount <= 0) {
        toast.error('No historical data to create budget suggestion');
        return;
      }
      setTogglingBudgetId(categoryWithBudget.id);
      const budgetData = {
        chart_account_id: categoryWithBudget.id,
        allocated_amount: suggestedAmount,
        cadence: 'monthly',
        is_active: true
      };
      createBudgetMutation.mutate(budgetData);
    }
  };

  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
    setAddBudgetSheetOpen(true);
  };

  const handleUpdateBudgetAmount = async (budgetId, newAmount, editedCadence) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;

    setUpdatingBudgetId(budgetId);
    const updateData = {
      allocated_amount: newAmount,
      cadence: editedCadence
    };
    updateBudgetMutation.mutate({ id: budgetId, data: updateData });
  };

  const renderUnifiedCategoryRow = (categoryWithBudget, index, isChild = false, allCategories = []) => {
    const { budget, budgetStatus } = categoryWithBudget;
    const IconComponent = Icons[categoryWithBudget.icon] || Icons.Circle;

    const children = allCategories
      .filter(c => c.parent_account_id === categoryWithBudget.id)
      .sort((a, b) => {
        const nameA = (a.display_name || '').toLowerCase();
        const nameB = (b.display_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    const hasChildren = children.length > 0;
    const isParentExpanded = expandedParents.has(categoryWithBudget.id);

    const rows = [];
    const suggestedAmount = historicalAverages[categoryWithBudget.id] || 0;
    const hasSuggestion = budgetStatus === 'none' && suggestedAmount > 0;

    const isInactive = budgetStatus === 'inactive';
    const isNoBudget = budgetStatus === 'none';
    const isDisabled = isInactive || isNoBudget;

    const textColorClass = isDisabled ? 'text-slate-400' : '';
    const isToggling = togglingBudgetId === (budget?.id || categoryWithBudget.id);

    const cadence = budget?.cadence || 'monthly';
    const amount = budget?.allocated_amount || 0;
    const values = budget ? getAllCadenceValues(amount, cadence) :
      hasSuggestion ? getAllCadenceValues(suggestedAmount, 'monthly') :
      { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
    const isUpdating = updatingBudgetId === budget?.id;

    rows.push(
      <tr key={categoryWithBudget.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${isChild ? 'bg-slate-50/30' : 'bg-white'}`}>
        <td className="px-4 py-0.5 border-l-2 border-slate-200">
          <div className={`flex items-center gap-2 ${!isChild ? 'pl-12' : 'pl-12'}`}>
            {!isChild && hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-slate-200 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleParent(categoryWithBudget.id);
                }}
              >
                {isParentExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                )}
              </Button>
            ) : (
              <div className={`w-5 flex-shrink-0 ${isChild ? 'ml-5' : ''}`}></div>
            )}
            <IconComponent className={`w-4 h-4 flex-shrink-0 ${textColorClass}`} style={{ color: isDisabled ? undefined : categoryWithBudget.color }} />
            <span className={`text-sm ${isChild ? 'text-slate-600' : 'text-slate-700'} ${textColorClass} truncate`}>
              {categoryWithBudget.display_name}
            </span>
          </div>
        </td>
        {hasSuggestion ? (
          <>
            <InlineEditableAmount
              value={values.daily}
              cadence="daily"
              isActiveCadence={false}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget?.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={true}
              className="text-slate-500 italic"
              isSuggested={true}
            />
            <InlineEditableAmount
              value={values.weekly}
              cadence="weekly"
              isActiveCadence={false}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget?.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={true}
              className="text-slate-500 italic"
              isSuggested={true}
            />
            <InlineEditableAmount
              value={values.monthly}
              cadence="monthly"
              isActiveCadence={true}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget?.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              isMonthlyColumn={true}
              disabled={true}
              className="text-slate-500 italic"
              isSuggested={true}
            />
            <InlineEditableAmount
              value={values.yearly}
              cadence="yearly"
              isActiveCadence={false}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget?.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={true}
              className="text-slate-500 italic"
              isSuggested={true}
            />
          </>
        ) : isNoBudget ? (
          <>
            <td className="px-4 py-0.5 text-center text-slate-400">-</td>
            <td className="px-4 py-0.5 text-center text-slate-400">-</td>
            <td className="px-4 py-0.5 text-center text-slate-400 bg-slate-50/50">-</td>
            <td className="px-4 py-0.5 text-center text-slate-400">-</td>
          </>
        ) : (
          <>
            <InlineEditableAmount
              value={values.daily}
              cadence="daily"
              isActiveCadence={cadence === 'daily'}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={isDisabled}
              className={textColorClass}
            />
            <InlineEditableAmount
              value={values.weekly}
              cadence="weekly"
              isActiveCadence={cadence === 'weekly'}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={isDisabled}
              className={textColorClass}
            />
            <InlineEditableAmount
              value={values.monthly}
              cadence="monthly"
              isActiveCadence={cadence === 'monthly'}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              isMonthlyColumn={true}
              disabled={isDisabled}
              className={textColorClass}
            />
            <InlineEditableAmount
              value={values.yearly}
              cadence="yearly"
              isActiveCadence={cadence === 'yearly'}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={isDisabled}
              className={textColorClass}
            />
          </>
        )}
        <td className="px-4 py-0.5 text-right border-r-2 border-slate-200">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleBudget(categoryWithBudget)}
              className="h-7 w-7 p-0 hover:bg-slate-100"
              disabled={isToggling}
            >
              {budgetStatus === 'active' ? (
                <Minus className="h-3.5 w-3.5 text-slate-600" />
              ) : (
                <Plus className="h-3.5 w-3.5 text-slate-600" />
              )}
            </Button>
            {budget && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditBudget(budget)}
                className="h-7 w-7 p-0 hover:bg-slate-100"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-600" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );

    if (hasChildren && isParentExpanded) {
      children.forEach((childCategory, childIndex) => {
        rows.push(...renderUnifiedCategoryRow(childCategory, index + childIndex + 1, true, allCategories));
      });
    }

    return rows;
  };

  const calculateTotals = (categories) => {
    const parentCategories = categories.filter(c => !c.parent_account_id);

    return parentCategories.reduce((totals, category) => {
      if (category.budgetStatus !== 'active' || !category.budget) return totals;

      const cadence = category.budget.cadence || 'monthly';
      const amount = category.budget.allocated_amount || 0;
      const values = getAllCadenceValues(amount, cadence);

      return {
        daily: totals.daily + values.daily,
        weekly: totals.weekly + values.weekly,
        monthly: totals.monthly + values.monthly,
        yearly: totals.yearly + values.yearly
      };
    }, { daily: 0, weekly: 0, monthly: 0, yearly: 0 });
  };

  const groupCategoriesByType = (categoriesList) => {
    const grouped = {};
    categoriesList.forEach(category => {
      const accountType = category.account_type || 'uncategorized';
      if (!grouped[accountType]) {
        grouped[accountType] = [];
      }
      grouped[accountType].push(category);
    });
    return grouped;
  };

  const renderSection = (title, categories, sectionKey) => {
    const isCollapsed = collapsedSections[sectionKey];

    const parentCategories = categories.filter(c => !c.parent_account_id);

    const groupedByType = groupCategoriesByType(parentCategories);
    const sortedTypes = Object.keys(groupedByType).sort((a, b) => {
      return getAccountTypeOrder(a) - getAccountTypeOrder(b);
    });

    const totals = calculateTotals(categories);
    const categoryColumnLabel = title;
    const totalLabel = title.includes('Income') ? 'Income Total' : 'Expense Total';

    const dailyFormatted = formatAccountingAmount(totals.daily);
    const weeklyFormatted = formatAccountingAmount(totals.weekly);
    const monthlyFormatted = formatAccountingAmount(totals.monthly);
    const yearlyFormatted = formatAccountingAmount(totals.yearly);

    return (
      <div className="mb-6">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No categories available
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white px-4">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-slate-50/30">
                  <th
                    className="py-2 px-4 text-left font-normal text-sm text-slate-700 w-[30%] cursor-pointer hover:bg-slate-100/50 transition-colors border-l-2 border-b-2 border-slate-200"
                    onClick={() => toggleSection(sectionKey)}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                      {categoryColumnLabel}
                    </div>
                  </th>
                  <th className="py-2 px-4 text-center font-normal text-sm text-slate-600 w-[14%] border-b-2 border-slate-200">Daily</th>
                  <th className="py-2 px-4 text-center font-normal text-sm text-slate-600 w-[14%] border-b-2 border-slate-200">Weekly</th>
                  <th className="py-2 px-4 text-center font-normal text-sm text-slate-700 w-[14%] border-b-2 border-slate-200">Monthly</th>
                  <th className="py-2 px-4 text-center font-normal text-sm text-slate-600 w-[14%] border-b-2 border-slate-200">Yearly</th>
                  <th className="py-2 px-4 text-right font-normal text-sm text-slate-700 w-[14%] border-r-2 border-b-2 border-slate-200">Action</th>
                </tr>
              </thead>
              {!isCollapsed && sortedTypes.map(accountType => {
                const typeCategories = groupedByType[accountType];
                const typeKey = `${sectionKey}_${accountType}`;
                const isTypeCollapsed = collapsedTypes[typeKey];

                const sortedTypeCategories = [...typeCategories].sort((a, b) => {
                  const nameA = (a.display_name || '').toLowerCase();
                  const nameB = (b.display_name || '').toLowerCase();
                  return nameA.localeCompare(nameB);
                });

                return (
                  <tbody key={accountType} className="relative">
                    <tr className="bg-slate-50/50">
                      <td
                        colSpan={6}
                        className="px-4 py-1 cursor-pointer hover:bg-slate-100/50 transition-colors border-l-2 border-r-2 border-b border-slate-200 relative"
                        onClick={() => toggleType(typeKey)}
                      >
                        <div className="flex items-center gap-2 pl-6">
                          {isTypeCollapsed ? <ChevronRight className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
                          <span className="text-sm font-medium text-slate-700 truncate">{getAccountTypeLabel(accountType)}</span>
                        </div>
                      </td>
                    </tr>
                    {!isTypeCollapsed && sortedTypeCategories.map((category, index) => renderUnifiedCategoryRow(category, index, false, categories))}
                  </tbody>
                );
              })}
              <tbody>
                <tr className="bg-slate-50/30">
                  <td className="px-4 py-2.5 font-medium text-slate-700 border-l-2 border-t-2 border-slate-200">{totalLabel}</td>
                  <td className="px-4 py-2.5 text-center border-t-2 border-slate-200">
                    <div className="inline-flex items-center gap-1 tabular-nums text-slate-700">
                      <span>{dailyFormatted.sign}</span>
                      <span>{dailyFormatted.amount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center border-t-2 border-slate-200">
                    <div className="inline-flex items-center gap-1 tabular-nums text-slate-700">
                      <span>{weeklyFormatted.sign}</span>
                      <span>{weeklyFormatted.amount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center border-t-2 border-slate-200">
                    <div className="inline-flex items-center gap-1 tabular-nums font-medium text-slate-700">
                      <span>{monthlyFormatted.sign}</span>
                      <span>{monthlyFormatted.amount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center border-t-2 border-slate-200">
                    <div className="inline-flex items-center gap-1 tabular-nums text-slate-700">
                      <span>{yearlyFormatted.sign}</span>
                      <span>{yearlyFormatted.amount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 border-r-2 border-t-2 border-slate-200"></td>
                </tr>
              </tbody>
            </table>
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

  const totalIncome = budgets
    .filter(b => b.chartAccount?.class === 'income' && !b.chartAccount?.parent_account_id && b.is_active)
    .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense' && b.is_active);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-6">
          {renderSection(
            'Income Categories',
            allIncomeCategories,
            'income'
          )}

          {renderSection(
            'Expense Categories',
            allExpenseCategories,
            'expense'
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <BudgetAllocationDonut
            budgets={expenseBudgets}
            groups={[{ id: 'expenses', name: 'Expenses', type: 'expense' }]}
            totalIncome={totalIncome}
          />
        </div>
      </div>

      <AddBudgetItemSheet
        open={addBudgetSheetOpen}
        onOpenChange={setAddBudgetSheetOpen}
        availableCategories={categories}
        editingBudget={editingBudget}
      />
    </div>
  );
}
