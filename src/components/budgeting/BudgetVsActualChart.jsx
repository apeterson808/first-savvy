import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { convertCadence } from '@/utils/cadenceUtils';

export default function BudgetVsActualChart({ budgets, spendingByCategory, incomeByCategory }) {
  const [activeView, setActiveView] = useState('expenses');

  const incomeBudgets = budgets.filter(b => b.chartAccount?.class === 'income');
  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

  const calculateTotalIncome = () => {
    const budgeted = incomeBudgets.reduce((sum, b) => {
      return sum + convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', 'monthly');
    }, 0);
    const actual = incomeBudgets.reduce((sum, b) => {
      return sum + (incomeByCategory[b.chart_account_id] || 0);
    }, 0);
    return { budgeted, actual };
  };

  const calculateTotalExpenses = () => {
    const budgeted = expenseBudgets.reduce((sum, b) => {
      return sum + convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', 'monthly');
    }, 0);
    const actual = expenseBudgets.reduce((sum, b) => {
      return sum + (spendingByCategory[b.chart_account_id] || 0);
    }, 0);
    return { budgeted, actual };
  };

  const incomeData = calculateTotalIncome();
  const expenseData = calculateTotalExpenses();

  const isExpenseView = activeView === 'expenses';
  const currentData = isExpenseView ? expenseData : incomeData;
  const remaining = currentData.budgeted - currentData.actual;

  const donutData = [
    {
      name: isExpenseView ? 'Spent' : 'Earned',
      value: currentData.actual,
      color: isExpenseView ? '#ef4444' : '#22c55e'
    },
    {
      name: 'Remaining',
      value: remaining > 0 ? remaining : 0,
      color: '#e2e8f0'
    }
  ];

  if (remaining < 0) {
    donutData.push({
      name: 'Over Budget',
      value: Math.abs(remaining),
      color: '#dc2626'
    });
  }

  const percentage = currentData.budgeted > 0 ? (currentData.actual / currentData.budgeted) * 100 : 0;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-slate-200 rounded shadow-sm">
          <p className="text-xs font-medium text-slate-700">{payload[0].name}</p>
          <p className="text-xs text-slate-600">
            ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

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
        {currentData.budgeted === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No {isExpenseView ? 'expense' : 'income'} budget set
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">
                    {Math.round(percentage)}%
                  </div>
                  <div className="text-xs text-slate-500">
                    {isExpenseView ? 'Spent' : 'Earned'}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{isExpenseView ? 'Spent' : 'Earned'}</span>
                <span className="font-semibold text-slate-900">
                  ${currentData.actual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Budgeted</span>
                <span className="font-semibold text-slate-900">
                  ${currentData.budgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
