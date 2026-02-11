import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import MonthSelectorDropdown from '../common/MonthSelectorDropdown';
import AccountDropdown from '../common/AccountDropdown';
import ComparisonPeriodDropdown from '../common/ComparisonPeriodDropdown';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { createPageUrl } from '../../pages/utils';

export default function SpendingChartCard({ 
  transactions, 
  accounts,
  selectedMonth, 
  setSelectedMonth,
  selectedAccount,
  setSelectedAccount,
  selectedPastMonth,
  setSelectedPastMonth,
  onPointClick
}) {
  const generateChartData = () => {
    const today = new Date();
    const targetDate = subMonths(today, parseInt(selectedMonth));
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    const isCurrentMonth = parseInt(selectedMonth) === 0;
    const currentDay = isCurrentMonth ? today.getDate() : monthEnd.getDate();
    const lastDay = monthEnd.getDate();
    const data = [];

    let cumulativeSpending = 0;
    let pastCumulativeSpending = 0;
    
    const getComparisonMonths = () => {
      if (selectedPastMonth === 'avg3') return [1, 2, 3];
      if (selectedPastMonth === 'avg6') return [1, 2, 3, 4, 5, 6];
      if (selectedPastMonth === 'avg12') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      if (selectedPastMonth === 'avgAll') {
        const monthsSet = new Set();
        const filteredTransactions = selectedAccount === 'all' 
          ? transactions 
          : transactions.filter(t => t.bank_account_id === selectedAccount);
        filteredTransactions.forEach(t => {
          if (!t.date) return;
          const tDate = new Date(t.date);
          if (isNaN(tDate.getTime())) return;
          const monthsAgo = (targetDate.getFullYear() - tDate.getFullYear()) * 12 + (targetDate.getMonth() - tDate.getMonth());
          if (monthsAgo > 0) monthsSet.add(monthsAgo);
        });
        return Array.from(monthsSet);
      }
      return [parseInt(selectedPastMonth)];
    };
    const comparisonMonths = getComparisonMonths();

    // Get active account IDs for filtering (outside loop for efficiency)
    const activeAccountIds = accounts.filter(a => a.is_active !== false).map(a => a.id);
    
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(targetDate.getFullYear(), targetDate.getMonth(), day);
      // Format expected date string to compare directly with transaction date strings
      const expectedDateStr = format(date, 'yyyy-MM-dd');
      
      const dayTransactions = transactions.filter(t => {
        if (!t.date) return false;
        const matchesAccount = selectedAccount === 'all' 
          ? activeAccountIds.includes(t.bank_account_id)
          : t.bank_account_id === selectedAccount;
        return t.date === expectedDateStr && 
               t.status === 'posted' && 
               t.type === 'expense' &&
               matchesAccount;
      });

      const daySpending = dayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      cumulativeSpending += daySpending;

      let totalPastDaySpending = 0;
      let validMonthCount = 0;
      
      comparisonMonths.forEach(monthsAgo => {
                const pastDate = subMonths(targetDate, monthsAgo);
                const pastMonthEnd = endOfMonth(pastDate);

                if (day <= pastMonthEnd.getDate()) {
                  // Format expected past date string
                  const pastDateStr = format(new Date(pastDate.getFullYear(), pastDate.getMonth(), day), 'yyyy-MM-dd');
                  const pastDayTransactions = transactions.filter(t => {
                    if (!t.date) return false;
                    const matchesPastAccount = selectedAccount === 'all'
                      ? activeAccountIds.includes(t.bank_account_id)
                      : t.bank_account_id === selectedAccount;
                    return t.date === pastDateStr &&
                           t.status === 'posted' &&
                           t.type === 'expense' &&
                           matchesPastAccount;
          });

          const daySpendingForMonth = pastDayTransactions
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
          
          totalPastDaySpending += daySpendingForMonth;
          validMonthCount++;
        }
      });

      const avgPastDaySpending = validMonthCount > 0 ? totalPastDaySpending / validMonthCount : 0;
      pastCumulativeSpending += avgPastDaySpending;

      data.push({
        day: format(date, 'd'),
        spending: day <= currentDay ? cumulativeSpending : null,
        dailySpending: day <= currentDay ? daySpending : null,
        pastSpending: pastCumulativeSpending,
        dailyPastSpending: avgPastDaySpending,
      });
    }

    return data;
  };

  const chartData = generateChartData();

  return (
    <Card className="shadow-sm border-slate-200 lg:col-span-2">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2 flex-nowrap min-w-0">
          <MonthSelectorDropdown value={selectedMonth} onValueChange={setSelectedMonth} />
          <AccountDropdown
            value={selectedAccount}
            onValueChange={setSelectedAccount}
            accounts={accounts}
            triggerClassName="h-8 text-xs gap-1 whitespace-nowrap max-w-[130px] hover:bg-slate-50"
          />
          <ComparisonPeriodDropdown value={selectedPastMonth} onValueChange={setSelectedPastMonth} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-2">
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart 
            data={chartData} 
            margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#52A5CE" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#52A5CE" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis 
                    dataKey="day" 
                    stroke="#64748b" 
                    tick={{ fontSize: 11 }} 
                    axisLine={false} 
                    tickLine={false}
                    ticks={['1', '5', '10', '15', '20', '25', '30']}
                  />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={45} tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`} orientation="right" axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #e2e8f0' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0]?.payload;
                if (!data || data.spending === null) return null;

                const dayNum = data.day;
                const currentLabel = parseInt(selectedMonth) === 0 
                  ? `${format(new Date(), 'MMMM')} ${dayNum}` 
                  : `${format(subMonths(new Date(), parseInt(selectedMonth)), 'MMMM')} ${dayNum}`;
                const pastLabel = selectedPastMonth === 'avg3' ? 'Avg (3 mo)'
                  : selectedPastMonth === 'avg6' ? 'Avg (6 mo)'
                  : selectedPastMonth === 'avg12' ? 'Avg (12 mo)'
                  : selectedPastMonth === 'avgAll' ? 'Avg (All time)'
                  : format(subMonths(new Date(), parseInt(selectedPastMonth)), 'MMMM');

                const diff = data.spending - data.pastSpending;
                const isOver = diff >= 0;

                return (
                  <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm text-xs">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div></div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide">Today</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide">MTD</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 items-center mt-1">
                      <span className="text-slate-600">{currentLabel}</span>
                      <span className="font-medium text-blue-600 text-center">${(data.dailySpending || 0).toFixed(2)}</span>
                      <span className="font-medium text-blue-600 text-center">${data.spending.toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 items-center mt-1">
                      <span className="text-slate-600">{pastLabel}</span>
                      <span className="font-medium text-slate-400 text-center">${(data.dailyPastSpending || 0).toFixed(2)}</span>
                      <span className="font-medium text-slate-400 text-center">${data.pastSpending.toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 items-center mt-1 pt-1 border-t border-slate-100">
                      <span className="text-slate-600">{isOver ? 'Over' : 'Under'}</span>
                      <span></span>
                      <span className={`font-medium text-center ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                        ${Math.abs(diff).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="spending"
              stroke="#52A5CE"
              fillOpacity={1}
              fill="url(#colorValue)"
              activeDot={(props) => {
                const { cx, cy, payload } = props;
                if (cx === undefined || cy === undefined) return null;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill="#52A5CE"
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ cursor: onPointClick ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (onPointClick && payload) {
                        const day = parseInt(payload.day);
                        const today = new Date();
                        const targetDate = subMonths(today, parseInt(selectedMonth));
                        const clickedDate = format(new Date(targetDate.getFullYear(), targetDate.getMonth(), day), 'yyyy-MM-dd');
                        onPointClick({
                          date: clickedDate,
                          account: selectedAccount
                        });
                      }
                    }}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="pastSpending"
              stroke="#94a3b8"
              strokeDasharray="5 5"
              fillOpacity={0}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}