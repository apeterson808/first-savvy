import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  ArrowUp,
  Plus,
  Settings,
  TrendingUp,
  DollarSign,
  Calendar,
  Gift,
  CheckCircle,
  AlertCircle,
  Lock,
  Unlock,
  ArrowUpDown
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/pages/utils';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';
import { useBudgetData } from '@/hooks/useBudgetData';
import { convertCadence } from '@/utils/cadenceUtils';
import RecentTransactionsCard from './RecentTransactionsCard';
import AnimatedProgressBar from './AnimatedProgressBar';

export default function ParentViewOfChildDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeProfile } = useProfile();
  const [chartView, setChartView] = useState('spending');
  const [timeRange, setTimeRange] = useState('30d');

  const childProfileId = activeProfile?.child_profile_id;

  const { data: childProfile } = useQuery({
    queryKey: ['child-profile', childProfileId],
    queryFn: async () => {
      const { data } = await firstsavvy
        .from('child_profiles')
        .select('*')
        .eq('id', childProfileId)
        .single();
      return data;
    },
    enabled: !!childProfileId
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', 'posted', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Transaction.filter({ status: 'posted' }, '-date,id', 10000),
    enabled: !!activeProfile?.id,
    staleTime: 30000
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts.filter(acc => acc.class === 'asset' && acc.is_active);
    },
    enabled: !!activeProfile?.id
  });

  const { data: liabilities = [] } = useQuery({
    queryKey: ['liabilities', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts.filter(acc => acc.class === 'liability' && acc.is_active);
    },
    enabled: !!activeProfile?.id
  });

  const { data: chores = [] } = useQuery({
    queryKey: ['chores', childProfileId],
    queryFn: async () => {
      const { data } = await firstsavvy
        .from('chores')
        .select('*')
        .eq('child_profile_id', childProfileId)
        .order('due_date', { ascending: true });
      return data || [];
    },
    enabled: !!childProfileId
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['rewards', childProfileId],
    queryFn: async () => {
      const { data } = await firstsavvy
        .from('rewards')
        .select('*')
        .eq('child_profile_id', childProfileId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!childProfileId
  });

  const { budgets: budgetData, spendingWithChildren } = useBudgetData();

  const totalAssets = assets.reduce((sum, asset) => sum + (asset.current_balance || 0), 0);
  const totalLiabilities = liabilities.reduce((sum, liability) => sum + (liability.current_balance || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  const pendingChores = chores.filter(c => c.status === 'assigned');
  const completedChores = chores.filter(c => c.status === 'completed');

  const thisMonthExpenses = transactions
    .filter(t => {
      const tDate = new Date(t.date);
      const monthStart = startOfMonth(new Date());
      return t.type === 'expense' && tDate >= monthStart;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const categorySpending = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const category = t.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + Math.abs(t.amount);
      return acc;
    }, {});

  const spendingByCategory = Object.entries(categorySpending)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const budgetUtilization = budgetData
    .filter(b => b.chartAccount?.class === 'expense')
    .map(budget => {
      const categoryData = budget.chartAccount;
      const budgetedAmount = convertCadence(
        parseFloat(budget.allocated_amount || 0),
        budget.cadence || 'monthly',
        'monthly'
      );
      const spent = spendingWithChildren(budget.chart_account_id);
      const percentage = budgetedAmount > 0 ? (spent / budgetedAmount) * 100 : 0;

      const isOverBudget = percentage >= 100;
      const isNearLimit = percentage >= 75 && percentage < 100;

      let progressColor, bgColor;
      if (isOverBudget) {
        progressColor = 'rgba(254, 202, 202, 0.85)';
        bgColor = '#f8fafc';
      } else if (isNearLimit) {
        progressColor = 'rgba(254, 243, 199, 0.85)';
        bgColor = '#f8fafc';
      } else {
        progressColor = 'rgba(220, 252, 231, 0.85)';
        bgColor = '#f8fafc';
      }

      return {
        categoryName: categoryData?.display_name || 'Unknown',
        icon: categoryData?.icon || 'Circle',
        spent,
        limit: budgetedAmount,
        percentage,
        progressColor,
        bgColor
      };
    })
    .filter(item => item.limit > 0)
    .sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{activeProfile?.display_name}'s Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">Parent View - Full Access</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(createPageUrl('Children') + `/${childProfileId}`)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Manage Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-3 px-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Cash Balance</p>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold text-slate-900">${(childProfile?.cash_balance || 0).toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">Available to spend</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-3 px-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Points Balance</p>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold text-amber-600">{childProfile?.points_balance || 0}</p>
            <p className="text-xs text-slate-500 mt-1">Earned points</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-3 px-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">This Month</p>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold text-slate-900">${thisMonthExpenses.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">Total spending</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-3 px-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Chores</p>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-2xl font-bold text-slate-900">{completedChores.length}/{chores.length}</p>
            <p className="text-xs text-slate-500 mt-1">Completed this period</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Spending Limits</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <Settings className="w-3 h-3 mr-1" />
                  Adjust
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                {childProfile?.daily_spending_limit && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Daily Limit</p>
                      <p className="text-xs text-slate-600">Resets each day</p>
                    </div>
                    <p className="text-lg font-bold text-sky-blue">${childProfile.daily_spending_limit.toFixed(2)}</p>
                  </div>
                )}
                {childProfile?.weekly_spending_limit && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Weekly Limit</p>
                      <p className="text-xs text-slate-600">Resets each week</p>
                    </div>
                    <p className="text-lg font-bold text-sky-blue">${childProfile.weekly_spending_limit.toFixed(2)}</p>
                  </div>
                )}
                {childProfile?.monthly_spending_limit && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Monthly Limit</p>
                      <p className="text-xs text-slate-600">Resets each month</p>
                    </div>
                    <p className="text-lg font-bold text-sky-blue">${childProfile.monthly_spending_limit.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {spendingByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={spendingByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {spendingByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-slate-500">
                  No spending data yet
                </div>
              )}
            </CardContent>
          </Card>

          <RecentTransactionsCard />
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Permission Level</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary" className="text-xs">
                  Level {childProfile?.current_permission_level || 1}
                </Badge>
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  Change
                </Button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {childProfile?.current_permission_level === 1 && 'Basic access - Dashboard only'}
                {childProfile?.current_permission_level === 2 && 'Rewards access - Can view and redeem rewards'}
                {childProfile?.current_permission_level === 3 && 'Money management - Can view accounts and budgets'}
                {childProfile?.current_permission_level === 4 && 'Advanced - Calendar and goals access'}
                {childProfile?.current_permission_level === 5 && 'Full access - All features enabled'}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Pending Chores</CardTitle>
              <Badge variant="outline" className="text-xs">{pendingChores.length}</Badge>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {pendingChores.length > 0 ? (
                <div className="space-y-2">
                  {pendingChores.slice(0, 5).map((chore) => (
                    <div key={chore.id} className="flex items-start justify-between p-2 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{chore.title}</p>
                        <p className="text-xs text-slate-600">
                          {chore.points_reward ? `${chore.points_reward} points` : ''}
                          {chore.points_reward && chore.cash_reward ? ' + ' : ''}
                          {chore.cash_reward ? `$${chore.cash_reward.toFixed(2)}` : ''}
                        </p>
                      </div>
                      {chore.due_date && (
                        <p className="text-xs text-slate-500">
                          {format(new Date(chore.due_date), 'MMM d')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No pending chores</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Transfer Money
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Chore
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Gift className="w-4 h-4 mr-2" />
                  Add Reward
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
