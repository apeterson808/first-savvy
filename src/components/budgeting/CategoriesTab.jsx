import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBudgetData } from '@/hooks/useBudgetData';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, Minus, Pencil } from 'lucide-react';
import { formatAccountingAmount, getAllCadenceValues, convertCadence } from '@/utils/cadenceUtils';
import { Badge } from '@/components/ui/badge';
import BudgetAllocationDonut from './BudgetAllocationDonut';
import InlineEditableAmount from './InlineEditableAmount';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { getAccountTypeLabel, getAccountTypeOrder } from '@/utils/accountTypeLabels';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { validateChildBudgetAgainstParent } from '@/utils/budgetValidation';
import ParentBudgetDialog from './ParentBudgetDialog';
import AccountCreationWizard from '@/components/banking/AccountCreationWizard';

const STORAGE_KEY_PREFIX = 'categoriesTab_collapsed_';

const CategoriesTab = forwardRef((props, ref) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {
    budgets,
    transactions,
    allIncomeCategories,
    allExpenseCategories,
    categoryUsage,
    categories,
    isLoading
  } = useBudgetData();


  const [collapsedTypes, setCollapsedTypes] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'types');
    return saved ? JSON.parse(saved) : {};
  });

  const [expandedParents, setExpandedParents] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'parents');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [updatingBudgetId, setUpdatingBudgetId] = useState(null);
  const [togglingBudgetId, setTogglingBudgetId] = useState(null);
  const [showCategoryWizard, setShowCategoryWizard] = useState(false);
  const [wizardInitialClass, setWizardInitialClass] = useState(null);
  const [parentBudgetDialog, setParentBudgetDialog] = useState({
    open: false,
    parentCategory: null,
    parentBudget: null,
    childCategory: null,
    requestedAmount: 0,
    requestedCadence: 'monthly',
    totalSiblingsAmount: 0,
    overflow: 0,
    siblingBudgets: [],
    pendingUpdate: null
  });

  useImperativeHandle(ref, () => ({
    openCategoryWizard: () => {
      setWizardInitialClass(null);
      setShowCategoryWizard(true);
    }
  }));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'types', JSON.stringify(collapsedTypes));
  }, [collapsedTypes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'parents', JSON.stringify([...expandedParents]));
  }, [expandedParents]);

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

      console.log('handleToggleBudget - categoryWithBudget:', categoryWithBudget);
      console.log('handleToggleBudget - parent_account_id:', categoryWithBudget.parent_account_id);

      if (categoryWithBudget.parent_account_id) {
        console.log('Has parent - showing dialog');
        const parentCategory = categories.find(c => c.id === categoryWithBudget.parent_account_id);
        const parentBudget = budgets.find(b => b.chart_account_id === categoryWithBudget.parent_account_id);

        const siblingBudgets = budgets
          .filter(b => {
            const siblingCategory = categories.find(c => c.id === b.chart_account_id);
            return siblingCategory?.parent_account_id === categoryWithBudget.parent_account_id;
          })
          .map(b => {
            const siblingCategory = categories.find(c => c.id === b.chart_account_id);
            return {
              id: b.id,
              categoryName: siblingCategory?.display_name || 'Unknown',
              allocated_amount: b.allocated_amount,
              cadence: b.cadence
            };
          });

        const validation = validateChildBudgetAgainstParent(
          suggestedAmount,
          'monthly',
          parentBudget,
          budgets.filter(b => {
            const siblingCategory = categories.find(c => c.id === b.chart_account_id);
            return siblingCategory?.parent_account_id === categoryWithBudget.parent_account_id;
          }),
          null
        );

        const totalSiblingsAmount = siblingBudgets
          .reduce((sum, b) => {
            return sum + convertCadence(b.allocated_amount || 0, b.cadence || 'monthly', 'monthly');
          }, 0);

        setParentBudgetDialog({
          open: true,
          parentCategory,
          parentBudget,
          childCategory: categoryWithBudget,
          requestedAmount: suggestedAmount,
          requestedCadence: 'monthly',
          totalSiblingsAmount,
          overflow: validation.overflow,
          siblingBudgets,
          pendingUpdate: {
            isNewBudget: true,
            budgetData: {
              chart_account_id: categoryWithBudget.id,
              allocated_amount: suggestedAmount,
              cadence: 'monthly',
              is_active: true
            }
          }
        });
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

  const handleEditCategory = (category) => {
    if (category?.id) {
      navigate(`/Banking/account/${category.id}`);
    }
  };

  const handleUpdateBudgetAmount = async (budgetId, newAmount, editedCadence) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;

    const category = categories.find(c => c.id === budget.chart_account_id);
    if (!category) return;

    if (category.parent_account_id) {
      const parentCategory = categories.find(c => c.id === category.parent_account_id);
      const parentBudget = budgets.find(b => b.chart_account_id === category.parent_account_id);

      const siblingBudgets = budgets
        .filter(b => {
          const siblingCategory = categories.find(c => c.id === b.chart_account_id);
          return siblingCategory?.parent_account_id === category.parent_account_id && b.id !== budgetId;
        })
        .map(b => {
          const siblingCategory = categories.find(c => c.id === b.chart_account_id);
          return {
            id: b.id,
            categoryName: siblingCategory?.display_name || 'Unknown',
            allocated_amount: b.allocated_amount,
            cadence: b.cadence
          };
        });

      const validation = validateChildBudgetAgainstParent(
        newAmount,
        editedCadence,
        parentBudget,
        budgets.filter(b => {
          const siblingCategory = categories.find(c => c.id === b.chart_account_id);
          return siblingCategory?.parent_account_id === category.parent_account_id;
        }),
        budgetId
      );

      const totalSiblingsAmount = siblingBudgets
        .reduce((sum, b) => {
          return sum + convertCadence(b.allocated_amount || 0, b.cadence || 'monthly', editedCadence);
        }, 0);

      setParentBudgetDialog({
        open: true,
        parentCategory,
        parentBudget,
        childCategory: category,
        requestedAmount: newAmount,
        requestedCadence: editedCadence,
        totalSiblingsAmount,
        overflow: validation.overflow,
        siblingBudgets,
        pendingUpdate: { budgetId, newAmount, editedCadence }
      });
      return;
    }

    setUpdatingBudgetId(budgetId);
    const updateData = {
      allocated_amount: newAmount,
      cadence: editedCadence
    };
    updateBudgetMutation.mutate({ id: budgetId, data: updateData });
  };

  const handleParentBudgetConfirm = async (result) => {
    const { parentCategory, parentBudget, pendingUpdate, siblingBudgets, requestedCadence } = parentBudgetDialog;
    const { parentAmount, childAmount, siblingAmounts } = result;

    try {
      const parentCadence = parentBudget?.cadence || 'monthly';
      const displayCadence = requestedCadence;

      if (parentBudget) {
        await firstsavvy.entities.Budget.update(parentBudget.id, {
          allocated_amount: convertCadence(parentAmount, displayCadence, parentCadence)
        });
      } else {
        await firstsavvy.entities.Budget.create({
          chart_account_id: parentCategory.id,
          allocated_amount: convertCadence(parentAmount, displayCadence, 'monthly'),
          cadence: 'monthly',
          is_active: true
        });
      }

      for (const siblingBudget of siblingBudgets || []) {
        const editedAmount = parseFloat(siblingAmounts[siblingBudget.id]);
        const originalAmount = convertCadence(
          siblingBudget.allocated_amount,
          siblingBudget.cadence,
          displayCadence
        );

        if (!isNaN(editedAmount) && editedAmount !== originalAmount) {
          await firstsavvy.entities.Budget.update(siblingBudget.id, {
            allocated_amount: convertCadence(editedAmount, displayCadence, siblingBudget.cadence)
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['budgets'] });

      if (pendingUpdate) {
        if (pendingUpdate.isNewBudget) {
          setTogglingBudgetId(pendingUpdate.budgetData.chart_account_id);
          createBudgetMutation.mutate({
            ...pendingUpdate.budgetData,
            allocated_amount: convertCadence(childAmount, displayCadence, 'monthly')
          });
        } else {
          setUpdatingBudgetId(pendingUpdate.budgetId);
          const budget = budgets.find(b => b.id === pendingUpdate.budgetId);
          const targetCadence = budget?.cadence || 'monthly';
          updateBudgetMutation.mutate({
            id: pendingUpdate.budgetId,
            data: {
              allocated_amount: convertCadence(childAmount, displayCadence, targetCadence),
              cadence: targetCadence
            }
          });
        }
      }

      setParentBudgetDialog({
        open: false,
        parentCategory: null,
        parentBudget: null,
        childCategory: null,
        requestedAmount: 0,
        requestedCadence: 'monthly',
        totalSiblingsAmount: 0,
        overflow: 0,
        siblingBudgets: [],
        pendingUpdate: null
      });

      toast.success(parentBudget ? 'Parent budget updated' : 'Parent budget created');
    } catch (error) {
      toast.error('Failed to update parent budget');
      console.error(error);
    }
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

    const textColorClass = (isInactive || hasSuggestion || isNoBudget) ? 'text-slate-600 italic opacity-70' : 'text-slate-900';
    const isToggling = togglingBudgetId === (budget?.id || categoryWithBudget.id);

    const cadence = budget?.cadence || 'monthly';
    const amount = budget?.allocated_amount || 0;
    const values = budget ? getAllCadenceValues(amount, cadence) :
      hasSuggestion ? getAllCadenceValues(suggestedAmount, 'monthly') :
      { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
    const isUpdating = updatingBudgetId === budget?.id;

    const rowContent = (
      <tr key={categoryWithBudget.id} className={`border-b border-slate-200 transition-colors hover:bg-slate-50`}>
        <td className="px-4 py-0.5">
          <div className={`flex items-center gap-2 ${!isChild ? 'pl-2' : 'pl-2'}`}>
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
              <div className={`w-5 flex-shrink-0 ${isChild ? 'ml-6' : ''}`}></div>
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
              className="text-slate-600 italic opacity-70"
              isSuggested={true}
              suppressTooltip={true}
            />
            <InlineEditableAmount
              value={values.weekly}
              cadence="weekly"
              isActiveCadence={false}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget?.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={true}
              className="text-slate-600 italic opacity-70"
              isSuggested={true}
              suppressTooltip={true}
            />
            <InlineEditableAmount
              value={values.monthly}
              cadence="monthly"
              isActiveCadence={true}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget?.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              isMonthlyColumn={true}
              disabled={true}
              className="text-slate-600 italic opacity-70"
              isSuggested={true}
              suppressTooltip={true}
            />
            <InlineEditableAmount
              value={values.yearly}
              cadence="yearly"
              isActiveCadence={false}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget?.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={true}
              className="text-slate-600 italic opacity-70"
              isSuggested={true}
              suppressTooltip={true}
            />
          </>
        ) : isNoBudget ? (
          <>
            <td className="px-4 py-0.5 text-center text-slate-600 italic opacity-70">-</td>
            <td className="px-4 py-0.5 text-center text-slate-600 italic opacity-70">-</td>
            <td className="px-4 py-0.5 text-center text-slate-600 italic opacity-70">-</td>
            <td className="px-4 py-0.5 text-center text-slate-600 italic opacity-70">-</td>
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
              className={isInactive ? 'text-slate-500 italic opacity-40' : 'text-slate-900'}
            />
            <InlineEditableAmount
              value={values.weekly}
              cadence="weekly"
              isActiveCadence={cadence === 'weekly'}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={isDisabled}
              className={isInactive ? 'text-slate-500 italic opacity-40' : 'text-slate-900'}
            />
            <InlineEditableAmount
              value={values.monthly}
              cadence="monthly"
              isActiveCadence={cadence === 'monthly'}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              isMonthlyColumn={true}
              disabled={isDisabled}
              className={isInactive ? 'text-slate-500 italic opacity-40' : 'text-slate-900'}
            />
            <InlineEditableAmount
              value={values.yearly}
              cadence="yearly"
              isActiveCadence={cadence === 'yearly'}
              onUpdate={(newAmount, editedCadence) => handleUpdateBudgetAmount(budget.id, newAmount, editedCadence)}
              isLoading={isUpdating}
              disabled={isDisabled}
              className={isInactive ? 'text-slate-500 italic opacity-40' : 'text-slate-900'}
            />
          </>
        )}
        <td className="px-4 py-0.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>
                  <p>{budgetStatus === 'active' ? 'Remove from budget' : 'Add to budget'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditCategory(categoryWithBudget)}
              className="h-7 w-7 p-0 hover:bg-slate-100"
            >
              <Pencil className="h-3.5 w-3.5 text-slate-600" />
            </Button>
          </div>
        </td>
      </tr>
    );

    if (hasSuggestion) {
      rows.push(
        <TooltipProvider key={`tooltip-${categoryWithBudget.id}`}>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              {rowContent}
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Suggested amount based on historical spending</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else {
      rows.push(rowContent);
    }

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
        <h2 className="text-lg font-semibold text-slate-800 mb-3">{title}</h2>
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No categories available
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 px-4 text-left font-medium text-slate-700 w-[30%]">
                    {categoryColumnLabel}
                  </th>
                  <th className="py-2 px-4 text-center font-medium text-slate-700 w-[14%]">Daily</th>
                  <th className="py-2 px-4 text-center font-medium text-slate-700 w-[14%]">Weekly</th>
                  <th className="py-2 px-4 text-center font-medium text-slate-700 w-[14%]">Monthly</th>
                  <th className="py-2 px-4 text-center font-medium text-slate-700 w-[14%]">Yearly</th>
                  <th className="py-2 px-4 text-right font-medium text-slate-700 w-[14%]">Action</th>
                </tr>
              </thead>
              {sortedTypes.map(accountType => {
                const typeCategories = groupedByType[accountType];
                const typeKey = `${sectionKey}_${accountType}`;
                const isTypeCollapsed = collapsedTypes[typeKey];

                const sortedTypeCategories = [...typeCategories].sort((a, b) => {
                  const nameA = (a.display_name || '').toLowerCase();
                  const nameB = (b.display_name || '').toLowerCase();
                  return nameA.localeCompare(nameB);
                });

                const typeTotals = sortedTypeCategories.reduce((totals, category) => {
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

                const typeDailyFormatted = formatAccountingAmount(typeTotals.daily);
                const typeWeeklyFormatted = formatAccountingAmount(typeTotals.weekly);
                const typeMonthlyFormatted = formatAccountingAmount(typeTotals.monthly);
                const typeYearlyFormatted = formatAccountingAmount(typeTotals.yearly);

                let typeRowIndex = 0;

                return (
                  <tbody key={accountType}>
                    <tr className={`border-b border-slate-200`}>
                      <td
                        className="px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => toggleType(typeKey)}
                      >
                        <div className="flex items-center gap-2">
                          {isTypeCollapsed ? <ChevronRight className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
                          <span className="text-sm font-medium text-slate-700 truncate">{getAccountTypeLabel(accountType)}</span>
                        </div>
                      </td>
                      {isTypeCollapsed ? (
                        <>
                          <td className="px-4 py-2 text-center">
                            <div className="inline-flex items-center gap-1 tabular-nums text-slate-600 text-sm">
                              <span>{typeDailyFormatted.sign}</span>
                              <span>{typeDailyFormatted.amount}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="inline-flex items-center gap-1 tabular-nums text-slate-600 text-sm">
                              <span>{typeWeeklyFormatted.sign}</span>
                              <span>{typeWeeklyFormatted.amount}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="inline-flex items-center gap-1 tabular-nums text-slate-700 text-sm font-medium">
                              <span>{typeMonthlyFormatted.sign}</span>
                              <span>{typeMonthlyFormatted.amount}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="inline-flex items-center gap-1 tabular-nums text-slate-600 text-sm">
                              <span>{typeYearlyFormatted.sign}</span>
                              <span>{typeYearlyFormatted.amount}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2"></td>
                        </>
                      ) : (
                        <td colSpan={5}></td>
                      )}
                    </tr>
                    {!isTypeCollapsed && sortedTypeCategories.map((category) => {
                      const rows = renderUnifiedCategoryRow(category, typeRowIndex, false, categories);
                      typeRowIndex += rows.length;
                      return rows;
                    })}
                  </tbody>
                );
              })}
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-2 font-medium text-slate-700">{totalLabel}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="inline-flex items-center gap-1 tabular-nums text-slate-700">
                      <span>{dailyFormatted.sign}</span>
                      <span>{dailyFormatted.amount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="inline-flex items-center gap-1 tabular-nums text-slate-700">
                      <span>{weeklyFormatted.sign}</span>
                      <span>{weeklyFormatted.amount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="inline-flex items-center gap-1 tabular-nums font-medium text-slate-700">
                      <span>{monthlyFormatted.sign}</span>
                      <span>{monthlyFormatted.amount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="inline-flex items-center gap-1 tabular-nums text-slate-700">
                      <span>{yearlyFormatted.sign}</span>
                      <span>{yearlyFormatted.amount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2"></td>
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

      <ParentBudgetDialog
        open={parentBudgetDialog.open}
        onOpenChange={(open) => setParentBudgetDialog(prev => ({ ...prev, open }))}
        parentCategory={parentBudgetDialog.parentCategory}
        parentBudget={parentBudgetDialog.parentBudget}
        childCategory={parentBudgetDialog.childCategory}
        requestedAmount={parentBudgetDialog.requestedAmount}
        requestedCadence={parentBudgetDialog.requestedCadence}
        totalSiblingsAmount={parentBudgetDialog.totalSiblingsAmount}
        overflow={parentBudgetDialog.overflow}
        siblingBudgets={parentBudgetDialog.siblingBudgets}
        onConfirm={handleParentBudgetConfirm}
        onCancel={() => setParentBudgetDialog(prev => ({ ...prev, open: false }))}
      />

      <AccountCreationWizard
        open={showCategoryWizard}
        onOpenChange={setShowCategoryWizard}
        initialAccountType="budget"
        initialClass={wizardInitialClass}
        onAccountCreated={() => {
          queryClient.invalidateQueries(['chartAccounts']);
          queryClient.invalidateQueries(['budgets']);
        }}
      />
    </div>
  );
});

CategoriesTab.displayName = 'CategoriesTab';

export default CategoriesTab;
