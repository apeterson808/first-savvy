import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { convertCadence } from '@/utils/cadenceUtils';
import { getAccountTypeLabel } from '@/utils/accountTypeLabels';

const TYPE_COLORS = {
  'fixed': '#52A5CE',
  'variable': '#AACC96',
  'discretionary': '#EF6F3C',
  'uncategorized': '#94A3B8'
};

export default function BudgetVsActualChart({ budgets, spendingByCategory, incomeByCategory }) {
  const [activeView, setActiveView] = useState('expenses');
  const [activeIndex, setActiveIndex] = useState(null);

  const incomeBudgets = budgets.filter(b => b.chartAccount?.class === 'income');
  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

  const isExpenseView = activeView === 'expenses';
  const currentBudgets = isExpenseView ? expenseBudgets : incomeBudgets;
  const currentActuals = isExpenseView ? spendingByCategory : incomeByCategory;

  const groupedData = {};
  currentBudgets.forEach((budget) => {
    const accountType = budget.chartAccount?.account_type || 'uncategorized';
    const budgeted = convertCadence(parseFloat(budget.allocated_amount || 0), budget.cadence || 'monthly', 'monthly');
    const spent = currentActuals[budget.chart_account_id] || 0;

    if (!groupedData[accountType]) {
      groupedData[accountType] = {
        name: getAccountTypeLabel(accountType),
        budgeted: 0,
        spent: 0,
        color: TYPE_COLORS[accountType] || TYPE_COLORS['uncategorized']
      };
    }

    groupedData[accountType].budgeted += budgeted;
    groupedData[accountType].spent += spent;
  });

  const chartData = Object.values(groupedData)
    .filter(item => item.budgeted > 0)
    .sort((a, b) => b.spent - a.spent);

  const totalBudgeted = chartData.reduce((sum, item) => sum + item.budgeted, 0);
  const totalSpent = chartData.reduce((sum, item) => sum + item.spent, 0);
  const remaining = totalBudgeted - totalSpent;

  const activeItem = activeIndex !== null ? chartData[activeIndex] : null;

  return (
    <Card className="shadow-sm border-slate-200 bg-white">
      <CardHeader className="pb-3 pt-4 px-5">
        <h3 className="text-sm font-semibold text-slate-900">Budget Overview</h3>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setActiveView('expenses')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeView === 'expenses'
                ? 'bg-red-100 text-red-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setActiveView('income')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeView === 'income'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Income
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No {isExpenseView ? 'expense' : 'income'} budget set
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-4" onMouseLeave={() => setActiveIndex(null)}>
              <div className="text-center">
                {activeItem ? (
                  <>
                    <p className="text-2xl font-bold text-slate-900">
                      ${activeItem.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm font-medium capitalize" style={{ color: activeItem.color }}>
                      {activeItem.name}
                    </p>
                    <p className="text-xs text-slate-500">Spent</p>
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

              <div className="flex w-full h-16 rounded-lg overflow-hidden shadow-sm">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Budgeted</span>
                <span className="font-semibold text-slate-900">
                  ${totalBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{isExpenseView ? 'Spent' : 'Earned'}</span>
                <span className="font-semibold text-slate-900">
                  ${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {remaining >= 0 ? 'Remaining' : 'Over Budget'}
                  </span>
                  <span className={`font-semibold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
