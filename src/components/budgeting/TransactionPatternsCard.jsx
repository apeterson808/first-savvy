import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Repeat } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function TransactionPatternsCard({ patterns }) {
  if (!patterns) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Transaction Patterns</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pattern data available</p>
        </CardContent>
      </Card>
    );
  }

  const { dayOfWeekPattern, topDaysOfMonth, averageFrequency } = patterns;

  const frequencyLabels = {
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    monthly: 'Monthly',
    occasional: 'Occasional'
  };

  const frequencyColors = {
    weekly: 'bg-green-500',
    biweekly: 'bg-blue-500',
    monthly: 'bg-purple-500',
    occasional: 'bg-gray-500'
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Transaction Patterns</p>
          <Badge variant="outline" className="flex items-center gap-1">
            <Repeat className="h-3 w-3" />
            {frequencyLabels[averageFrequency] || 'Unknown'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {dayOfWeekPattern?.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Day of Week Distribution</p>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekPattern}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                          <p className="font-semibold mb-1">{data.day}</p>
                          <p className="text-sm text-muted-foreground">{data.count} transactions</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground">
              Most transactions occur on <span className="font-medium">{dayOfWeekPattern[0]?.day}</span> with {dayOfWeekPattern[0]?.count} recorded transactions
            </p>
          </div>
        )}

        {topDaysOfMonth?.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Common Days of Month</p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {topDaysOfMonth.map((item) => (
                <div key={item.day} className="text-center p-2 bg-muted rounded-lg">
                  <p className="text-lg font-bold">{item.day}</p>
                  <p className="text-xs text-muted-foreground">{item.count}x</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Transactions most frequently occur around the {topDaysOfMonth[0]?.day}{getOrdinalSuffix(topDaysOfMonth[0]?.day)} of the month
            </p>
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Repeat className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium">Spending Frequency</p>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${frequencyColors[averageFrequency]}`} />
                <p className="text-sm">{frequencyLabels[averageFrequency]}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {getFrequencyDescription(averageFrequency)}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-3">Pattern Insights</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            {getPatternInsights(dayOfWeekPattern, topDaysOfMonth, averageFrequency).map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-lg">•</span>
                <p>{insight}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getOrdinalSuffix(day) {
  if (!day) return '';
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function getFrequencyDescription(frequency) {
  const descriptions = {
    weekly: 'Transactions occur approximately once per week, indicating a regular weekly expense pattern.',
    biweekly: 'Transactions occur approximately every two weeks, possibly tied to a bi-weekly payment schedule.',
    monthly: 'Transactions occur approximately once per month, suggesting a recurring monthly bill or expense.',
    occasional: 'Transactions occur irregularly without a consistent pattern, indicating ad-hoc or variable spending.'
  };
  return descriptions[frequency] || 'Frequency pattern could not be determined.';
}

function getPatternInsights(dayOfWeek, daysOfMonth, frequency) {
  const insights = [];

  if (dayOfWeek && dayOfWeek.length > 0) {
    const topDay = dayOfWeek[0];
    const isWeekend = topDay.day === 'Sat' || topDay.day === 'Sun';
    if (isWeekend) {
      insights.push(`Most spending occurs on weekends (${topDay.day}), which may indicate leisure or shopping expenses.`);
    } else {
      insights.push(`Peak spending happens on ${topDay.day}, which could be tied to your weekly routine or schedule.`);
    }
  }

  if (daysOfMonth && daysOfMonth.length > 0) {
    const topDay = daysOfMonth[0].day;
    if (topDay >= 1 && topDay <= 5) {
      insights.push('Transactions cluster at the beginning of the month, possibly due to bill payments or monthly subscriptions.');
    } else if (topDay >= 15 && topDay <= 20) {
      insights.push('Mid-month transactions suggest a bi-weekly payment cycle or mid-month bills.');
    } else if (topDay >= 25) {
      insights.push('End-of-month transactions may indicate preparing for the next month or last-minute expenses.');
    }
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    insights.push('Regular spending pattern detected. Consider setting up automatic budget allocations for predictability.');
  } else if (frequency === 'monthly') {
    insights.push('Monthly spending pattern is ideal for budgeting. Your expenses in this category are consistent and predictable.');
  } else if (frequency === 'occasional') {
    insights.push('Irregular spending pattern. Consider if this category should have a lower budget allocation or be tracked separately.');
  }

  return insights;
}
