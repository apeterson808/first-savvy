import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { convertCadence } from '@/utils/cadenceUtils';
import { startOfMonth, endOfMonth, differenceInDays } from 'date-fns';

const DEFAULT_COLORS = [
  '#52A5CE',
  '#AACC96',
  '#EF6F3C',
  '#FF7BAC',
  '#EFCE7B',
  '#D3B6D3',
  '#25533F',
  '#F4BEAE',
  '#876029',
  '#B8CEE8',
  '#6D1F42',
  '#AFAB23'
];

export default function BudgetLinearBar({ budgets, spendingByCategory, incomeByCategory, activeView, onHoverChange }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [activeIncomeIndex, setActiveIncomeIndex] = useState(null);

  const incomeBudgets = budgets.filter(b => b.chartAccount?.class === 'income');
  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

  const isExpenseView = activeView === 'expenses';
  const currentBudgets = isExpenseView ? expenseBudgets : incomeBudgets;
  const currentActuals = isExpenseView ? spendingByCategory : incomeByCategory;

  const chartData = currentBudgets
    .map((budget, index) => {
      const budgeted = convertCadence(parseFloat(budget.allocated_amount || 0), budget.cadence || 'monthly', 'monthly');
      const spent = currentActuals[budget.chart_account_id] || 0;
      return {
        name: budget.chartAccount?.display_name || budget.chartAccount?.account_detail || 'Uncategorized',
        budgeted,
        spent,
        color: budget.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      };
    })
    .filter(item => item.budgeted > 0 && item.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  const totalBudgeted = currentBudgets.reduce((sum, budget) => {
    const budgeted = convertCadence(parseFloat(budget.allocated_amount || 0), budget.cadence || 'monthly', 'monthly');
    return sum + budgeted;
  }, 0);

  const totalSpent = chartData.reduce((sum, item) => sum + item.spent, 0);
  const remaining = Math.max(0, totalBudgeted - totalSpent);

  const incomeChartData = incomeBudgets
    .map((budget, index) => {
      const budgeted = convertCadence(parseFloat(budget.allocated_amount || 0), budget.cadence || 'monthly', 'monthly');
      const earned = incomeByCategory[budget.chart_account_id] || 0;
      return {
        name: budget.chartAccount?.display_name || budget.chartAccount?.account_detail || 'Uncategorized',
        budgeted,
        earned,
        color: budget.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      };
    })
    .filter(item => item.budgeted > 0 && item.earned > 0)
    .sort((a, b) => b.earned - a.earned);

  const totalIncomeBudgeted = incomeBudgets.reduce((sum, budget) => {
    const budgeted = convertCadence(parseFloat(budget.allocated_amount || 0), budget.cadence || 'monthly', 'monthly');
    return sum + budgeted;
  }, 0);

  const totalIncomeEarned = incomeChartData.reduce((sum, item) => sum + item.earned, 0);
  const incomeRemaining = Math.max(0, totalIncomeBudgeted - totalIncomeEarned);

  const activeItem = activeIndex === 'remaining'
    ? {
        name: 'Unspent Budget',
        budgeted: totalBudgeted,
        spent: totalSpent,
        color: '#cbd5e1'
      }
    : activeIndex !== null
      ? chartData[activeIndex]
      : null;

  const activeIncomeItem = activeIncomeIndex === 'remaining'
    ? {
        name: 'Unearned Income',
        budgeted: totalIncomeBudgeted,
        spent: totalIncomeEarned,
        earned: totalIncomeEarned,
        color: '#cbd5e1'
      }
    : activeIncomeIndex !== null
      ? {
          ...incomeChartData[activeIncomeIndex],
          spent: incomeChartData[activeIncomeIndex].earned
        }
      : null;

  React.useEffect(() => {
    if (onHoverChange) {
      onHoverChange(activeItem || activeIncomeItem);
    }
  }, [activeItem, activeIncomeItem, onHoverChange]);

  // Calculate progress through the month
  const now = new Date();
  const monthStartDate = startOfMonth(now);
  const monthEndDate = endOfMonth(now);
  const totalDaysInMonth = differenceInDays(monthEndDate, monthStartDate) + 1;
  const daysPassed = differenceInDays(now, monthStartDate) + 1;
  const monthProgressPercentage = (daysPassed / totalDaysInMonth) * 100;

  const renderIncomeBar = () => {
    if (incomeChartData.length === 0 && totalIncomeBudgeted === 0) {
      return (
        <div className="flex h-8 bg-slate-100 rounded" />
      );
    }

    if (incomeChartData.length === 0 && totalIncomeBudgeted > 0) {
      return (
        <div className="relative flex h-8 rounded overflow-hidden">
          <div
            className="relative bg-slate-200 rounded-sm cursor-pointer transition-all duration-200 w-full"
            style={{
              opacity: activeIncomeIndex === null || activeIncomeIndex === 'remaining' ? 1 : 0.4,
              transform: activeIncomeIndex === 'remaining' ? 'scaleY(1.1)' : 'scaleY(1)',
            }}
            onMouseEnter={() => setActiveIncomeIndex('remaining')}
            onMouseLeave={() => setActiveIncomeIndex(null)}
          >
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-medium px-1">
              <span className="truncate">Remaining Income</span>
            </div>
          </div>
          <div
            className="absolute top-0 h-full w-0.5 bg-slate-500 z-30 opacity-70"
            style={{ left: `${monthProgressPercentage}%` }}
            title={`${daysPassed} of ${totalDaysInMonth} days through the month`}
          />
        </div>
      );
    }

    return (
      <div className="relative flex h-8 rounded overflow-hidden gap-1">
        {incomeChartData.map((item, index) => {
          const percentage = (item.earned / totalIncomeForPercentage) * 100;
          return (
            <div
              key={index}
              className="relative group transition-all duration-200 cursor-pointer rounded-sm"
              style={{
                width: `${percentage}%`,
                backgroundColor: '#22c55e',
                opacity: activeIncomeIndex === null || activeIncomeIndex === index ? 1 : 0.4,
                transform: activeIncomeIndex === index ? 'scaleY(1.1)' : 'scaleY(1)',
                zIndex: activeIncomeIndex === index ? 10 : 1
              }}
              onMouseEnter={() => setActiveIncomeIndex(index)}
              onMouseLeave={() => setActiveIncomeIndex(null)}
            >
              {percentage > 8 && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium px-1">
                  <span className="truncate">{item.name}</span>
                </div>
              )}
            </div>
          );
        })}
        {incomeRemaining > 0 && (
          <div
            className="relative bg-slate-200 rounded-sm cursor-pointer transition-all duration-200"
            style={{
              width: `${(incomeRemaining / totalIncomeForPercentage) * 100}%`,
              opacity: activeIncomeIndex === null || activeIncomeIndex === 'remaining' ? 1 : 0.4,
              transform: activeIncomeIndex === 'remaining' ? 'scaleY(1.1)' : 'scaleY(1)',
              zIndex: activeIncomeIndex === 'remaining' ? 10 : 1
            }}
            onMouseEnter={() => setActiveIncomeIndex('remaining')}
            onMouseLeave={() => setActiveIncomeIndex(null)}
          >
            {((incomeRemaining / totalIncomeForPercentage) * 100) > 8 && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-medium px-1">
                <span className="truncate">Remaining</span>
              </div>
            )}
          </div>
        )}
        <div
          className="absolute top-0 h-full w-0.5 bg-slate-500 z-30 opacity-70"
          style={{ left: `${monthProgressPercentage}%` }}
          title={`${daysPassed} of ${totalDaysInMonth} days through the month`}
        />
      </div>
    );
  };

  if (chartData.length === 0 && totalBudgeted === 0) {
    return (
      <Card className="shadow-sm border-slate-200 bg-white" onMouseLeave={() => { setActiveIndex(null); setActiveIncomeIndex(null); }}>
        <div className="p-4 space-y-2">
          {renderIncomeBar()}
          <div className="flex h-8 bg-slate-100 rounded" />
        </div>
      </Card>
    );
  }

  if (chartData.length === 0 && totalBudgeted > 0) {
    return (
      <Card className="shadow-sm border-slate-200 bg-white" onMouseLeave={() => { setActiveIndex(null); setActiveIncomeIndex(null); }}>
        <div className="p-4 space-y-2">
          {renderIncomeBar()}
          <div className="relative flex h-8 rounded overflow-hidden">
            <div
              className="relative bg-slate-200 rounded-sm cursor-pointer transition-all duration-200 w-full"
              style={{
                opacity: activeIndex === null || activeIndex === 'remaining' ? 1 : 0.4,
                transform: activeIndex === 'remaining' ? 'scaleY(1.1)' : 'scaleY(1)',
              }}
              onMouseEnter={() => setActiveIndex('remaining')}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-medium px-1">
                <span className="truncate">Remaining Budget</span>
              </div>
            </div>
            <div
              className="absolute top-0 h-full w-0.5 bg-slate-500 z-30 opacity-70"
              style={{ left: `${monthProgressPercentage}%` }}
              title={`${daysPassed} of ${totalDaysInMonth} days through the month`}
            />
          </div>
        </div>
      </Card>
    );
  }

  const totalForPercentage = totalBudgeted > 0 ? totalBudgeted : totalSpent;
  const totalIncomeForPercentage = totalIncomeBudgeted > 0 ? totalIncomeBudgeted : totalIncomeEarned;

  return (
    <Card className="shadow-sm border-slate-200 bg-white" onMouseLeave={() => { setActiveIndex(null); setActiveIncomeIndex(null); }}>
      <div className="p-4 space-y-2">
        {renderIncomeBar()}
        <div className="relative flex h-8 rounded overflow-hidden gap-1">
          {chartData.map((item, index) => {
            const percentage = (item.spent / totalForPercentage) * 100;
            return (
              <div
                key={index}
                className="relative group transition-all duration-200 cursor-pointer rounded-sm"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: item.color,
                  opacity: activeIndex === null || activeIndex === index ? 1 : 0.4,
                  transform: activeIndex === index ? 'scaleY(1.1)' : 'scaleY(1)',
                  zIndex: activeIndex === index ? 10 : 1
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {percentage > 8 && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium px-1">
                    <span className="truncate">{item.name}</span>
                  </div>
                )}
              </div>
            );
          })}
          {remaining > 0 && (
            <div
              className="relative bg-slate-200 rounded-sm cursor-pointer transition-all duration-200"
              style={{
                width: `${(remaining / totalForPercentage) * 100}%`,
                opacity: activeIndex === null || activeIndex === 'remaining' ? 1 : 0.4,
                transform: activeIndex === 'remaining' ? 'scaleY(1.1)' : 'scaleY(1)',
                zIndex: activeIndex === 'remaining' ? 10 : 1
              }}
              onMouseEnter={() => setActiveIndex('remaining')}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {((remaining / totalForPercentage) * 100) > 8 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-medium px-1">
                  <span className="truncate">Remaining</span>
                </div>
              )}
            </div>
          )}
          <div
            className="absolute top-0 h-full w-0.5 bg-slate-500 z-30 opacity-70"
            style={{ left: `${monthProgressPercentage}%` }}
            title={`${daysPassed} of ${totalDaysInMonth} days through the month`}
          />
        </div>
      </div>
    </Card>
  );
}
