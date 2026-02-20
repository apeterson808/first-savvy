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
  const isNearLimit = percentage >= 75 && percentage < 100;

  // Status-based pastel color scheme
  let progressColor, bgColor;

  if (!isIncome && !isChild) {
    if (isOverBudget) {
      // Red pastel for over budget (100%+)
      progressColor = 'rgba(239, 68, 68, 0.7)';
      bgColor = '#fee2e2';
    } else if (isNearLimit) {
      // Amber pastel for approaching limit (75-99%)
      progressColor = 'rgba(245, 158, 11, 0.7)';
      bgColor = '#fef3c7';
    } else {
      // Green pastel for on-track (0-74%)
      progressColor = 'rgba(34, 197, 94, 0.7)';
      bgColor = '#dcfce7';
    }
  } else {
    // For income and child categories, use neutral gray
    progressColor = 'rgba(100, 116, 139, 0.7)';
    bgColor = '#f1f5f9';
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
      <div className="relative h-7 rounded-lg overflow-hidden shadow-sm" style={{ backgroundColor: bgColor }}>
        <div
          className="absolute left-0 top-0 h-full transition-all duration-700 ease-out"
          style={{
            width: `${animatedWidth}%`,
            backgroundColor: progressColor
          }}
        />

        <div className="absolute inset-0 flex items-center justify-between px-3 z-10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <IconComponent className="w-3.5 h-3.5 flex-shrink-0 text-white" />
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
