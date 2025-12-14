import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, CircleDot, ChevronDown, ChevronUp } from 'lucide-react';
import { format, subMonths, subYears, startOfYear, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import TimeRangeDropdown from '../common/TimeRangeDropdown';

export default function NetWorthOverviewTab() {
  const [timeRange, setTimeRange] = useState('6');
  const [expandedCategories, setExpandedCategories] = useState({});

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => base44.entities.Asset.filter({ is_active: true })
  });

  const { data: liabilities = [] } = useQuery({
    queryKey: ['liabilities'],
    queryFn: () => base44.entities.Liability.list()
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true })
  });

  // Calculate totals
  const investmentAssets = assets.filter(a => a.type === 'investment' && a.type !== 'beginning_balance');
  const otherAssets = assets.filter(a => a.type !== 'investment' && a.type !== 'beginning_balance');
  const cashAccounts = bankAccounts.filter(a => a.account_type !== 'credit_card');
  const creditCards = bankAccounts.filter(a => a.account_type === 'credit_card');

  const totalInvestments = investmentAssets.reduce((sum, a) => sum + (a.current_value || 0), 0);
  const totalCash = cashAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const totalOtherAssets = otherAssets.reduce((sum, a) => sum + (a.current_value || 0), 0);
  const totalAssets = totalInvestments + totalCash + totalOtherAssets;

  const totalLoans = liabilities.reduce((sum, l) => sum + (l.current_balance || 0), 0);
  const totalCreditCards = creditCards.reduce((sum, c) => sum + Math.abs(c.current_balance || 0), 0);
  const totalDebts = totalLoans + totalCreditCards;

  const netWorth = totalAssets - totalDebts;

  const formatCurrency = (amount) => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000) {
      return `${isNegative ? '-' : ''}$${(absAmount / 1000).toFixed(1)}k`;
    }
    return `${isNegative ? '-' : ''}$${absAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatFullCurrency = (amount) => {
    const isNegative = amount < 0;
    return `${isNegative ? '-' : ''}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Generate chart data based on time range
  const generateChartData = () => {
    const today = new Date();
    let startDate;
    
    switch (timeRange) {
                case '1': startDate = subMonths(today, 1); break;
                case '3': startDate = subMonths(today, 3); break;
                case '6': startDate = subMonths(today, 6); break;
                case '12': startDate = subYears(today, 1); break;
                case 'ytd': startDate = startOfYear(today); break;
                case 'all': startDate = subYears(today, 5); break; // Show up to 5 years of history
                default: startDate = subMonths(today, 6);
              }

    const months = eachMonthOfInterval({ start: startDate, end: today });
    
    // Simulate historical data with some variation
    return months.map((date, index) => {
      const progress = index / (months.length - 1);
      const baseValue = netWorth * (0.85 + progress * 0.15);
      const variation = (Math.random() - 0.5) * netWorth * 0.05;
      
      return {
        date: format(date, 'MMM'),
        fullDate: date,
        value: index === months.length - 1 ? netWorth : Math.round(baseValue + variation)
      };
    });
  };

  const chartData = generateChartData();
  const startValue = chartData[0]?.value || 0;
  const changeAmount = netWorth - startValue;
  const changePercent = startValue !== 0 ? ((changeAmount / startValue) * 100).toFixed(1) : 0;

  // Asset categories for the list
  const assetCategories = [
    {
      id: 'investments',
      name: 'Investments',
      color: '#3b82f6',
      total: totalInvestments,
      percentage: totalAssets > 0 ? Math.round((totalInvestments / totalAssets) * 100) : 0,
      items: investmentAssets.map(a => ({ name: a.name, value: a.current_value }))
    },
    {
      id: 'cash',
      name: 'Cash',
      color: '#22c55e',
      total: totalCash,
      percentage: totalAssets > 0 ? Math.round((totalCash / totalAssets) * 100) : 0,
      items: cashAccounts.map(a => ({ name: a.account_name, value: a.current_balance }))
    },
    {
      id: 'other',
      name: 'Other Assets',
      color: '#8b5cf6',
      total: totalOtherAssets,
      percentage: totalAssets > 0 ? Math.round((totalOtherAssets / totalAssets) * 100) : 0,
      items: otherAssets.map(a => ({ name: a.name, value: a.current_value }))
    }
  ];

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  

  return (
    <div className="p-3">
      <div className="flex gap-3">
        {/* Main Content */}
        <div className="flex-1 space-y-3">
          {/* Chart Card */}
          <Card className="shadow-sm border-slate-200">
            <CardContent className="pt-4">
              {/* Header with dropdown */}
              <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total net worth</p>
                <p className="text-3xl font-bold text-slate-900">{formatFullCurrency(netWorth)}</p>
              </div>
              <TimeRangeDropdown value={timeRange} onValueChange={setTimeRange} />
              </div>

              {/* Chart */}
              <div className="h-[200px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 30, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748b"
                      tick={{ fontSize: 11 }}
                      axisLine={false} 
                      tickLine={false}
                      interval={timeRange === 'all' ? 11 : 0}
                      tickFormatter={(value, index) => {
                        if (timeRange === 'all') {
                          const dataPoint = chartData[index];
                          if (dataPoint?.fullDate && !isNaN(new Date(dataPoint.fullDate).getTime())) {
                            return format(new Date(dataPoint.fullDate), "yyyy");
                          }
                        }
                        return value;
                      }}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      tick={{ fontSize: 11 }} 
                      width={45} 
                      tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`} 
                      orientation="right" 
                      axisLine={false} 
                      tickLine={false}
                      domain={[(dataMin) => Math.floor(dataMin / 10000) * 10000, (dataMax) => Math.ceil(dataMax / 10000) * 10000]}
                      ticks={(() => {
                        const min = Math.floor(netWorth * 0.5 / 10000) * 10000;
                        const max = Math.ceil(netWorth * 1.5 / 10000) * 10000;
                        const ticks = [];
                        for (let i = min; i <= max; i += 10000) {
                          ticks.push(i);
                        }
                        return ticks;
                      })()}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isValidDate = data.fullDate && !isNaN(new Date(data.fullDate).getTime());
                          return (
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm text-xs">
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-600">{isValidDate ? format(new Date(data.fullDate), 'MMM d') : data.date}</span>
                                <span className="font-medium text-blue-600">{formatFullCurrency(data.value)}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorNetWorth)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Change indicator */}
              <div className="flex items-center gap-2 mt-4">
                {changeAmount >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm ${changeAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {changeAmount >= 0 ? 'Up' : 'Down'} {formatFullCurrency(Math.abs(changeAmount))} over the last {timeRange === '1' ? 'month' : timeRange === '3' ? '3 months' : timeRange === '6' ? '6 months' : timeRange === '12' ? 'year' : timeRange === 'ytd' ? 'year to date' : 'all time'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Assets List */}
          <Card className="shadow-sm border-slate-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Assets</p>
                <span className="text-xs text-slate-500">Your assets have remained about the same this month</span>
              </div>

              <div className="space-y-1">
                {assetCategories.map((category) => (
                  <div key={category.id}>
                    <button
                      onClick={() => category.items.length > 0 && toggleCategory(category.id)}
                      className="w-full flex items-center justify-between py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full border-2"
                          style={{ borderColor: category.color }}
                        />
                        <span className="font-medium text-slate-900">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500">{category.percentage}% of assets</span>
                        <span className="font-semibold text-slate-900 w-20 text-right">
                          {formatCurrency(category.total)}
                        </span>
                        {category.items.length > 0 && (
                          expandedCategories[category.id] ? 
                            <ChevronUp className="w-4 h-4 text-slate-400" /> : 
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>
                    
                    {expandedCategories[category.id] && category.items.length > 0 && (
                      <div className="pl-7 py-2 bg-slate-50">
                        {category.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 px-3">
                            <span className="text-sm text-slate-600">{item.name}</span>
                            <span className="text-sm font-medium text-slate-900">{formatCurrency(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <Link to={`${createPageUrl('NetWorth')}?tab=assets`}>
                  <Button variant="outline" size="sm" className="text-sm">
                    View all assets
                  </Button>
                </Link>
              </div>

              {/* Total */}
              <div className="flex justify-end pt-4 border-t border-slate-200 mt-4">
                <span className="text-xl font-bold text-slate-900">{formatFullCurrency(totalAssets)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="w-64 flex-shrink-0">
          <Card className="shadow-sm border-slate-200 sticky top-3">
            <CardContent className="pt-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Summary</p>
              <p className="text-xs text-slate-500 mb-4">
                This is how your net worth is calculated. Make sure all of your accounts are connected for an accurate summary.
              </p>

              <div className="space-y-4">
                {/* Assets */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-green-600 text-xs font-bold">+</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Assets</p>
                      <p className="text-xs text-slate-500">{assets.length + cashAccounts.length} accounts</p>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-900">{formatFullCurrency(totalAssets)}</span>
                </div>

                {/* Debts */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-red-600 text-xs font-bold">−</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Debts</p>
                      <p className="text-xs text-slate-500">{liabilities.length + creditCards.length} accounts</p>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-900">{formatFullCurrency(totalDebts)}</span>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-200" />

                {/* Net Worth */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                      <span className="text-slate-600 text-xs font-bold">=</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Net Worth</p>
                      <p className="text-xs text-slate-500">
                        <Link to={`${createPageUrl('NetWorth')}?tab=assets`} className="text-blue-600 hover:underline">Assets</Link>
                        {' · '}
                        <Link to={`${createPageUrl('NetWorth')}?tab=liabilities`} className="text-blue-600 hover:underline">Debts</Link>
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">{formatFullCurrency(netWorth)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}