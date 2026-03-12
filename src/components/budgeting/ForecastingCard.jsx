import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, AlertTriangle, CheckCircle, Calendar, Target } from 'lucide-react';
import { formatCurrency } from '@/components/utils/formatters';

export function ForecastingCard({ forecast, budget }) {
  if (!forecast) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Spending Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No forecast data available</p>
        </CardContent>
      </Card>
    );
  }

  const {
    spentSoFar,
    dailyAverage,
    daysElapsed,
    daysRemaining,
    projectedTotal,
    historicalAverage,
    confidence
  } = forecast;

  const budgetAmount = budget?.allocated_amount || 0;
  const projectedOverage = projectedTotal - budgetAmount;
  const isOverBudget = projectedOverage > 0;
  const confidencePercent = confidence * 100;

  const getConfidenceBadge = () => {
    if (confidencePercent < 25) return { label: 'Low Confidence', variant: 'secondary' };
    if (confidencePercent < 50) return { label: 'Medium Confidence', variant: 'default' };
    if (confidencePercent < 75) return { label: 'High Confidence', variant: 'default' };
    return { label: 'Very High Confidence', variant: 'default' };
  };

  const confidenceBadge = getConfidenceBadge();

  const recommendedBudget = Math.ceil(historicalAverage / 10) * 10;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Spending Forecast & Projections</CardTitle>
          <Badge variant={confidenceBadge.variant}>{confidenceBadge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Projected Month-End Total</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold">{formatCurrency(projectedTotal)}</p>
              {budgetAmount > 0 && (
                <Badge variant={isOverBudget ? 'destructive' : 'default'}>
                  {isOverBudget ? `+${formatCurrency(projectedOverage)}` : `-${formatCurrency(-projectedOverage)}`}
                </Badge>
              )}
            </div>
            {budgetAmount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {isOverBudget ? 'Projected to exceed budget' : 'Projected to stay under budget'}
              </p>
            )}
          </div>

          {budgetAmount > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Projected vs Budget</span>
                <span className="font-medium">{((projectedTotal / budgetAmount) * 100).toFixed(0)}%</span>
              </div>
              <Progress value={Math.min((projectedTotal / budgetAmount) * 100, 100)} className="h-2" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Spent So Far</p>
            <p className="text-lg font-semibold">{formatCurrency(spentSoFar)}</p>
            <p className="text-xs text-muted-foreground">{daysElapsed} days</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Daily Average</p>
            <p className="text-lg font-semibold">{formatCurrency(dailyAverage)}</p>
            <p className="text-xs text-muted-foreground">current pace</p>
          </div>
        </div>

        <div className="pt-4 border-t space-y-4">
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium">Forecast Method</p>
              <p className="text-xs text-muted-foreground">
                Based on your current daily spending rate of {formatCurrency(dailyAverage)} over {daysElapsed} days.
                With {daysRemaining} days remaining, you're projected to spend an additional {formatCurrency(dailyAverage * daysRemaining)}.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Calendar className="h-5 w-5 text-purple-600 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium">Historical Comparison</p>
              <p className="text-xs text-muted-foreground">
                Your 3-month average for this category is {formatCurrency(historicalAverage)}.
                Current projection is {projectedTotal > historicalAverage ? 'higher' : 'lower'} than your typical spending.
              </p>
            </div>
          </div>
        </div>

        {budgetAmount > 0 && (
          <div className="pt-4 border-t space-y-3">
            <p className="text-sm font-medium">Budget Recommendations</p>

            {isOverBudget ? (
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    Action Needed
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    To stay within your {formatCurrency(budgetAmount)} budget, reduce daily spending to {formatCurrency((budgetAmount - spentSoFar) / daysRemaining)} or less for the remaining {daysRemaining} days.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    On Track
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    You can spend up to {formatCurrency((budgetAmount - spentSoFar) / daysRemaining)} per day for the remaining {daysRemaining} days and stay within budget.
                  </p>
                </div>
              </div>
            )}

            {Math.abs(budgetAmount - recommendedBudget) > budgetAmount * 0.1 && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                <Target className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Suggested Budget Adjustment
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Based on your historical spending average of {formatCurrency(historicalAverage)},
                    consider adjusting your budget to {formatCurrency(recommendedBudget)} for better alignment.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Forecast Confidence</span>
            <span>{confidencePercent.toFixed(0)}%</span>
          </div>
          <Progress value={confidencePercent} className="h-1.5 mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Confidence increases as more of the month passes. After 50% of the month, forecasts are highly reliable.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
