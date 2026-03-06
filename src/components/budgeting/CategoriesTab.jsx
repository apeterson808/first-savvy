import React, { useState, useEffect, useMemo } from 'react';
import { useBudgetData } from '@/hooks/useBudgetData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatAccountingAmount, getAllCadenceValues } from '@/utils/cadenceUtils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import AddBudgetItemSheet from './AddBudgetItemSheet';
import BudgetAllocationDonut from './BudgetAllocationDonut';
import InlineEditableAmount from './InlineEditableAmount';
import InlineEditableAmountWithCadence from './InlineEditableAmountWithCadence';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { validateChildBudgetAgainstParent, formatValidationError, getCadenceLabel } from '@/utils/budgetValidation';

const STORAGE_KEY_PREFIX = 'categoriesTab_collapsed_';

export default function CategoriesTab() {
  const queryClient = useQueryClient();
  const {
    budgets,
    transactions,
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

  const [expandedParents, setExpandedParents] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'parents');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [addBudgetSheetOpen, setAddBudgetSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [updatingBudgetId, setUpdatingBudgetId] = useState(null);
  const [categoryAmounts, setCategoryAmounts] = useState({});
  const [creatingBudgetId, setCreatingBudgetId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'sections', JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'parents', JSON.stringify([...expandedParents]));
  }, [expandedParents]);

  useEffect(() => {
    const budgetedCategoryIds = new Set(budgets.map(b => b.chart_account_id));

    const unbudgetedChildrenWithBudgetedParents = [...availableIncomeCategories, ...availableExpenseCategories]
      .filter(c => c.parent_account_id && budgetedCategoryIds.has(c.parent_account_id));

    const parentsToExpand = new Set(
      unbudgetedChildrenWithBudgetedParents.map(c => c.parent_account_id)
    );

    if (parentsToExpand.size > 0) {
      setExpandedParents(prev => {
        const newSet = new Set(prev);
        parentsToExpand.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  }, [availableIncomeCategories, availableExpenseCategories, budgets]);

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
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

  const deleteBudgetMutation = useMutation({
    mutationFn: (budgetId) => firstsavvy.entities.Budget.delete(budgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget removed successfully');
    },
    onError: (error) => {
      toast.error('Failed to remove budget');
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
      setCreatingBudgetId(null);
      toast.success('Budget created successfully');
    },
    onError: (error) => {
      setCreatingBudgetId(null);
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

  useEffect(() => {
    const initialAmounts = {};
    categories.forEach(category => {
      if (!categoryAmounts[category.id]) {
        initialAmounts[category.id] = {
          amount: historicalAverages[category.id] || 0,
          cadence: 'monthly'
        };
      }
    });
    if (Object.keys(initialAmounts).length > 0) {
      setCategoryAmounts(prev => ({ ...prev, ...initialAmounts }));
    }
  }, [categories, historicalAverages]);

  const handleAddBudget = (categoryId, explicitAmount, explicitCadence) => {
    const categoryData = categoryAmounts[categoryId] || { amount: historicalAverages[categoryId] || 0, cadence: 'monthly' };
    const amount = explicitAmount !== undefined ? explicitAmount : categoryData.amount;
    const cadence = explicitCadence || categoryData.cadence || 'monthly';

    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Get the category to check for parent
    const category = categories.find(c => c.id === categoryId);

    // If category has a parent, validate against parent budget
    if (category?.parent_account_id) {
      const parentBudget = getBudgetForCategory(category.parent_account_id);
      const siblingBudgets = budgets.filter(b =>
        b.chart_account_id !== categoryId &&
        categories.find(c => c.id === b.chart_account_id)?.parent_account_id === category.parent_account_id
      );

      const validation = validateChildBudgetAgainstParent(
        amount,
        cadence,
        parentBudget,
        siblingBudgets
      );

      if (!validation.isValid) {
        const parentCategory = categories.find(c => c.id === category.parent_account_id);
        const errorMessage = formatValidationError(validation, parentCategory?.display_name || 'Parent');
        toast.error(errorMessage);
        return;
      }
    }

    setCreatingBudgetId(categoryId);
    const budgetData = {
      chart_account_id: categoryId,
      allocated_amount: amount,
      cadence: cadence,
      is_active: true
    };

    createBudgetMutation.mutate(budgetData);
  };

  const handleAmountChange = (categoryId, newAmount, newCadence) => {
    setCategoryAmounts(prev => ({
      ...prev,
      [categoryId]: {
        amount: newAmount,
        cadence: newCadence || 'monthly'
      }
    }));
  };

  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
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
    // Find the budget being updated
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;

    // Find the category for this budget
    const category = categories.find(c => c.id === budget.chart_account_id);
    if (!category) return;

    // If category has a parent, validate against parent budget
    if (category.parent_account_id) {
      const parentBudget = getBudgetForCategory(category.parent_account_id);
      const siblingBudgets = budgets.filter(b =>
        b.id !== budgetId &&
        categories.find(c => c.id === b.chart_account_id)?.parent_account_id === category.parent_account_id
      );

      const validation = validateChildBudgetAgainstParent(
        newAmount,
        editedCadence,
        parentBudget,
        siblingBudgets
      );

      if (!validation.isValid) {
        const parentCategory = categories.find(c => c.id === category.parent_account_id);
        const errorMessage = formatValidationError(validation, parentCategory?.display_name || 'Parent');
        toast.error(errorMessage);
        return;
      }
    }

    setUpdatingBudgetId(budgetId);
    const updateData = {
      allocated_amount: newAmount,
      cadence: editedCadence
    };
    updateBudgetMutation.mutate({ id: budgetId, data: updateData });
  };

  const renderBudgetedCategoryRow = (category, index, isChild = false, allCategories = []) => {
    const budget = getBudgetForCategory(category.id);
    if (!budget) return null;

    const cadence = budget.cadence || 'monthly';
    const amount = budget.allocated_amount || 0;
    const values = getAllCadenceValues(amount, cadence);
    const isUpdating = updatingBudgetId === budget.id;
    const IconComponent = Icons[category.icon] || Icons.Circle;

    const children = allCategories
      .filter(c => c.parent_account_id === category.id)
      .sort((a, b) => {
        const nameA = (a.display_name || '').toLowerCase();
        const nameB = (b.display_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    const hasChildren = children.length > 0;
    const isParentExpanded = expandedParents.has(category.id);

    const rows = [];

    rows.push(
      <tr key={category.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${isChild ? 'bg-slate-50/50' : index % 2 === 0 ? 'bg-background' : 'bg-slate-50/30'}`}>
        <td className="px-4 border-r border-slate-100">
          <div className="flex items-center gap-2">
            {!isChild && hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-slate-200 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleParent(category.id);
                }}
              >
                {isParentExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                )}
              </Button>
            ) : (
              <div className={`w-5 flex-shrink-0 ${isChild ? 'ml-5' : ''}`}></div>
            )}
            <IconComponent className="w-5 h-5 flex-shrink-0" style={{ color: category.color }} />
            <span className={isChild ? 'text-slate-700' : ''}>
              {category.display_name}
            </span>
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

    if (hasChildren && isParentExpanded) {
      children.forEach((childCategory, childIndex) => {
        rows.push(...renderBudgetedCategoryRow(childCategory, index + childIndex + 1, true, allCategories));
      });
    }

    return rows;
  };

  const renderAvailableCategoryRow = (category, index, isChild = false, allCategories = []) => {
    const usage = categoryUsage[category.id];
    const everUsed = usage?.everUsed || false;
    const lastUsed = usage?.lastUsed;
    const IconComponent = Icons[category.icon] || Icons.Circle;
    const suggestedAmount = historicalAverages[category.id] || 0;
    const isCreating = creatingBudgetId === category.id;
    const hasBudget = getBudgetForCategory(category.id);

    const children = allCategories
      .filter(c => c.parent_account_id === category.id)
      .sort((a, b) => {
        const nameA = (a.display_name || '').toLowerCase();
        const nameB = (b.display_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    const hasChildren = children.length > 0;
    const isParentExpanded = expandedParents.has(category.id);

    const rows = [];

    const rowClassName = hasBudget
      ? `border-b border-slate-100 ${isChild ? 'bg-slate-50/50' : index % 2 === 0 ? 'bg-background' : 'bg-slate-50/30'} opacity-50`
      : `border-b border-slate-100 hover:bg-slate-50/50 ${isChild ? 'bg-slate-50/50' : index % 2 === 0 ? 'bg-background' : 'bg-slate-50/30'}`;

    rows.push(
      <tr key={category.id} className={rowClassName}>
        <td className="px-4 font-medium border-r border-slate-200">
          <div className="flex items-center gap-2">
            {!isChild && hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 hover:bg-slate-200 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleParent(category.id);
                }}
              >
                {isParentExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                )}
              </Button>
            ) : (
              <div className={`w-5 flex-shrink-0 ${isChild ? 'ml-5' : ''}`}></div>
            )}
            <IconComponent className="w-5 h-5 flex-shrink-0" style={{ color: category.color }} />
            <span className={isChild ? 'text-slate-700' : ''}>
              {category.display_name}
            </span>
            {hasBudget && (
              <Badge variant="secondary" className="text-xs ml-2">Budgeted</Badge>
            )}
          </div>
        </td>
        <td className="px-4 border-r border-slate-200">
          {hasBudget ? (
            <span className="text-muted-foreground text-sm">-</span>
          ) : everUsed ? (
            <Badge variant="secondary" className="text-xs">Yes</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">No</span>
          )}
        </td>
        <td className="px-4 text-muted-foreground text-sm border-r border-slate-200">
          {hasBudget ? '-' : lastUsed ? format(new Date(lastUsed), 'MMM d, yyyy') : '-'}
        </td>
        {hasBudget ? (
          <>
            <td className="px-4 border-r border-slate-200 text-muted-foreground text-sm">-</td>
            <td className="px-4 text-right"></td>
          </>
        ) : (
          <>
            <InlineEditableAmountWithCadence
              suggestedAmount={suggestedAmount}
              currentAmount={categoryAmounts[category.id]?.amount}
              currentCadence={categoryAmounts[category.id]?.cadence || 'monthly'}
              onAmountChange={(newAmount, newCadence) => handleAmountChange(category.id, newAmount, newCadence)}
              onEnter={(amount, cadence) => handleAddBudget(category.id, amount, cadence)}
              isLoading={isCreating}
              hasBorder={true}
            />
            <td className="px-4 text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddBudget(category.id)}
                disabled={isCreating || (categoryAmounts[category.id]?.amount || suggestedAmount) <= 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </td>
          </>
        )}
      </tr>
    );

    if (hasChildren && isParentExpanded) {
      children.forEach((childCategory, childIndex) => {
        rows.push(...renderAvailableCategoryRow(childCategory, index + childIndex + 1, true, allCategories));
      });
    }

    return rows;
  };

  const calculateTotals = (categories) => {
    const parentCategories = categories.filter(c => !c.parent_account_id);

    return parentCategories.reduce((totals, category) => {
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

    let parentCategories = categories.filter(c => !c.parent_account_id);

    if (!isBudgetedSection) {
      const childCategoriesWithBudgetedParents = categories.filter(c => {
        if (!c.parent_account_id) return false;
        const parentIsInThisSection = categories.some(cat => cat.id === c.parent_account_id);
        return !parentIsInThisSection;
      });

      const budgetedParentIds = new Set(
        childCategoriesWithBudgetedParents
          .map(c => c.parent_account_id)
          .filter(Boolean)
      );

      const allCategoriesInSystem = budgets.map(b => b.chartAccount).filter(Boolean);
      const budgetedParentsToShow = allCategoriesInSystem.filter(c =>
        budgetedParentIds.has(c.id)
      );

      parentCategories = [...parentCategories, ...budgetedParentsToShow];
    }

    // Sort parent categories alphabetically by display_name
    parentCategories.sort((a, b) => {
      const nameA = (a.display_name || '').toLowerCase();
      const nameB = (b.display_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

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
                          </div>
                        </th>
                        <th className="py-2 px-4 text-left font-normal w-[14%]">Daily</th>
                        <th className="py-2 px-4 text-left font-normal w-[14%]">Weekly</th>
                        <th className="py-2 px-4 text-left font-medium w-[14%] bg-slate-50/50">Monthly</th>
                        <th className="py-2 px-4 text-left font-normal w-[14%]">Yearly</th>
                        <th className="py-2 px-4 text-right font-bold w-[14%]">Action</th>
                      </>
                    ) : (
                      <>
                        <th
                          className="py-2 px-4 text-left font-bold w-[30%] cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleSection(sectionKey)}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            {categoryColumnLabel}
                          </div>
                        </th>
                        <th className="py-2 px-4 text-left font-normal w-[15%]">Ever Used</th>
                        <th className="py-2 px-4 text-left font-normal w-[15%]">Last Used</th>
                        <th className="py-2 px-4 text-right font-normal w-[20%]">Amount</th>
                        <th className="py-2 px-4 text-right font-normal w-[20%]">Action</th>
                      </>
                    )}
                  </tr>
                </thead>
                {!isCollapsed && (
                  <tbody>
                    {parentCategories.map((category, index) => renderRow(category, index, false, categories))}
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
                      <td className="px-4 py-2 border-r border-slate-100 bg-slate-50/50">
                        <div className="flex justify-between tabular-nums font-medium">
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

  const totalIncome = budgets
    .filter(b => b.chartAccount?.class === 'income' && !b.chartAccount?.parent_account_id)
    .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
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
