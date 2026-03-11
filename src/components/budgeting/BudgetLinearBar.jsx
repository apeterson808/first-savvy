import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { convertCadence } from '@/utils/cadenceUtils';

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

export default function BudgetLinearBar({ budgets, spendingByCategory, incomeByCategory, activeView }) {
  const [activeIndex, setActiveIndex] = useState(null);

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

  const totalSpent = chartData.reduce((sum, item) => sum + item.spent, 0);
  const activeItem = activeIndex !== null ? chartData[activeIndex] : null;

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-sm border-slate-200 bg-white p-4" onMouseLeave={() => setActiveIndex(null)}>
      <div className="flex items-center gap-6">
        <div className="text-center min-w-[140px]">
          {activeItem ? (
            <>
              <p className="text-2xl font-bold text-slate-900">
                ${activeItem.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs font-medium capitalize" style={{ color: activeItem.color }}>
                {activeItem.name}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-900">
                ${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500">Total Spent</p>
            </>
          )}
        </div>

        <div className="flex-1 flex h-16 rounded-lg overflow-hidden shadow-sm">
          {chartData.map((item, index) => {
            const percentage = (item.spent / totalSpent) * 100;
            return (
              <div
                key={index}
                className="relative group transition-all duration-200 cursor-pointer"
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
        </div>
      </div>
    </Card>
  );
}
