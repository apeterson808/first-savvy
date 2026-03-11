import React, { useState, useEffect } from 'react';
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

export default function BudgetLinearBar({ budgets, spendingByCategory, incomeByCategory, activeView, onHoverChange }) {
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

  React.useEffect(() => {
    if (onHoverChange) {
      onHoverChange(activeItem);
    }
  }, [activeItem, onHoverChange]);

  if (chartData.length === 0) {
    return (
      <Card className="shadow-sm border-slate-200 bg-white">
        <div className="p-4">
          <div className="flex h-8 bg-slate-100 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-slate-200 bg-white" onMouseLeave={() => setActiveIndex(null)}>
      <div className="p-4">
        <div className="flex h-8 rounded overflow-hidden gap-1">
          {chartData.map((item, index) => {
            const percentage = (item.spent / totalSpent) * 100;
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
        </div>
      </div>
    </Card>
  );
}
