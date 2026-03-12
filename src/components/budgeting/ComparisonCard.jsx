import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Calendar, DollarSign, PieChart as PieChartIcon } from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function ComparisonCard({ comparativeData, historicalData }) {
  if (!comparativeData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparative Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No comparison data available</p>
        </CardContent>
      </Card>
    );
  }

  const {
    currentMonth,
    lastYearSameMonth,
    yearOverYearChange,
    percentOfTotalExpenses
  } = comparativeData;

  const yoyChangeAbs = Math.abs(yearOverYearChange);
  const isIncrease = yearOverYearChange > 0;

  const chartData = [
    {
      name: 'This Year',
      amount: currentMonth,
      fill: '#3b82f6'
    },
    {
      name: 'Last Year',
      amount: lastYearSameMonth,
      fill: '#8b5cf6'
    }
  ];

  const recentMonths = historicalData?.monthlyData?.slice(-6) || [];
  const avgRecentSpending = recentMonths.length > 0
    ? recentMonths.reduce((sum, m) => sum + m.totalSpent, 0) / recentMonths.length
    : 0;

  const varianceFromAvg = currentMonth - avgRecentSpending;
  const variancePercent = avgRecentSpending > 0 ? (varianceFromAvg / avgRecentSpending) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Comparative Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Year-over-Year Comparison</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0];
                      return (
                        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                          <p className="font-semibold mb-1">{data.payload.name}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(data.value)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-xl font-bold">{formatCurrency(currentMonth)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Same Month Last Year</p>
              <p className="text-xl font-bold">{formatCurrency(lastYearSameMonth)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              {isIncrease ? (
                <TrendingUp className="h-5 w-5 text-red-600" />
              ) : yearOverYearChange < 0 ? (
                <TrendingDown className="h-5 w-5 text-green-600" />
              ) : (
                <Minus className="h-5 w-5 text-gray-500" />
              )}
              <span className="text-sm font-medium">Year-over-Year Change</span>
            </div>
            <Badge variant={isIncrease ? 'destructive' : yearOverYearChange < 0 ? 'default' : 'secondary'}>
              {isIncrease ? '+' : ''}{yoyChangeAbs.toFixed(1)}%
            </Badge>
          </div>
        </div>

        <div className="pt-4 border-t space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Percentage of Total Expenses</p>
              <Badge variant="outline">{percentOfTotalExpenses.toFixed(1)}%</Badge>
            </div>
            <Progress value={percentOfTotalExpenses} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              This category represents {percentOfTotalExpenses.toFixed(1)}% of your total monthly expenses
            </p>
          </div>
        </div>

        {recentMonths.length > 0 && (
          <div className="pt-4 border-t space-y-4">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium">6-Month Average</p>
                <p className="text-lg font-bold">{formatCurrency(avgRecentSpending)}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Current vs Avg:</span>
                  <Badge variant={varianceFromAvg > 0 ? 'destructive' : 'default'} className="text-xs">
                    {varianceFromAvg > 0 ? '+' : ''}{formatCurrency(varianceFromAvg)} ({variancePercent > 0 ? '+' : ''}{variancePercent.toFixed(1)}%)
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t space-y-3">
          <p className="text-sm font-medium">Insights</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            {Math.abs(yearOverYearChange) > 20 && (
              <div className="flex items-start gap-2">
                <span className="text-lg">•</span>
                <p>
                  Spending has {isIncrease ? 'increased' : 'decreased'} significantly ({yoyChangeAbs.toFixed(0)}%) compared to last year.
                  {isIncrease && ' Consider reviewing if this aligns with your financial goals.'}
                </p>
              </div>
            )}
            {percentOfTotalExpenses > 30 && (
              <div className="flex items-start gap-2">
                <span className="text-lg">•</span>
                <p>
                  This is a major expense category, representing over 30% of your total spending.
                  Small changes here can have a significant impact on your overall budget.
                </p>
              </div>
            )}
            {Math.abs(variancePercent) < 10 && (
              <div className="flex items-start gap-2">
                <span className="text-lg">•</span>
                <p>
                  Your spending this month is consistent with your recent average, showing stable spending patterns.
                </p>
              </div>
            )}
            {variancePercent > 20 && (
              <div className="flex items-start gap-2">
                <span className="text-lg">•</span>
                <p>
                  Current spending is {variancePercent.toFixed(0)}% higher than your 6-month average.
                  This may indicate an unusual month or a trend change.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
