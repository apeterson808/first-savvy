import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, ClipboardList, Coins } from 'lucide-react';

export default function BudgetOverviewCards({ totalIncome, totalBudgeted, totalSpent }) {
  const remaining = totalBudgeted - totalSpent;

  const cards = [
    {
      label: 'Monthly Income',
      value: totalIncome,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      valueColor: 'text-green-600'
    },
    {
      label: 'Total Budgeted',
      value: totalBudgeted,
      icon: ClipboardList,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      valueColor: 'text-blue-600'
    },
    {
      label: 'Total Spent',
      value: totalSpent,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      valueColor: 'text-red-600'
    },
    {
      label: 'Remaining',
      value: remaining,
      icon: Coins,
      color: remaining >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: remaining >= 0 ? 'bg-green-50' : 'bg-red-50',
      valueColor: remaining >= 0 ? 'text-green-600' : 'text-red-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="shadow-sm border-slate-200 bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.valueColor}`}>
                    ${Math.abs(card.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`w-11 h-11 rounded-lg ${card.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}