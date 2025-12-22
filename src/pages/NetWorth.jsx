import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function NetWorth() {
  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-8 pt-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-slate-400" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Net Worth</h1>
              <p className="text-slate-500">Coming Soon</p>
            </div>
          </CardHeader>
          <CardContent className="pb-12">
            <div className="text-center max-w-md mx-auto">
              <p className="text-slate-600">
                Track your assets, liabilities, and overall net worth in one place. This feature is currently under development.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}