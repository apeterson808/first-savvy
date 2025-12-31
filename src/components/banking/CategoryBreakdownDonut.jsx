import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';

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

export default function CategoryBreakdownDonut({ transactions, selectedMonth, selectedAccount, accounts = [], onCategoryClick }) {
  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['userChartOfAccounts'],
    queryFn: async () => {
      const { data: { user } } = await firstsavvy.auth.getUser();
      if (!user) return [];
      const { data, error } = await firstsavvy.supabase
        .from('user_chart_of_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
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
            class
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
  const [activeIndex, setActiveIndex] = useState(null);

  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() - parseInt(selectedMonth), 1);
  const isCurrentMonth = parseInt(selectedMonth) === 0;
  const currentDay = today.getDate();
  
  // Get active account IDs for filtering
  const activeAccountIds = accounts.filter(a => a.is_active !== false).map(a => a.id);
  
  const categoryTotals = transactions
    .filter(t => {
      if (!t.date) return false;
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;
      const matchesAccount = selectedAccount === 'all'
        ? activeAccountIds.includes(t.account_id)
        : t.account_id === selectedAccount;
      const matchesMonth = tDate.getMonth() === targetDate.getMonth() &&
                          tDate.getFullYear() === targetDate.getFullYear();
      // For current month, only include transactions up to today
      const matchesDay = !isCurrentMonth || tDate.getDate() <= currentDay;
      return t.type === 'expense' && t.status === 'posted' && matchesAccount && matchesMonth && matchesDay;
    })
    .reduce((acc, t) => {
      const chartAccount = getChartAccountById(t.chart_account_id);
      const budget = getBudgetByChartAccountId(t.chart_account_id);
      const categoryName = chartAccount?.display_name || chartAccount?.account_detail || 'uncategorized';
      if (!acc[categoryName]) {
        // Prioritize budget color, then chart account color
        acc[categoryName] = { amount: 0, color: budget?.color || chartAccount?.color, chartAccountId: t.chart_account_id };
      }
      acc[categoryName].amount += Math.abs(t.amount);
      return acc;
    }, {});

  // Calculate total from ALL categories first
  const totalSpending = Object.values(categoryTotals).reduce((sum, cat) => sum + cat.amount, 0);

  // Then take top 6 for display, plus "other" for the rest
  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b.amount - a.amount);
  const top6 = sortedCategories.slice(0, 6);
  const restTotal = sortedCategories.slice(6).reduce((sum, [, cat]) => sum + cat.amount, 0);

  const chartData = top6.map(([categoryName, cat], index) => ({
    name: categoryName.replace(/_/g, ' '),
    value: cat.amount,
    color: cat.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    chartAccountId: cat.chartAccountId
  }));

  // Add "other" category if there are more than 6 categories
  if (restTotal > 0) {
    chartData.push({
      name: 'other categories',
      value: restTotal,
      color: '#94a3b8'
    });
  }

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
  const activePercentage = activeItem ? ((activeItem.value / totalSpending) * 100).toFixed(1) : null;

  const totalBudget = budgets
    .filter(b => b.chartAccount?.class === 'expense')
    .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

  const overallPercentage = totalBudget > 0 ? ((totalSpending / totalBudget) * 100).toFixed(0) : 0;

  return (
    <Card className="shadow-sm border-slate-200 h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Categories</p>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500">No spending data</p>
        ) : (
          <div className="flex flex-col">
            <div className="h-[240px] relative" onMouseLeave={() => setActiveIndex(null)}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={78}
                    outerRadius={95}
                    paddingAngle={2}
                    cornerRadius={5}
                    dataKey="value"
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={(data, index) => {
                      const entry = chartData[index];
                      if (entry?.chartAccountId && onCategoryClick) {
                        onCategoryClick(entry.chartAccountId, entry.name);
                      }
                    }}
                  >
                    {chartData.map((entry, index) => (
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
                      <p className="text-lg font-semibold text-slate-900">${activeItem.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-xs font-medium capitalize" style={{ color: activeItem.color }}>{activeItem.name}</p>
                      <p className="text-[10px] text-slate-500">{activePercentage}%</p>
                    </>
                  ) : (
                    <>
                        <p className="text-xs text-slate-500">{overallPercentage}%</p>
                        <p className="text-lg font-bold text-slate-900">
                          ${totalSpending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-slate-500">Spent</p>
                      </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}