import React, { useMemo } from 'react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { formatCurrency } from '@/components/utils/formatters';

export default function TransactionTimeline({ transactions }) {
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const monthlyData = {};

    transactions.forEach(transaction => {
      const monthKey = format(startOfMonth(parseISO(transaction.date)), 'yyyy-MM');

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          income: 0,
          expenses: 0
        };
      }

      if (transaction.type === 'income') {
        monthlyData[monthKey].income += transaction.amount || 0;
      } else if (transaction.type === 'expense') {
        monthlyData[monthKey].expenses += transaction.amount || 0;
      }
    });

    return Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(item => ({
        ...item,
        monthLabel: format(parseISO(item.month + '-01'), 'MMM yyyy')
      }));
  }, [transactions]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        No transaction data available
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-slate-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-slate-600 capitalize">{entry.name}:</span>
              <span className="text-sm font-semibold text-slate-900">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="monthLabel"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="income"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorIncome)"
            name="Income"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stroke="#ef4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorExpenses)"
            name="Expenses"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
