import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
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

export default function BudgetVsActualChart({ budgets, spendingByCategory, incomeByCategory }) {
  const [activeView, setActiveView] = useState('expenses');
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
    .filter(item => item.budgeted > 0)
    .sort((a, b) => b.spent - a.spent);

  const totalBudgeted = chartData.reduce((sum, item) => sum + item.budgeted, 0);
  const totalSpent = chartData.reduce((sum, item) => sum + item.spent, 0);
  const remaining = totalBudgeted - totalSpent;

  const pieData = chartData.map(item => ({
    ...item,
    value: item.spent
  }));

  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

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
            <div className="h-[240px] relative" onMouseLeave={() => setActiveIndex(null)}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={78}
                    outerRadius={95}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={2}
                    cornerRadius={5}
                    dataKey="value"
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                        style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  {activeItem ? (
                    <>
                      <p className="text-lg font-semibold text-slate-900">
                        ${activeItem.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs font-medium capitalize" style={{ color: activeItem.color }}>
                        {activeItem.name}
                      </p>
                      <p className="text-[10px] text-slate-500">Spent</p>
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
