import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { convertCadence } from '@/utils/cadenceUtils';

function lightenColor(hex, percent = 80) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) + Math.round((255 - (num >> 16)) * (percent / 100));
  const g = ((num >> 8) & 0x00FF) + Math.round((255 - ((num >> 8) & 0x00FF)) * (percent / 100));
  const b = (num & 0x0000FF) + Math.round((255 - (num & 0x0000FF)) * (percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function adjustColorOpacity(hex, opacity = 0.5) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00FF;
  const b = num & 0x0000FF;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function BudgetProgressPill({ budget, actualAmount = 0, isIncome = false, isChild = false, isParent = false, allocatedAmount = null }) {
  const categoryData = budget.chartAccount;
  const IconComponent = categoryData?.icon && Icons[categoryData.icon] ? Icons[categoryData.icon] : Icons.Circle;

  const budgetedAmount = allocatedAmount !== null ? allocatedAmount : convertCadence(
    parseFloat(budget.allocated_amount || 0),
    budget.cadence || 'monthly',
    'monthly'
  );

  const percentage = budgetedAmount > 0 ? (actualAmount / budgetedAmount) * 100 : 0;
  const remaining = budgetedAmount - actualAmount;
  const isOverBudget = actualAmount > budgetedAmount;
  const isNearLimit = percentage >= 80 && percentage < 100;

  const categoryColor = categoryData?.color || '#64748b';

  let progressColor = adjustColorOpacity(categoryColor, 0.5);
  let bgColor = lightenColor(categoryColor, 85);

  if (!isIncome && !isChild) {
    if (isOverBudget) {
      progressColor = 'rgba(239, 68, 68, 0.5)';
      bgColor = '#fee2e2';
    } else if (isNearLimit) {
      progressColor = 'rgba(245, 158, 11, 0.5)';
      bgColor = '#fef3c7';
    }
  }

  const displayPercentage = Math.min(percentage, 100);

  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(displayPercentage);
    }, 50);
    return () => clearTimeout(timer);
  }, [displayPercentage]);

  return (
    <div className="group relative">
      <div className="relative h-9 rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: bgColor }}>
        <div
          className="absolute left-0 top-0 h-full transition-all duration-700 ease-out rounded-2xl"
          style={{
            width: `${animatedWidth}%`,
            backgroundColor: progressColor
          }}
        />

        <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <IconComponent className="w-4 h-4 flex-shrink-0 text-white" />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-semibold text-sm text-slate-900 truncate">
                {categoryData?.display_name || 'Unknown Category'}
              </span>
              <span className="text-xs text-slate-400 font-normal flex-shrink-0">
                {percentage.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-slate-900">
                ${actualAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-600">
                ${budgetedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
