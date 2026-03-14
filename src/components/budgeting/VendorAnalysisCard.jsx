import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/components/utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#06b6d4'];

export function VendorAnalysisCard({ vendorData }) {
  if (!vendorData?.monthlyData || !vendorData?.vendors) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Vendor Breakdown</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No vendor data available</p>
        </CardContent>
      </Card>
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

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Vendor Breakdown</p>
          <Badge variant="outline">{allVendorNames.length} Vendors</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tick={{ fill: 'currentColor', fontSize: 12 }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor', fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
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
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: entry.fill }}
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
                wrapperStyle={{ fontSize: '12px' }}
                iconType="square"
              />
              {sortedVendors.map((vendorName, index) => (
                <Bar
                  key={vendorName}
                  dataKey={vendorName}
                  stackId="vendors"
                  fill={vendorColorMap[vendorName]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-3">Total by Vendor</p>
          <div className="space-y-2">
            {sortedVendors.map((vendorName, index) => (
              <div key={vendorName} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: vendorColorMap[vendorName] }}
                  />
                  <span className="text-sm">{vendorName}</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(totalsByVendor[vendorName])}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
