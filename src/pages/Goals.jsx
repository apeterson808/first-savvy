import React from 'react';
import { PiggyBank } from 'lucide-react';

export default function Goals() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="p-6 bg-slate-200 rounded-full">
            <PiggyBank className="w-16 h-16 text-slate-400" />
          </div>
        </div>
        <h1 className="text-3xl font-semibold text-slate-800 mb-3">Goals & Savings</h1>
        <p className="text-xl text-slate-500">Coming Soon</p>
      </div>
    </div>
  );
}
