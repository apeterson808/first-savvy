import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import BudgetProgressPill from './BudgetProgressPill';
import { convertCadence } from '@/utils/cadenceUtils';
import { format } from 'date-fns';

export default function BudgetTrackerContainer({ budgets, spendingByCategory, incomeByCategory, monthStart, monthEnd }) {
  const [collapsedSections, setCollapsedSections] = useState({
    income: false,
    expense: false
  });

  const incomeBudgets = budgets.filter(b => b.chartAccount?.class === 'income');
  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

  const totalIncomeBudgeted = incomeBudgets.reduce((sum, b) => {
    return sum + convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', 'monthly');
  }, 0);

  const totalExpenseBudgeted = expenseBudgets.reduce((sum, b) => {
    return sum + convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', 'monthly');
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

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderSection = (title, budgetsList, actualByCategory, isIncome, sectionKey) => {
    const isCollapsed = collapsedSections[sectionKey];
    const count = budgetsList.length;

    if (count === 0) {
      return null;
    }

    const sortedBudgets = [...budgetsList].sort((a, b) => {
      const aActual = actualByCategory[a.chart_account_id] || 0;
      const bActual = actualByCategory[b.chart_account_id] || 0;
      const aBudgeted = convertCadence(parseFloat(a.allocated_amount || 0), a.cadence || 'monthly', 'monthly');
      const bBudgeted = convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', 'monthly');
      const aPercentage = aBudgeted > 0 ? (aActual / aBudgeted) : 0;
      const bPercentage = bBudgeted > 0 ? (bActual / bBudgeted) : 0;
      return bPercentage - aPercentage;
    });

    return (
      <Card className="shadow-sm border-slate-200 bg-white">
        <CardHeader className="pb-3 pt-4 px-6">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => toggleSection(sectionKey)}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
          </div>
        </CardHeader>
        {!isCollapsed && (
          <CardContent className="px-6 pb-4 space-y-3">
            {sortedBudgets.map(budget => (
              <BudgetProgressPill
                key={budget.id}
                budget={budget}
                actualAmount={actualByCategory[budget.chart_account_id] || 0}
                isIncome={isIncome}
              />
            ))}
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-white to-slate-50">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Budget Period</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {format(monthStart, 'MMM d')} - {format(monthEnd, 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Income</span>
              </div>
              <div className="text-xl font-bold text-slate-900 mb-0.5">
                ${totalIncomeActual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500">
                of ${totalIncomeBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} budgeted
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Expenses</span>
              </div>
              <div className="text-xl font-bold text-slate-900 mb-0.5">
                ${totalExpenseActual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500">
                of ${totalExpenseBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} budgeted
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-slate-200">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Net</span>
              </div>
              <div className={`text-xl font-bold mb-0.5 ${netActual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netActual >= 0 ? '+' : '-'}${Math.abs(netActual).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500">
                vs {netBudgeted >= 0 ? '+' : '-'}${Math.abs(netBudgeted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} planned
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
  );
}
