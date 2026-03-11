import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
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

  const percentage = currentData.budgeted > 0 ? Math.min((currentData.actual / currentData.budgeted) * 100, 150) : 0;
  const cappedPercentage = Math.min(percentage, 100);

  const getGaugeColor = () => {
    if (percentage <= 70) return '#22c55e';
    if (percentage <= 90) return '#eab308';
    if (percentage <= 100) return '#f97316';
    return '#ef4444';
  };

  const gaugeData = [
    { value: cappedPercentage, color: getGaugeColor() },
    { value: 100 - cappedPercentage, color: '#e2e8f0' }
  ];

  const needleRotation = (cappedPercentage / 100) * 180 - 90;

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
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="90%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={0}
                    dataKey="value"
                  >
                    {gaugeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div
                className="absolute left-1/2 transition-transform duration-700 ease-out"
                style={{
                  bottom: '22px',
                  width: '2px',
                  height: '70px',
                  backgroundColor: '#334155',
                  transformOrigin: 'bottom center',
                  transform: `translateX(-50%) rotate(${needleRotation}deg)`,
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-700 rounded-full border-2 border-white shadow" />
              </div>

              <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '15px' }}>
                <div className="w-4 h-4 bg-white rounded-full border-2 border-slate-300 shadow-sm" />
              </div>

              <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">
                    {Math.round(percentage)}%
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {isExpenseView ? 'Spent' : 'Earned'}
                  </div>
                </div>
              </div>

              <div className="absolute left-2 text-[10px] text-slate-400 font-medium" style={{ bottom: '18px' }}>
                0%
              </div>
              <div className="absolute right-2 text-[10px] text-slate-400 font-medium" style={{ bottom: '18px' }}>
                100%
              </div>
            </div>

            <div className="space-y-2 pt-2">
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
