import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, TrendingDown, Lightbulb, Circle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';
import { differenceInDays, startOfMonth, endOfMonth } from 'date-fns';

function BudgetRecommendation({ budgetAmount, historicalData, comparativeData }) {
  if (!budgetAmount || !historicalData?.summary) return null;

  const { average, max, min } = historicalData.summary;
  const recentMonths = historicalData.monthlyData?.slice(-6) || [];
  const recentAvg = recentMonths.length > 0
    ? recentMonths.reduce((sum, m) => sum + m.totalSpent, 0) / recentMonths.length
    : average;

  const diff = budgetAmount - recentAvg;
  const diffPercent = budgetAmount > 0 ? (diff / budgetAmount) * 100 : 0;

  const yoyChange = comparativeData?.yearOverYearChange || 0;

  let recommendation = null;
  let tone = 'blue';

  if (diffPercent < -10) {
    const suggested = Math.ceil(recentAvg * 1.1 / 10) * 10;
    recommendation = `Your 6-month average (${formatCurrency(recentAvg)}) consistently exceeds your budget. Consider raising it to around ${formatCurrency(suggested)} to better reflect actual spending.`;
    tone = 'amber';
  } else if (diffPercent > 40) {
    const suggested = Math.ceil(recentAvg * 1.15 / 10) * 10;
    recommendation = `You're regularly spending well below budget. You could lower it to around ${formatCurrency(suggested)} and redirect the surplus elsewhere.`;
    tone = 'green';
  } else if (yoyChange > 25) {
    recommendation = `Year-over-year spending is up ${yoyChange.toFixed(0)}%. If this trend continues, a budget increase may be needed soon.`;
    tone = 'amber';
  } else if (yoyChange < -25) {
    recommendation = `Year-over-year spending is down ${Math.abs(yoyChange).toFixed(0)}%. Your current budget may be higher than necessary.`;
    tone = 'green';
  } else {
    recommendation = `Your budget of ${formatCurrency(budgetAmount)} aligns well with your recent spending average of ${formatCurrency(recentAvg)}. No changes recommended.`;
    tone = 'blue';
  }

  const toneStyles = {
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'text-amber-600',
      title: 'text-amber-900 dark:text-amber-100',
      text: 'text-amber-700 dark:text-amber-300',
    },
    green: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: 'text-emerald-600',
      title: 'text-emerald-900 dark:text-emerald-100',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-600',
      title: 'text-blue-900 dark:text-blue-100',
      text: 'text-blue-700 dark:text-blue-300',
    },
  };

  const s = toneStyles[tone];

  return (
    <div className={`flex items-start gap-2 p-3 ${s.bg} border ${s.border} rounded-lg`}>
      <Lightbulb className={`h-4 w-4 ${s.icon} mt-0.5 flex-shrink-0`} />
      <div className="space-y-1">
        <p className={`text-sm font-medium ${s.title}`}>Budget Recommendation</p>
        <p className={`text-xs ${s.text}`}>{recommendation}</p>
      </div>
    </div>
  );
}

function ComparisonSection({ comparativeData, historicalData }) {
  if (!comparativeData) return null;

  const {
    currentMonth,
    lastYearSameMonth,
    yearOverYearChange,
    percentOfTotalExpenses,
  } = comparativeData;

  const yoyChangeAbs = Math.abs(yearOverYearChange);
  const isIncrease = yearOverYearChange > 0;

  const recentMonths = historicalData?.monthlyData?.slice(-6) || [];
  const avgRecentSpending = recentMonths.length > 0
    ? recentMonths.reduce((sum, m) => sum + m.totalSpent, 0) / recentMonths.length
    : 0;
  const varianceFromAvg = currentMonth - avgRecentSpending;
  const variancePercent = avgRecentSpending > 0 ? (varianceFromAvg / avgRecentSpending) * 100 : 0;

  return (
    <div className="pt-3 border-t space-y-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Comparative Analysis</p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">This Month</p>
          <p className="text-sm font-bold">{formatCurrency(currentMonth)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Last Year</p>
          <p className="text-sm font-bold">{formatCurrency(lastYearSameMonth)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">6-Mo Avg</p>
          <p className="text-sm font-bold">{formatCurrency(avgRecentSpending)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 p-2 bg-muted rounded-lg">
          {isIncrease ? (
            <TrendingUp className="h-4 w-4 text-red-600 flex-shrink-0" />
          ) : yearOverYearChange < 0 ? (
            <TrendingDown className="h-4 w-4 text-green-600 flex-shrink-0" />
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">YoY Change</p>
            <p className={`text-xs font-semibold ${isIncrease ? 'text-red-600' : yearOverYearChange < 0 ? 'text-green-600' : ''}`}>
              {isIncrease ? '+' : ''}{yoyChangeAbs.toFixed(1)}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-1 p-2 bg-muted rounded-lg">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground">% of Total Expenses</p>
            <p className="text-xs font-semibold">{percentOfTotalExpenses.toFixed(1)}%</p>
          </div>
        </div>
        {recentMonths.length > 0 && (
          <div className="flex items-center gap-2 flex-1 p-2 bg-muted rounded-lg">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">vs 6-Mo Avg</p>
              <p className={`text-xs font-semibold ${varianceFromAvg > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {varianceFromAvg > 0 ? '+' : ''}{variancePercent.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildChildHoverData(child, childBudget, childSpending, percentOfMonthElapsed) {
  const conversions = { daily: 30.44, weekly: 4.35, monthly: 1, yearly: 1 / 12 };
  const convertAmount = (amount, fromCadence) => amount * (conversions[fromCadence] || 1);
  const budgetAmount = childBudget ? convertAmount(childBudget.allocated_amount, childBudget.cadence) : 0;
  const isRollover = childBudget?.rollover_enabled;
  const rollover = childBudget?.accumulated_rollover || 0;
  const effectiveBudget = isRollover ? budgetAmount + rollover : budgetAmount;
  const spent = childSpending?.[child.id] || 0;
  const remaining = effectiveBudget - spent;
  const percentUsed = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0;
  const expectedSpending = (effectiveBudget * percentOfMonthElapsed) / 100;
  const isOverPace = spent > expectedSpending && Math.abs(spent - expectedSpending) > (budgetAmount * 0.05);
  return {
    id: child.id, name: child.display_name, icon: child.icon, color: child.color,
    spent, effectiveBudget, remaining, expectedSpending,
    spendingPace: spent - expectedSpending, isOverPace,
    isOverBudget: percentUsed > 100, percentUsed, isRollover, rollover,
  };
}

function ChildBudgetBar({ child, childBudget, childSpending, percentOfMonthElapsed }) {
  const conversions = { daily: 30.44, weekly: 4.35, monthly: 1, yearly: 1 / 12 };
  const convertAmount = (amount, fromCadence) => amount * (conversions[fromCadence] || 1);
  const ChildIcon = child.icon && Icons[child.icon] ? Icons[child.icon] : Circle;
  const iconColor = child.color || '#94a3b8';
  const budgetAmount = childBudget ? convertAmount(childBudget.allocated_amount, childBudget.cadence) : 0;
  const isRollover = childBudget?.rollover_enabled;
  const rollover = childBudget?.accumulated_rollover || 0;
  const effectiveBudget = isRollover ? budgetAmount + rollover : budgetAmount;
  const spent = childSpending?.[child.id] || 0;
  const remaining = effectiveBudget - spent;
  const percentUsed = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0;
  const percentRemaining = Math.max(0, 100 - percentUsed);
  const isOverBudget = percentUsed > 100;
  const expectedSpending = (effectiveBudget * percentOfMonthElapsed) / 100;
  const isOverPace = spent > expectedSpending && Math.abs(spent - expectedSpending) > (budgetAmount * 0.05);

  return (
    <div className="space-y-1 relative cursor-default py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ChildIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: iconColor }} />
          <span className="text-xs font-medium text-slate-700 truncate">{child.display_name}</span>
        </div>
        <span className={`text-xs tabular-nums whitespace-nowrap flex-shrink-0 ${isOverBudget ? 'text-red-600 font-semibold' : isOverPace ? 'text-amber-600' : 'text-slate-500'}`}>
          {formatCurrency(Math.max(0, remaining))} ({percentRemaining.toFixed(0)}%) remaining
        </span>
      </div>
      <div className="relative h-2 rounded-full overflow-visible bg-slate-100">
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : isOverPace ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-blue-500 z-10"
          style={{ left: `${Math.min(percentOfMonthElapsed, 100)}%` }}
        />
      </div>
    </div>
  );
}

function ChildBudgetBars({ childAccounts, childBudgets, childSpending, percentOfMonthElapsed, onHover }) {
  const rowRefs = useRef({});

  if (!childAccounts?.length) return null;

  const childrenWithBudgets = childAccounts.filter(child =>
    childBudgets?.find(b => b.chart_account_id === child.id)
  );

  if (!childrenWithBudgets.length) return null;

  const handleMouseMove = (e) => {
    const mouseY = e.clientY;
    let closest = null;
    let closestDist = Infinity;
    for (const child of childrenWithBudgets) {
      const el = rowRefs.current[child.id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const dist = Math.abs(mouseY - midY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = child;
      }
    }
    if (closest) {
      const childBudget = childBudgets.find(b => b.chart_account_id === closest.id);
      onHover(buildChildHoverData(closest, childBudget, childSpending, percentOfMonthElapsed));
    }
  };

  return (
    <div
      className="pt-2 border-t"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover(null)}
    >
      {childrenWithBudgets.map(child => {
        const childBudget = childBudgets.find(b => b.chart_account_id === child.id);
        return (
          <div key={child.id} ref={el => rowRefs.current[child.id] = el}>
            <ChildBudgetBar
              child={child}
              childBudget={childBudget}
              childSpending={childSpending}
              percentOfMonthElapsed={percentOfMonthElapsed}
            />
          </div>
        );
      })}
    </div>
  );
}

export function BudgetPerformanceCard({ budget, currentSpending, performanceHistory, comparativeData, historicalData, childAccounts, childBudgets, childSpending, childAnalytics, compact = false, parentName = null, account = null }) {
  const [hoveredChild, setHoveredChild] = useState(null);
  const clearTimerRef = useRef(null);

  const handleChildHover = useCallback((data) => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (data) {
      setHoveredChild(data);
    } else {
      clearTimerRef.current = setTimeout(() => {
        setHoveredChild(null);
        clearTimerRef.current = null;
      }, 120);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const daysElapsed = differenceInDays(now, monthStart) + 1;
  const percentOfMonthElapsed = (daysElapsed / daysInMonth) * 100;

  const iconName = account?.icon || budget?.chartAccount?.icon;
  const iconColor = account?.color || budget?.chartAccount?.color || '#94a3b8';
  const ParentIcon = iconName && Icons[iconName] ? Icons[iconName] : Circle;

  const budgetAmount = budget?.allocated_amount || 0;
  const accumulatedRollover = budget?.accumulated_rollover || 0;
  const isRolloverEnabled = budget?.rollover_enabled || false;
  const effectiveBudget = isRolloverEnabled ? budgetAmount + accumulatedRollover : budgetAmount;

  const spent = currentSpending || 0;
  const percentUsed = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0;

  const expectedSpending = (effectiveBudget * percentOfMonthElapsed) / 100;
  const spendingPace = spent - expectedSpending;
  const isOverPace = spendingPace > 0;

  const adherenceRate = performanceHistory?.adherenceRate || 0;

  const hoveredChildAnalytics = hoveredChild?.id && childAnalytics?.[hoveredChild.id];

  const activeExpected = hoveredChild ? hoveredChild.expectedSpending : expectedSpending;
  const activeVariance = hoveredChild ? hoveredChild.spendingPace : spendingPace;
  const activeIsOverPace = hoveredChild ? hoveredChild.isOverPace : isOverPace;
  const activePerformanceHistory = hoveredChildAnalytics?.performance || performanceHistory;
  const activeComparativeData = hoveredChildAnalytics?.comparative || comparativeData;
  const activeHistoricalData = hoveredChildAnalytics?.historical || historicalData;
  const activeBudgetAmount = hoveredChild
    ? (childBudgets?.find(b => b.chart_account_id === hoveredChild.id)?.allocated_amount || 0)
    : budgetAmount;
  const activeAdherenceRate = activePerformanceHistory?.adherenceRate || 0;

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
            <div className="flex items-center gap-1.5">
              <ParentIcon className="w-4 h-4 flex-shrink-0" style={{ color: iconColor }} />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {parentName || 'Budget Progress'}
              </span>
            </div>
            <span className={`text-xs tabular-nums ${percentUsed > 100 ? 'text-red-600 font-semibold' : percentUsed > 90 ? 'text-amber-600' : 'text-slate-500'}`}>
              {formatCurrency(Math.max(0, effectiveBudget - spent))} ({Math.max(0, 100 - Math.round(percentUsed))}%) remaining
            </span>
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
          <ChildBudgetBars
            childAccounts={childAccounts}
            childBudgets={childBudgets}
            childSpending={childSpending}
            percentOfMonthElapsed={percentOfMonthElapsed}
            onHover={handleChildHover}
          />
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

        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Expected{hoveredChild ? ` · ${hoveredChild.name}` : ''}
            </p>
            <p className="text-sm font-medium">{formatCurrency(activeExpected)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Variance{hoveredChild ? ` · ${hoveredChild.name}` : ''}
            </p>
            <div className="flex items-center gap-1.5">
              <p className={`text-sm font-medium ${activeIsOverPace ? 'text-red-600' : 'text-green-600'}`}>
                {activeIsOverPace ? '+' : ''}{formatCurrency(activeVariance)}
              </p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activeIsOverPace ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {activeIsOverPace ? 'Over Pace' : 'Under Pace'}
              </span>
            </div>
          </div>
        </div>

        {activePerformanceHistory && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">
                  Historical Performance{hoveredChild ? ` · ${hoveredChild.name}` : ''}
                </span>
                <p className="text-[10px] text-muted-foreground">
                  {Math.round((activeAdherenceRate / 100) * 12)} of 12 months under budget
                </p>
              </div>
              <Badge variant={activeAdherenceRate >= 75 ? 'default' : activeAdherenceRate >= 50 ? 'secondary' : 'destructive'}>
                {activeAdherenceRate.toFixed(0)}%
              </Badge>
            </div>
            <Progress value={activeAdherenceRate} className="h-2 mt-2" />
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

        {!compact && (
          <div>
            {hoveredChild && (
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide pb-1">
                Showing data for {hoveredChild.name}
              </p>
            )}
            <ComparisonSection comparativeData={activeComparativeData} historicalData={activeHistoricalData} />
          </div>
        )}

        {!compact && activeBudgetAmount > 0 && activeHistoricalData?.summary && (
          <div className="pt-3 border-t">
            <BudgetRecommendation
              budgetAmount={activeBudgetAmount}
              historicalData={activeHistoricalData}
              comparativeData={activeComparativeData}
            />
          </div>
        )}
      </ContentWrapper>
    </Wrapper>
  );
}
