import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CreditScore() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[calc(100vh-120px)]">
      <Card className="shadow-sm border-slate-200 max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Coming Soon</h2>
          <p className="text-slate-500 mb-6">
            Credit Score tracking is currently under development. We're working hard to bring you comprehensive credit monitoring features.
          </p>
          <Button variant="outline" className="gap-2" disabled>
            <Bell className="w-4 h-4" />
            Notify Me When Ready
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}