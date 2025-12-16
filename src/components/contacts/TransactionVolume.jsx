import React, { useMemo } from 'react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

export default function TransactionVolume({ transactions }) {
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const monthlyData = {};

    transactions.forEach(transaction => {
      const monthKey = format(startOfMonth(parseISO(transaction.date)), 'yyyy-MM');

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          incomeCount: 0,
          expenseCount: 0
        };
      }

      if (transaction.type === 'income') {
        monthlyData[monthKey].incomeCount += 1;
      } else if (transaction.type === 'expense') {
        monthlyData[monthKey].expenseCount += 1;
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
      const total = payload.reduce((sum, entry) => sum + entry.value, 0);
      return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-slate-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-slate-600 capitalize">
                {entry.name.replace('Count', '')}:
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {entry.value} transaction{entry.value !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-slate-200">
            <span className="text-sm text-slate-600">Total:</span>
            <span className="text-sm font-semibold text-slate-900 ml-2">
              {total} transaction{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
            label={{ value: 'Transactions', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
            formatter={(value) => value.replace('Count', '')}
          />
          <Bar
            dataKey="incomeCount"
            stackId="a"
            fill="#10b981"
            name="Income Count"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="expenseCount"
            stackId="a"
            fill="#ef4444"
            name="Expense Count"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
