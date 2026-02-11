import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../pages/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowUp, Percent, Bell } from 'lucide-react';

export default function CreditScoreCard({ creditScore }) {
  const score = creditScore?.score || 720;
  const minScore = 300;
  const maxScore = 850;
  const position = ((score - minScore) / (maxScore - minScore)) * 100;
  
  const getRating = () => {
    if (score >= 800) return 'Excellent';
    if (score >= 740) return 'Very Good';
    if (score >= 670) return 'Good';
    if (score >= 580) return 'Fair';
    return 'Poor';
  };
  
  return (
    <Link to={createPageUrl('CreditScore')}>
    <Card className="shadow-sm border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Credit Score</p>
          <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">View details →</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {/* Score Display */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-3xl font-bold text-slate-900">{score}</div>
            <div className="text-sm text-slate-600 mt-0.5">{getRating()}</div>
          </div>
          <div className="text-right">
            <div className="flex items-center text-green-600 text-sm font-medium">
              <ArrowUp className="w-4 h-4 mr-1" />
              +12 pts
            </div>
            <div className="text-xs text-slate-500">This month</div>
          </div>
        </div>
        
        {/* Horizontal Bar */}
        <div className="mb-2">
          <div className="relative h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full overflow-visible">
            <div 
              className="absolute -top-1 h-4 w-2 bg-white border-2 border-slate-900 rounded-full shadow-lg"
              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>{minScore}</span>
            <span>{maxScore}</span>
          </div>
        </div>
        
        {/* Compact Stats */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg">
            <Percent className="w-4 h-4 text-slate-600" />
            <div>
              <div className="text-sm font-semibold text-slate-900">{creditScore?.credit_utilization || 28}%</div>
              <div className="text-xs text-slate-600">Usage</div>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg">
            <Bell className="w-4 h-4 text-amber-500" />
            <div>
              <div className="text-sm font-semibold text-slate-900">2</div>
              <div className="text-xs text-slate-600">Alerts</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}