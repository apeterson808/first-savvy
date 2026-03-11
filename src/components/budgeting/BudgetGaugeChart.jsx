import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function BudgetGaugeChart({ transactions, selectedMonth, selectedAccount, accounts = [] }) {
  const { activeProfile } = useProfile();
  const [viewMode, setViewMode] = useState('expenses');

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['userChartOfAccounts', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile) return [];
      const { data, error } = await firstsavvy.supabase
        .from('user_chart_of_accounts')
        .select('*')
        .eq('profile_id', activeProfile.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeProfile,
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('budgets')
        .select(`
          *,
          chartAccount:user_chart_of_accounts!budgets_chart_account_id_fkey(
            id,
            class,
            display_name,
            account_detail,
            color
          )
        `)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const getChartAccountById = (id) => chartAccounts.find(c => c.id === id);
  const getBudgetByChartAccountId = (chartAccountId) => budgets.find(b => b.chart_account_id === chartAccountId);

  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() - parseInt(selectedMonth), 1);
  const isCurrentMonth = parseInt(selectedMonth) === 0;
  const currentDay = today.getDate();

  const activeAccountIds = accounts.filter(a => a.is_active !== false).map(a => a.id);

  const filterType = viewMode === 'expenses' ? 'expense' : 'income';

  const categoryTotals = transactions
    .filter(t => {
      if (!t.date) return false;
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;
      const matchesAccount = selectedAccount === 'all'
        ? activeAccountIds.includes(t.bank_account_id)
        : t.bank_account_id === selectedAccount;
      const matchesMonth = tDate.getMonth() === targetDate.getMonth() &&
                          tDate.getFullYear() === targetDate.getFullYear();
      const matchesDay = !isCurrentMonth || tDate.getDate() <= currentDay;
      return t.type === filterType && t.status === 'posted' && matchesAccount && matchesMonth && matchesDay;
    })
    .reduce((acc, t) => {
      const chartAccount = getChartAccountById(t.category_account_id);
      const budget = getBudgetByChartAccountId(t.category_account_id);
      const categoryName = chartAccount?.display_name || chartAccount?.account_detail || 'uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = {
          amount: 0,
          color: budget?.color || chartAccount?.color || '#64748b',
          chartAccountId: t.category_account_id
        };
      }
      acc[categoryName].amount += Math.abs(t.amount);
      return acc;
    }, {});

  const totalSpending = Object.values(categoryTotals).reduce((sum, cat) => sum + cat.amount, 0);

  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .filter(([, cat]) => cat.amount > 0);

  let chartData = [];
  let cumulativeValue = 0;

  sortedCategories.forEach(([categoryName, cat], index) => {
    const percentage = totalSpending > 0 ? (cat.amount / totalSpending) * 100 : 0;
    cumulativeValue += percentage;

    chartData.push({
      name: categoryName.replace(/_/g, ' '),
      value: cumulativeValue,
      fill: cat.color,
      amount: cat.amount,
      percentage: percentage,
      chartAccountId: cat.chartAccountId
    });
  });

  const totalBudget = budgets
    .filter(b => b.chartAccount?.class === filterType.replace('expense', 'expense').replace('income', 'income'))
    .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const overallPercentage = totalBudget > 0 ? ((totalSpending / totalBudget) * 100).toFixed(0) : 0;

  return (
    <Card className="shadow-sm border-slate-200 h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Budget Progress</p>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value)}
            className="gap-0"
          >
            <ToggleGroupItem
              value="expenses"
              className="h-6 px-2 text-[10px] data-[state=on]:bg-slate-900 data-[state=on]:text-white"
            >
              Expenses
            </ToggleGroupItem>
            <ToggleGroupItem
              value="income"
              className="h-6 px-2 text-[10px] data-[state=on]:bg-slate-900 data-[state=on]:text-white"
            >
              Income
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">
            No {viewMode} data
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="h-[180px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="85%"
                  innerRadius="60%"
                  outerRadius="100%"
                  startAngle={180}
                  endAngle={0}
                  data={chartData}
                  barSize={16}
                >
                  <PolarAngleAxis
                    type="number"
                    domain={[0, 100]}
                    angleAxisId={0}
                    tick={false}
                  />
                  <RadialBar
                    background={{ fill: '#e2e8f0' }}
                    dataKey="value"
                    cornerRadius={4}
                  />
                </RadialBarChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex items-end justify-center pb-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalSpending)}</p>
                  <p className="text-xs text-slate-500">of {formatCurrency(totalBudget)}</p>
                  <p className="text-sm font-semibold text-slate-700 mt-1">{overallPercentage}%</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {sortedCategories.map(([categoryName, cat], index) => {
                const percentage = totalSpending > 0 ? ((cat.amount / totalSpending) * 100).toFixed(1) : 0;
                return (
                  <div key={index} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-slate-700 truncate capitalize">{categoryName.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-slate-500">{percentage}%</span>
                      <span className="font-medium text-slate-900 min-w-[60px] text-right">
                        {formatCurrency(cat.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
