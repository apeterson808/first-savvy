import React from 'react';
import * as Icons from 'lucide-react';
import { convertCadence } from '@/utils/cadenceUtils';

function lightenColor(hex, percent = 80) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) + Math.round((255 - (num >> 16)) * (percent / 100));
  const g = ((num >> 8) & 0x00FF) + Math.round((255 - ((num >> 8) & 0x00FF)) * (percent / 100));
  const b = (num & 0x0000FF) + Math.round((255 - (num & 0x0000FF)) * (percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default function BudgetProgressPill({ budget, actualAmount = 0, isIncome = false }) {
  const categoryData = budget.chartAccount;
  const IconComponent = categoryData?.icon && Icons[categoryData.icon] ? Icons[categoryData.icon] : Icons.Circle;

  const budgetedAmount = convertCadence(
    parseFloat(budget.allocated_amount || 0),
    budget.cadence || 'monthly',
    'monthly'
  );

  const percentage = budgetedAmount > 0 ? (actualAmount / budgetedAmount) * 100 : 0;
  const remaining = budgetedAmount - actualAmount;
  const isOverBudget = actualAmount > budgetedAmount;
  const isNearLimit = percentage >= 80 && percentage < 100;

  const categoryColor = categoryData?.color || '#64748b';

  let progressColor = categoryColor;
  let bgColor = lightenColor(categoryColor, 85);

  if (!isIncome) {
    if (isOverBudget) {
      progressColor = '#ef4444';
      bgColor = '#fee2e2';
    } else if (isNearLimit) {
      progressColor = '#f59e0b';
      bgColor = '#fef3c7';
    }
  }

  const displayPercentage = Math.min(percentage, 100);

  return (
    <div className="group relative">
      <div className="p-3 rounded-lg border border-slate-200 bg-white hover:shadow-md transition-all duration-200">
        <div className="relative h-10 rounded-full overflow-hidden" style={{ backgroundColor: bgColor }}>
          <div
            className="absolute left-0 top-0 h-full transition-all duration-500 ease-out rounded-full"
            style={{
              width: `${displayPercentage}%`,
              backgroundColor: progressColor
            }}
          />

          <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <IconComponent className="w-4 h-4 flex-shrink-0" style={{ color: categoryColor }} />
              <span className="font-semibold text-sm text-slate-900 truncate">
                {categoryData?.display_name || 'Unknown Category'}
              </span>
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

        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-slate-500">
            {isOverBudget ? (
              <span className="text-red-600 font-medium">
                Over by ${Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : (
              <span>
                ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining
              </span>
            )}
          </span>
          {!isIncome && (isOverBudget || isNearLimit) && (
            <span className="text-[10px] font-medium">
              {isOverBudget ? (
                <span className="text-red-600 flex items-center gap-1">
                  <Icons.AlertCircle className="w-3 h-3" />
                  Over Budget
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <Icons.AlertTriangle className="w-3 h-3" />
                  Near Limit
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
