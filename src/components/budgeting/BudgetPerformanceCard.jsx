import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { differenceInDays, startOfMonth, endOfMonth } from 'date-fns';

export function BudgetPerformanceCard({ budget, currentSpending, performanceHistory, compact = false }) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const daysElapsed = differenceInDays(now, monthStart) + 1;
  const percentOfMonthElapsed = (daysElapsed / daysInMonth) * 100;

  const budgetAmount = budget?.allocated_amount || 0;
  const accumulatedRollover = budget?.accumulated_rollover || 0;
  const isRolloverEnabled = budget?.rollover_enabled || false;
  const effectiveBudget = isRolloverEnabled ? budgetAmount + accumulatedRollover : budgetAmount;

  const spent = currentSpending || 0;
  const remaining = effectiveBudget - spent;
  const percentUsed = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0;

  const expectedSpending = (effectiveBudget * percentOfMonthElapsed) / 100;
  const spendingPace = spent - expectedSpending;
  const isOnPace = Math.abs(spendingPace) < (budgetAmount * 0.05);
  const isOverPace = spendingPace > 0;

  const getPaceStatus = () => {
    if (isOnPace) return { label: 'On Pace', color: 'text-green-600', icon: CheckCircle };
    if (isOverPace) return { label: 'Over Pace', color: 'text-red-600', icon: AlertCircle };
    return { label: 'Under Pace', color: 'text-blue-600', icon: TrendingDown };
  };

  const paceStatus = getPaceStatus();
  const PaceIcon = paceStatus.icon;

  const adherenceRate = performanceHistory?.adherenceRate || 0;

  const Wrapper = compact ? 'div' : Card;
  const wrapperProps = compact ? { className: 'border rounded-lg h-full flex flex-col' } : { className: 'h-full flex flex-col' };
  const HeaderWrapper = compact ? 'div' : CardHeader;
  const headerProps = compact ? { className: 'px-3 pt-2 pb-1' } : { className: 'pb-2 pt-3 px-3' };
  const ContentWrapper = compact ? 'div' : CardContent;
  const contentProps = compact ? { className: 'px-3 pb-3 space-y-3 flex-1' } : { className: 'space-y-4 flex-1' };

  return (
    <Wrapper {...wrapperProps}>
      <HeaderWrapper {...headerProps}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Budget Performance - Current Month</p>
      </HeaderWrapper>
      <ContentWrapper {...contentProps}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Budget Progress</span>
            <Badge variant={percentUsed > 100 ? 'destructive' : percentUsed > 90 ? 'secondary' : 'default'}>
              {percentUsed.toFixed(0)}% Used
            </Badge>
          </div>
          <div className="relative">
            <Progress value={Math.min(percentUsed, 100)} className="h-3" />
            <div
              className="absolute top-0 h-full w-0.5 bg-blue-600 z-10"
              style={{ left: `${Math.min(percentOfMonthElapsed, 100)}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs font-medium text-blue-600 whitespace-nowrap bg-white px-1 rounded">
                Day {daysElapsed}
              </div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(spent)} spent</span>
            <span>{formatCurrency(effectiveBudget)} available</span>
          </div>
        </div>

        {isRolloverEnabled && accumulatedRollover > 0 && (
          <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
            <div>
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Rollover Budget</p>
              <p className="text-[10px] text-blue-700 dark:text-blue-300">
                {formatCurrency(budgetAmount)} + {formatCurrency(accumulatedRollover)} accumulated
              </p>
            </div>
            <p className="text-base font-bold text-blue-900 dark:text-blue-100">{formatCurrency(effectiveBudget)}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Remaining</p>
            <p className={`text-lg font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(remaining))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Days Left</p>
            <p className="text-lg font-bold">{daysInMonth - daysElapsed}<span className="text-xs text-muted-foreground font-normal ml-1">/ {daysInMonth}</span></p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Pace</p>
            <div className="flex items-center gap-1">
              <PaceIcon className={`h-3.5 w-3.5 ${paceStatus.color}`} />
              <span className={`text-sm font-medium ${paceStatus.color}`}>{paceStatus.label}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Expected</p>
            <p className="text-sm font-medium">{formatCurrency(expectedSpending)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Variance</p>
            <p className={`text-sm font-medium ${isOverPace ? 'text-red-600' : 'text-green-600'}`}>
              {isOverPace ? '+' : ''}{formatCurrency(spendingPace)}
            </p>
          </div>
        </div>

        {performanceHistory && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Historical Performance</span>
                <p className="text-[10px] text-muted-foreground">
                  {Math.round((adherenceRate / 100) * 12)} of 12 months under budget
                </p>
              </div>
              <Badge variant={adherenceRate >= 75 ? 'default' : adherenceRate >= 50 ? 'secondary' : 'destructive'}>
                {adherenceRate.toFixed(0)}%
              </Badge>
            </div>
            <Progress value={adherenceRate} className="h-2 mt-2" />
          </div>
        )}

        {percentUsed > 90 && percentUsed <= 100 && (
          <div className={`flex items-start gap-2 ${compact ? 'p-2' : 'p-3'} bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg`}>
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Approaching Budget Limit</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                You've used {percentUsed.toFixed(0)}% of your budget with {daysInMonth - daysElapsed} days remaining
              </p>
            </div>
          </div>
        )}

        {percentUsed > 100 && (
          <div className={`flex items-start gap-2 ${compact ? 'p-2' : 'p-3'} bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg`}>
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">Budget Exceeded</p>
              <p className="text-xs text-red-700 dark:text-red-300">
                You're {formatCurrency(spent - effectiveBudget)} over budget with {daysInMonth - daysElapsed} days remaining
              </p>
            </div>
          </div>
        )}
      </ContentWrapper>
    </Wrapper>
  );
}
