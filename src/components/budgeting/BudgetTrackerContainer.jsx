import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import BudgetProgressPill from './BudgetProgressPill';
import { convertCadence } from '@/utils/cadenceUtils';
import { format } from 'date-fns';
import { getAccountTypeLabel, getAccountTypeOrder } from '@/utils/accountTypeLabels';

export default function BudgetTrackerContainer({ budgets, spendingByCategory, incomeByCategory, monthStart, monthEnd, hoveredCategory }) {
  const [collapsedTypes, setCollapsedTypes] = useState({});
  const [expandedParents, setExpandedParents] = useState({});

  const incomeBudgets = budgets.filter(b => b.chartAccount?.class === 'income');
  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

  const calculateSpendingWithChildren = (categoryId) => {
    const directSpending = spendingByCategory[categoryId] || 0;
    const childBudgets = budgets.filter(b => b.chartAccount?.parent_account_id === categoryId);
    const childSpending = childBudgets.reduce((sum, childBudget) => {
      return sum + (spendingByCategory[childBudget.chart_account_id] || 0);
    }, 0);
    return directSpending + childSpending;
  };

  const calculateIncomeWithChildren = (categoryId) => {
    const directIncome = incomeByCategory[categoryId] || 0;
    const childBudgets = budgets.filter(b => b.chartAccount?.parent_account_id === categoryId);
    const childIncome = childBudgets.reduce((sum, childBudget) => {
      return sum + (incomeByCategory[childBudget.chart_account_id] || 0);
    }, 0);
    return directIncome + childIncome;
  };

  const toggleParent = (parentId) => {
    setExpandedParents(prev => ({
      ...prev,
      [parentId]: !prev[parentId]
    }));
  };

  const totalIncomeBudgeted = incomeBudgets.reduce((sum, b) => {
    const baseAmount = parseFloat(b.allocated_amount || 0);
    const rolloverAmount = parseFloat(b.accumulated_rollover || 0);
    const rolloverEnabled = b.rollover_enabled || false;
    const effectiveAmount = rolloverEnabled ? baseAmount + rolloverAmount : baseAmount;
    return sum + convertCadence(effectiveAmount, b.cadence || 'monthly', 'monthly');
  }, 0);

  const totalExpenseBudgeted = expenseBudgets.reduce((sum, b) => {
    const baseAmount = parseFloat(b.allocated_amount || 0);
    const rolloverAmount = parseFloat(b.accumulated_rollover || 0);
    const rolloverEnabled = b.rollover_enabled || false;
    const effectiveAmount = rolloverEnabled ? baseAmount + rolloverAmount : baseAmount;
    return sum + convertCadence(effectiveAmount, b.cadence || 'monthly', 'monthly');
  }, 0);

  const totalIncomeActual = incomeBudgets.reduce((sum, b) => {
    const categoryId = b.chart_account_id;
    return sum + (incomeByCategory[categoryId] || 0);
  }, 0);

  const totalExpenseActual = expenseBudgets.reduce((sum, b) => {
    const categoryId = b.chart_account_id;
    return sum + (spendingByCategory[categoryId] || 0);
  }, 0);

  const incomePercentage = totalIncomeBudgeted > 0 ? (totalIncomeActual / totalIncomeBudgeted) * 100 : 0;
  const expensePercentage = totalExpenseBudgeted > 0 ? (totalExpenseActual / totalExpenseBudgeted) * 100 : 0;

  const netBudgeted = totalIncomeBudgeted - totalExpenseBudgeted;
  const netActual = totalIncomeActual - totalExpenseActual;

  const toggleType = (typeKey) => {
    setCollapsedTypes(prev => ({
      ...prev,
      [typeKey]: !prev[typeKey]
    }));
  };

  const groupBudgetsByType = (budgetsList) => {
    const grouped = {};
    budgetsList.forEach(budget => {
      const accountType = budget.chartAccount?.account_type || 'uncategorized';
      if (!grouped[accountType]) {
        grouped[accountType] = [];
      }
      grouped[accountType].push(budget);
    });
    return grouped;
  };

  const renderSection = (title, budgetsList, actualByCategory, isIncome, sectionKey) => {
    const count = budgetsList.length;

    if (count === 0) {
      return null;
    }

    const groupedByType = groupBudgetsByType(budgetsList);
    const sortedTypes = Object.keys(groupedByType).sort((a, b) => {
      return getAccountTypeOrder(a) - getAccountTypeOrder(b);
    });

    return (
      <Card className="shadow-sm border-slate-200 bg-white">
        <CardHeader className="pb-3 pt-4 px-6">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-4 space-y-4">
            {sortedTypes.map(accountType => {
              const typeBudgets = groupedByType[accountType];
              const typeKey = `${sectionKey}_${accountType}`;
              const isTypeCollapsed = collapsedTypes[typeKey];

              const parentBudgets = typeBudgets.filter(b => !b.chartAccount?.parent_account_id);
              const childBudgets = typeBudgets.filter(b => b.chartAccount?.parent_account_id);

              const sortedBudgets = [...parentBudgets].sort((a, b) => {
                const aName = (a.chartAccount?.display_name || '').toLowerCase();
                const bName = (b.chartAccount?.display_name || '').toLowerCase();
                return aName.localeCompare(bName);
              });

              return (
                <div key={accountType} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleType(typeKey)}
                  >
                    {isTypeCollapsed ? <ChevronRight className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
                    <span className="text-sm font-medium text-slate-700">{getAccountTypeLabel(accountType)}</span>
                  </div>
                  {!isTypeCollapsed && (
                    <div className="px-4 py-3 space-y-3">
                      {sortedBudgets.map(budget => {
                        const children = childBudgets.filter(c => c.chartAccount?.parent_account_id === budget.chart_account_id);
                        const hasChildren = children.length > 0;
                        const isExpanded = expandedParents[budget.id] !== false;

                        return (
                          <div key={budget.id}>
                            <div className="relative">
                              <BudgetProgressPill
                                budget={budget}
                                actualAmount={isIncome ? calculateIncomeWithChildren(budget.chart_account_id) : calculateSpendingWithChildren(budget.chart_account_id)}
                                isIncome={isIncome}
                                isParent={hasChildren}
                                isExpanded={isExpanded}
                                onToggle={hasChildren ? () => toggleParent(budget.id) : undefined}
                              />
                            </div>
                            {hasChildren && isExpanded && (
                              <div className="ml-6 mt-2 space-y-2">
                                {children.map(childBudget => {
                                  const baseAmount = parseFloat(childBudget.allocated_amount || 0);
                                  const rolloverAmount = parseFloat(childBudget.accumulated_rollover || 0);
                                  const rolloverEnabled = childBudget.rollover_enabled || false;
                                  const effectiveAmount = rolloverEnabled ? baseAmount + rolloverAmount : baseAmount;
                                  return (
                                    <div key={childBudget.id}>
                                      <BudgetProgressPill
                                        budget={childBudget}
                                        actualAmount={actualByCategory[childBudget.chart_account_id] || 0}
                                        isIncome={isIncome}
                                        isChild={true}
                                        allocatedAmount={convertCadence(effectiveAmount, childBudget.cadence || 'monthly', 'monthly')}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <div className="space-y-4">
        {renderSection('Income Categories', incomeBudgets, incomeByCategory, true, 'income')}
        {renderSection('Expense Categories', expenseBudgets, spendingByCategory, false, 'expense')}

        {(incomeBudgets.length === 0 && expenseBudgets.length === 0) && (
          <Card className="shadow-sm border-slate-200 bg-white">
            <CardContent className="pt-12 pb-12 text-center">
              <p className="text-slate-500 mb-2">No budgets have been set up yet.</p>
              <p className="text-sm text-slate-400">
                Go to the Categories tab to create your first budget.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="p-4">
            {hoveredCategory ? (
              <div>
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: hoveredCategory.color }}
                    />
                    <h3 className="text-sm font-semibold text-slate-900">{hoveredCategory.name}</h3>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {((hoveredCategory.spent / hoveredCategory.budgeted) * 100).toFixed(1)}% used
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Budgeted</div>
                    <div className="text-xl font-bold text-slate-900">
                      ${hoveredCategory.budgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Actual</div>
                    <div className="text-xl font-bold text-slate-900">
                      ${hoveredCategory.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Remaining</div>
                    <div className={`text-xl font-bold ${hoveredCategory.budgeted - hoveredCategory.spent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {hoveredCategory.budgeted - hoveredCategory.spent >= 0 ? '+' : '-'}${Math.abs(hoveredCategory.budgeted - hoveredCategory.spent).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Budget Overview</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {format(monthStart, 'MMM d')} - {format(monthEnd, 'MMM d, yyyy')}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3 h-3 text-green-600" />
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Income</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      ${totalIncomeActual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500">
                      of ${totalIncomeBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} budgeted
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingDown className="w-3 h-3 text-red-600" />
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Expenses</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      ${totalExpenseActual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500">
                      of ${totalExpenseBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} budgeted
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Net</span>
                    </div>
                    <div className={`text-xl font-bold ${netActual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {netActual >= 0 ? '+' : '-'}${Math.abs(netActual).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500">
                      vs {netBudgeted >= 0 ? '+' : '-'}${Math.abs(netBudgeted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} planned
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
