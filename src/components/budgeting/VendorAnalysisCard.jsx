import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/components/utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#f97316'];

export function VendorAnalysisCard({ vendorData, compact = false }) {
  const Wrapper = compact ? 'div' : Card;
  const wrapperProps = compact ? { className: 'border rounded-lg' } : {};
  const HeaderWrapper = compact ? 'div' : CardHeader;
  const headerProps = compact ? { className: 'px-3 pt-2 pb-1' } : { className: 'pb-2 pt-3 px-3' };
  const ContentWrapper = compact ? 'div' : CardContent;
  const contentProps = compact ? { className: 'px-3 pb-3 space-y-3' } : { className: 'space-y-6' };

  if (!vendorData?.monthlyData || !vendorData?.vendors) {
    return (
      <Wrapper {...wrapperProps}>
        <HeaderWrapper {...headerProps}>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Vendor Breakdown</p>
        </HeaderWrapper>
        <ContentWrapper {...(compact ? { className: 'px-3 pb-3' } : {})}>
          <p className="text-sm text-muted-foreground">No vendor data available</p>
        </ContentWrapper>
      </Wrapper>
    );
  }

  const { monthlyData, vendors: allVendorNames } = vendorData;

  const vendorColorMap = {};
  allVendorNames.forEach((vendorName, index) => {
    vendorColorMap[vendorName] = COLORS[index % COLORS.length];
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
      if (!totalsByVendor[vendor.name]) {
        totalsByVendor[vendor.name] = 0;
      }
      totalsByVendor[vendor.name] += vendor.totalSpent;
    });
  });

  const sortedVendors = Object.entries(totalsByVendor)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const displayVendors = compact ? sortedVendors.slice(0, 5) : sortedVendors;

  return (
    <Wrapper {...wrapperProps}>
      <HeaderWrapper {...headerProps}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Vendor Breakdown</p>
          <Badge variant="outline">{allVendorNames.length} Vendors</Badge>
        </div>
      </HeaderWrapper>
      <ContentWrapper {...contentProps}>
        <div className={`${compact ? 'h-36' : 'h-48'} -mx-2`}>
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
                    <linearGradient key={vendorName} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
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
                  fill={`url(#gradient-${index})`}
                  radius={index === sortedVendors.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  onMouseEnter={(data, barIndex, e) => {
                    const allBars = e.target.parentNode.querySelectorAll('path.recharts-rectangle');
                    allBars.forEach(bar => {
                      bar.style.transform = 'translateY(-2px)';
                      bar.style.transition = 'all 0.2s ease';
                      bar.style.filter = 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))';
                    });
                  }}
                  onMouseLeave={(data, barIndex, e) => {
                    const allBars = e.target.parentNode.querySelectorAll('path.recharts-rectangle');
                    allBars.forEach(bar => {
                      bar.style.transform = 'translateY(0)';
                      bar.style.filter = 'none';
                    });
                  }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`${compact ? 'pt-2' : 'pt-4'} border-t`}>
          <p className="text-sm font-medium mb-3">Average Monthly Spend by Vendor</p>
          <div className="space-y-2.5">
            {displayVendors.map((vendorName, index) => {
              const monthsWithSpend = monthlyData.filter(month =>
                month.vendors.some(v => v.name === vendorName)
              ).length;
              const avgSpend = monthsWithSpend > 0 ? totalsByVendor[vendorName] / monthsWithSpend : 0;

              return (
                <div key={vendorName} className={`flex items-center justify-between group hover:bg-accent/50 -mx-2 px-2 ${compact ? 'py-0.5' : 'py-1'} rounded-md transition-colors`}>
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
      </ContentWrapper>
    </Wrapper>
  );
}
