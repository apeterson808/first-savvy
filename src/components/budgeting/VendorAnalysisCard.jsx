import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Building2, ExternalLink, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#06b6d4'];

export function VendorAnalysisCard({ vendorData }) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  if (!vendorData?.vendors) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Vendor Analysis</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No vendor data available</p>
        </CardContent>
      </Card>
    );
  }

  const { vendors, uncategorized, totalSpent } = vendorData;
  const displayVendors = showAll ? vendors : vendors.slice(0, 5);

  const chartData = vendors.slice(0, 8).map((vendor, index) => ({
    name: vendor.name,
    value: vendor.totalSpent,
    color: COLORS[index % COLORS.length]
  }));

  if (uncategorized.totalSpent > 0) {
    chartData.push({
      name: 'No Vendor',
      value: uncategorized.totalSpent,
      color: '#9ca3af'
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Vendor Breakdown</p>
          <Badge variant="outline">{vendors.length} Vendors</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {chartData.length > 0 && (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0];
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                        <p className="font-semibold mb-1">{data.name}</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(data.value)}</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium">Top Vendors</p>
          {displayVendors.map((vendor, index) => {
            const percentage = totalSpent > 0 ? (vendor.totalSpent / totalSpent) * 100 : 0;
            return (
              <div key={vendor.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <button
                      onClick={() => navigate(`/contacts/${vendor.id}`)}
                      className="text-sm font-medium hover:underline truncate"
                    >
                      {vendor.name}
                    </button>
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold">{formatCurrency(vendor.totalSpent)}</p>
                    <p className="text-xs text-muted-foreground">{vendor.transactionCount} txns</p>
                  </div>
                </div>
                <Progress value={percentage} className="h-1.5" />
              </div>
            );
          })}

          {uncategorized.totalSpent > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span className="text-sm font-medium text-muted-foreground">No Vendor Assigned</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(uncategorized.totalSpent)}</p>
                  <p className="text-xs text-muted-foreground">{uncategorized.transactionCount} txns</p>
                </div>
              </div>
              <Progress value={(uncategorized.totalSpent / totalSpent) * 100} className="h-1.5" />
            </div>
          )}

          {vendors.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show Less' : `Show All ${vendors.length} Vendors`}
            </Button>
          )}
        </div>

        {vendors.length > 0 && (
          <div className="pt-4 border-t grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg per Vendor</p>
              <p className="text-sm font-semibold">
                {formatCurrency(totalSpent / vendors.length)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Most Frequent</p>
              <p className="text-sm font-semibold truncate">
                {vendors.sort((a, b) => b.transactionCount - a.transactionCount)[0]?.name || 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Highest Spend</p>
              <p className="text-sm font-semibold truncate">
                {vendors[0]?.name || 'N/A'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
