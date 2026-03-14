import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { Badge } from '@/components/ui/badge';

const VENDOR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#f97316'];

function SpendingTrendSection({ historicalData, budget }) {
  if (!historicalData?.monthlyData) {
    return <p className="text-sm text-muted-foreground">No historical data available</p>;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">12-Month Spending Trend</p>
        <div className="flex items-center gap-2">
          {getTrendIcon()}
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {getTrendLabel()}
          </span>
        </div>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorSpentCombined" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
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
              fill="url(#colorSpentCombined)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Average</p>
          <p className="text-base font-semibold">{formatCurrency(summary.average)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Highest</p>
          <p className="text-base font-semibold text-red-600">{formatCurrency(summary.max)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Lowest</p>
          <p className="text-base font-semibold text-green-600">{formatCurrency(summary.min)}</p>
        </div>
      </div>

      {budgetAmount > 0 && (
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between mb-1">
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
  );
}

function VendorBreakdownSection({ vendorData }) {
  if (!vendorData?.monthlyData || !vendorData?.vendors) {
    return <p className="text-sm text-muted-foreground">No vendor data available</p>;
  }

  const { monthlyData, vendors: allVendorNames } = vendorData;

  const vendorColorMap = {};
  allVendorNames.forEach((vendorName, index) => {
    vendorColorMap[vendorName] = VENDOR_COLORS[index % VENDOR_COLORS.length];
  });

  const chartData = monthlyData.map(month => {
    const dataPoint = {
      month: month.month.split(' ')[0],
      fullMonth: month.month
    };
    month.vendors.forEach(vendor => {
      dataPoint[vendor.name] = vendor.totalSpent;
    });
    return dataPoint;
  });

  const totalsByVendor = {};
  monthlyData.forEach(month => {
    month.vendors.forEach(vendor => {
      if (!totalsByVendor[vendor.name]) totalsByVendor[vendor.name] = 0;
      totalsByVendor[vendor.name] += vendor.totalSpent;
    });
  });

  const sortedVendors = Object.entries(totalsByVendor)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Vendor Breakdown</p>
        <Badge variant="outline">{allVendorNames.length} Vendors</Badge>
      </div>

      <div className="h-44 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
            barSize={32}
            barGap={2}
          >
            <defs>
              {sortedVendors.map((vendorName, index) => {
                const color = vendorColorMap[vendorName];
                return (
                  <linearGradient key={vendorName} id={`gradient-combined-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.9}/>
                    <stop offset="100%" stopColor={color} stopOpacity={0.7}/>
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              dy={5}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
              dx={-5}
            />
            <Tooltip
              cursor={false}
              position={{ y: -10 }}
              wrapperStyle={{ zIndex: 1000 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const monthData = chartData.find(d => d.month === label);
                const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
                return (
                  <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                    <p className="font-semibold mb-2">{monthData?.fullMonth}</p>
                    {payload
                      .sort((a, b) => b.value - a.value)
                      .map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-4 mb-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: vendorColorMap[entry.name] }}
                            />
                            <span className="text-sm">{entry.name}</span>
                          </div>
                          <span className="text-sm font-semibold">{formatCurrency(entry.value)}</span>
                        </div>
                      ))}
                    <div className="flex items-center justify-between gap-4 mt-2 pt-2 border-t">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="text-sm font-semibold">{formatCurrency(total)}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }}
              iconType="circle"
              iconSize={8}
            />
            {sortedVendors.map((vendorName, index) => (
              <Bar
                key={vendorName}
                dataKey={vendorName}
                stackId="vendors"
                fill={`url(#gradient-combined-${index})`}
                radius={index === sortedVendors.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-3 border-t">
        <p className="text-sm font-medium mb-2">Average Monthly Spend by Vendor</p>
        <div className="space-y-2">
          {sortedVendors.map((vendorName) => {
            const monthsWithSpend = monthlyData.filter(month =>
              month.vendors.some(v => v.name === vendorName)
            ).length;
            const avgSpend = monthsWithSpend > 0 ? totalsByVendor[vendorName] / monthsWithSpend : 0;

            return (
              <div key={vendorName} className="flex items-center justify-between group hover:bg-accent/50 -mx-2 px-2 py-0.5 rounded-md transition-colors">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: vendorColorMap[vendorName] }}
                  />
                  <span className="text-sm font-medium">{vendorName}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{formatCurrency(avgSpend)}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">/ mo</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SpendingAndVendorCard({ historicalData, budget, vendorData }) {
  const [activeTab, setActiveTab] = useState('trend');

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-1 border-b">
          <button
            onClick={() => setActiveTab('trend')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
              activeTab === 'trend'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Spending Trend
            {activeTab === 'trend' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
              activeTab === 'vendors'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Vendor Breakdown
            {activeTab === 'vendors' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
            )}
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {activeTab === 'trend' ? (
          <SpendingTrendSection historicalData={historicalData} budget={budget} />
        ) : (
          <VendorBreakdownSection vendorData={vendorData} />
        )}
      </CardContent>
    </Card>
  );
}
