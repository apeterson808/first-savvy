import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { Badge } from '@/components/ui/badge';

export function SpendingTrendChart({ historicalData, budget }) {
  if (!historicalData?.monthlyData) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Spending Trend</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No historical data available</p>
        </CardContent>
      </Card>
    );
  }

  const { monthlyData, summary } = historicalData;
  const budgetAmount = budget?.allocated_amount || 0;

  const chartData = monthlyData.map(m => ({
    ...m,
    budget: budgetAmount
  }));

  const getTrendIcon = () => {
    if (summary.trend === 'increasing') return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (summary.trend === 'decreasing') return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = () => {
    if (summary.trend === 'increasing') return 'text-red-500';
    if (summary.trend === 'decreasing') return 'text-green-500';
    return 'text-gray-500';
  };

  const getTrendLabel = () => {
    if (summary.trend === 'increasing') return 'Trending Up';
    if (summary.trend === 'decreasing') return 'Trending Down';
    return 'Stable';
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">12-Month Spending Trend</p>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {getTrendLabel()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                        <p className="font-semibold mb-2">{data.month}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Spent:</span>
                            <span className="font-medium">{formatCurrency(data.totalSpent)}</span>
                          </div>
                          {budgetAmount > 0 && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Budget:</span>
                              <span className="font-medium">{formatCurrency(budgetAmount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Transactions:</span>
                            <span className="font-medium">{data.transactionCount}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Avg/Transaction:</span>
                            <span className="font-medium">{formatCurrency(data.avgTransaction)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                {budgetAmount > 0 && (
                  <ReferenceLine
                    y={budgetAmount}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{ value: 'Budget', position: 'right', fill: '#ef4444', fontSize: 12 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="totalSpent"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorSpent)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.average)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Highest</p>
              <p className="text-lg font-semibold text-red-600">{formatCurrency(summary.max)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Lowest</p>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(summary.min)}</p>
            </div>
          </div>

          {budgetAmount > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Average vs Budget</span>
                <Badge variant={summary.average > budgetAmount ? 'destructive' : 'default'}>
                  {summary.average > budgetAmount ? 'Over Budget' : 'Under Budget'}
                </Badge>
              </div>
              <p className="text-sm">
                {summary.average > budgetAmount ? (
                  <>Average spending is <span className="font-semibold text-red-600">{formatCurrency(summary.average - budgetAmount)}</span> over budget</>
                ) : (
                  <>Average spending is <span className="font-semibold text-green-600">{formatCurrency(budgetAmount - summary.average)}</span> under budget</>
                )}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
