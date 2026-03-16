import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { Badge } from '@/components/ui/badge';

const VENDOR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#6366f1', '#14b8a6',
  '#f97316', '#84cc16'
];

function mergeData(historicalData, vendorData) {
  const monthlySpending = historicalData?.monthlyData || [];
  const monthlyVendors = vendorData?.monthlyData || [];
  const allVendors = vendorData?.vendors || [];

  const vendorColorMap = {};
  allVendors.forEach((name, i) => {
    vendorColorMap[name] = VENDOR_COLORS[i % VENDOR_COLORS.length];
  });

  const totalsByVendor = {};
  const monthCountByVendor = {};

  const merged = monthlySpending.map(spendMonth => {
    const vendorMonth = monthlyVendors.find(v => v.monthKey === spendMonth.monthKey);
    const point = {
      month: spendMonth.month.split(' ')[0],
      fullMonth: spendMonth.month,
      totalSpent: spendMonth.totalSpent,
      transactionCount: spendMonth.transactionCount,
    };

    let vendorSum = 0;
    if (vendorMonth?.vendors) {
      vendorMonth.vendors.forEach(v => {
        point[v.name] = v.totalSpent;
        vendorSum += v.totalSpent;
        totalsByVendor[v.name] = (totalsByVendor[v.name] || 0) + v.totalSpent;
        monthCountByVendor[v.name] = (monthCountByVendor[v.name] || 0) + 1;
      });
    }

    point.stackTotal = vendorSum;

    return point;
  });

  const sortedVendors = Object.entries(totalsByVendor)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return { merged, sortedVendors, vendorColorMap, totalsByVendor, monthCountByVendor };
}

function CustomTooltip({ active, payload, vendorColorMap, budgetAmount }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const vendorEntries = payload.filter(p => p.dataKey !== 'totalSpent' && p.dataKey !== 'stackTotal');
  const total = vendorEntries.reduce((sum, p) => sum + (p.value || 0), 0);
  const displayTotal = data.totalSpent || total;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="font-semibold text-sm mb-2">{data.fullMonth}</p>

      {vendorEntries.length > 0 && (
        <div className="space-y-1 mb-2">
          {vendorEntries
            .filter(e => e.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((entry, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: vendorColorMap[entry.name] }} />
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">{entry.name}</span>
                </div>
                <span className="text-xs font-medium">{formatCurrency(entry.value)}</span>
              </div>
            ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <span className="text-xs font-semibold">Total</span>
        <span className="text-xs font-semibold">{formatCurrency(displayTotal)}</span>
      </div>

      {budgetAmount > 0 && (
        <div className="flex items-center justify-between gap-3 mt-1">
          <span className="text-xs text-muted-foreground">Budget</span>
          <span className="text-xs font-medium">{formatCurrency(budgetAmount)}</span>
        </div>
      )}
    </div>
  );
}

function VendorLegend({ sortedVendors, vendorColorMap, totalsByVendor, monthCountByVendor, hoveredVendor, setHoveredVendor }) {
  if (!sortedVendors.length) return null;

  return (
    <div className="space-y-1">
      {sortedVendors.map(name => {
        const avg = monthCountByVendor[name] > 0 ? totalsByVendor[name] / monthCountByVendor[name] : 0;
        const isHovered = hoveredVendor === name;
        const isFaded = hoveredVendor && !isHovered;

        return (
          <div
            key={name}
            className={`flex items-center justify-between -mx-2 px-2 py-1 rounded-md transition-all duration-150 cursor-default ${
              isFaded ? 'opacity-30' : 'hover:bg-accent/50'
            }`}
            onMouseEnter={() => setHoveredVendor(name)}
            onMouseLeave={() => setHoveredVendor(null)}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: vendorColorMap[name] }}
              />
              <span className="text-sm">{name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{formatCurrency(avg)}/mo</span>
              <span className="text-sm font-semibold tabular-nums w-20 text-right">{formatCurrency(totalsByVendor[name])}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SpendingAndVendorCard({ historicalData, budget, vendorData }) {
  const [hoveredVendor, setHoveredVendor] = useState(null);
  const budgetAmount = budget?.allocated_amount || 0;
  const summary = historicalData?.summary;

  const { merged, sortedVendors, vendorColorMap, totalsByVendor, monthCountByVendor } = useMemo(
    () => mergeData(historicalData, vendorData),
    [historicalData, vendorData]
  );

  if (!historicalData?.monthlyData) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No spending data available
        </CardContent>
      </Card>
    );
  }

  const getTrendInfo = () => {
    if (!summary) return { icon: <Minus className="h-3.5 w-3.5" />, label: 'Stable', color: 'text-slate-500' };
    if (summary.trend === 'increasing') return { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Trending Up', color: 'text-red-500' };
    if (summary.trend === 'decreasing') return { icon: <TrendingDown className="h-3.5 w-3.5" />, label: 'Trending Down', color: 'text-green-500' };
    return { icon: <Minus className="h-3.5 w-3.5" />, label: 'Stable', color: 'text-slate-500' };
  };

  const trend = getTrendInfo();

  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">12-Month Spending</p>
          <div className={`flex items-center gap-1.5 ${trend.color}`}>
            {trend.icon}
            <span className="text-xs font-medium">{trend.label}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 space-y-4">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={merged} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                {sortedVendors.map((name, i) => (
                  <linearGradient key={name} id={`vendorGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={vendorColorMap[name]} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={vendorColorMap[name]} stopOpacity={0.6} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />

              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                dy={5}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              />

              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3, radius: 4 }}
                content={<CustomTooltip vendorColorMap={vendorColorMap} budgetAmount={budgetAmount} />}
              />

              {budgetAmount > 0 && (
                <ReferenceLine
                  y={budgetAmount}
                  stroke="#ef4444"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                />
              )}

              {sortedVendors.length > 0 ? (
                <>
                  {sortedVendors.map((name, i) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="vendors"
                      fill={`url(#vendorGrad-${i})`}
                      radius={i === sortedVendors.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      opacity={hoveredVendor ? (hoveredVendor === name ? 1 : 0.15) : 1}
                      style={{ transition: 'opacity 150ms ease' }}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="stackTotal"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--background))', stroke: '#f59e0b', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: '#f59e0b' }}
                  />
                </>
              ) : (
                <Bar
                  dataKey="totalSpent"
                  fill="#3b82f6"
                  radius={[3, 3, 0, 0]}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Lowest</p>
            <p className="text-base font-semibold text-green-600 tabular-nums">{formatCurrency(summary?.min || 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-base font-semibold tabular-nums">{formatCurrency(summary?.average || 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Highest</p>
            <p className="text-base font-semibold text-red-600 tabular-nums">{formatCurrency(summary?.max || 0)}</p>
          </div>
        </div>

        {budgetAmount > 0 && (
          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-sm">
              {summary?.average > budgetAmount ? (
                <>Avg. <span className="font-semibold text-red-600">{formatCurrency(summary.average - budgetAmount)}</span> over budget</>
              ) : (
                <>Avg. <span className="font-semibold text-green-600">{formatCurrency(budgetAmount - (summary?.average || 0))}</span> under budget</>
              )}
            </p>
            <Badge variant={summary?.average > budgetAmount ? 'destructive' : 'default'} className="text-xs">
              {summary?.average > budgetAmount ? 'Over Budget' : 'Under Budget'}
            </Badge>
          </div>
        )}

        {sortedVendors.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendors</p>
              <Badge variant="outline" className="text-[10px]">{sortedVendors.length}</Badge>
            </div>
            <VendorLegend
              sortedVendors={sortedVendors}
              vendorColorMap={vendorColorMap}
              totalsByVendor={totalsByVendor}
              monthCountByVendor={monthCountByVendor}
              hoveredVendor={hoveredVendor}
              setHoveredVendor={setHoveredVendor}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
