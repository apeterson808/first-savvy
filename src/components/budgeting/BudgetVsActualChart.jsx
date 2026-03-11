import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { convertCadence } from '@/utils/cadenceUtils';

export default function BudgetVsActualChart({ budgets, spendingByCategory, incomeByCategory }) {
  const [expandedSections, setExpandedSections] = useState({
    income: true,
    expenses: true
  });

  const incomeBudgets = budgets.filter(b => b.chartAccount?.class === 'income');
  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderCategoryBar = (budget, actual, isIncome) => {
    const budgetedAmount = convertCadence(
      parseFloat(budget.allocated_amount || 0),
      budget.cadence || 'monthly',
      'monthly'
    );
    const actualAmount = actual || 0;
    const percentage = budgetedAmount > 0 ? (actualAmount / budgetedAmount) * 100 : 0;

    const isOverBudget = !isIncome && actualAmount > budgetedAmount;
    const isUnderIncome = isIncome && actualAmount < budgetedAmount;

    let barColor = 'bg-blue-500';
    let bgColor = 'bg-blue-100';

    if (isIncome) {
      if (percentage >= 100) {
        barColor = 'bg-green-500';
        bgColor = 'bg-green-100';
      } else if (percentage >= 75) {
        barColor = 'bg-blue-500';
        bgColor = 'bg-blue-100';
      } else {
        barColor = 'bg-orange-500';
        bgColor = 'bg-orange-100';
      }
    } else {
      if (isOverBudget) {
        barColor = 'bg-red-500';
        bgColor = 'bg-red-100';
      } else if (percentage >= 90) {
        barColor = 'bg-orange-500';
        bgColor = 'bg-orange-100';
      } else if (percentage >= 75) {
        barColor = 'bg-blue-500';
        bgColor = 'bg-blue-100';
      } else {
        barColor = 'bg-green-500';
        bgColor = 'bg-green-100';
      }
    }

    const displayPercentage = Math.min(percentage, 100);

    return (
      <div key={budget.id} className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700 truncate flex-1 mr-2">
            {budget.chartAccount?.display_name || 'Unknown'}
          </span>
          <span className="text-slate-500 whitespace-nowrap">
            {Math.round(percentage)}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex-1 h-6 rounded-full ${bgColor} overflow-hidden relative`}>
            <div
              className={`h-full ${barColor} transition-all duration-300 ease-out flex items-center justify-end pr-2`}
              style={{ width: `${displayPercentage}%` }}
            >
              {displayPercentage > 15 && (
                <span className="text-[10px] font-semibold text-white">
                  ${actualAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
            {isOverBudget && percentage > 100 && (
              <div
                className="absolute top-0 right-0 h-full bg-red-600/30"
                style={{ width: `${Math.min(percentage - 100, 100)}%` }}
              />
            )}
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap w-16 text-right">
            ${budgetedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    );
  };

  const renderSection = (title, budgetsList, actualByCategory, isIncome, sectionKey) => {
    if (budgetsList.length === 0) return null;

    const isExpanded = expandedSections[sectionKey];
    const parentBudgets = budgetsList.filter(b => !b.chartAccount?.parent_account_id);

    const sortedBudgets = [...parentBudgets].sort((a, b) => {
      const aAmount = convertCadence(parseFloat(a.allocated_amount || 0), a.cadence || 'monthly', 'monthly');
      const bAmount = convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', 'monthly');
      return bAmount - aAmount;
    });

    const topBudgets = sortedBudgets.slice(0, 5);

    return (
      <div className="space-y-2">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center gap-2 w-full hover:bg-slate-50 -mx-2 px-2 py-1 rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {title}
          </span>
          <span className="text-xs text-slate-400">({budgetsList.length})</span>
        </button>

        {isExpanded && (
          <div className="space-y-3 mt-2">
            {topBudgets.map(budget =>
              renderCategoryBar(
                budget,
                actualByCategory[budget.chart_account_id] || 0,
                isIncome
              )
            )}
            {sortedBudgets.length > 5 && (
              <div className="text-xs text-slate-400 text-center pt-1">
                +{sortedBudgets.length - 5} more categories
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-sm border-slate-200 bg-white">
      <CardHeader className="pb-3 pt-4 px-5">
        <h3 className="text-sm font-semibold text-slate-900">Budget vs Actual</h3>
        <p className="text-xs text-slate-500 mt-0.5">Top categories this month</p>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-4">
        {renderSection('Income', incomeBudgets, incomeByCategory, true, 'income')}
        {renderSection('Expenses', expenseBudgets, spendingByCategory, false, 'expenses')}

        {(incomeBudgets.length === 0 && expenseBudgets.length === 0) && (
          <div className="text-center py-8 text-slate-400 text-sm">
            No budget data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
