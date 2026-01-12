import React, { useState, useEffect } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AccountDropdown from '../components/common/AccountDropdown';
import TimeRangeDropdown from '../components/common/TimeRangeDropdown';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUp, Plus, Upload, Target, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, endOfDay, addDays, startOfYear, subDays, startOfQuarter, endOfQuarter, subQuarters, subYears, startOfYear as getStartOfYear } from 'date-fns';
import CreditScoreCard from '../components/dashboard/CreditScoreCard';
import RecentTransactionsCard from '../components/dashboard/RecentTransactionsCard';
import AccountCreationWizard from '../components/banking/AccountCreationWizard';
import ProfileSetupDialog from '../components/onboarding/ProfileSetupDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts, getDisplayName } from '@/api/chartOfAccounts';
import { useBudgetData } from '@/hooks/useBudgetData';
import { convertCadence } from '@/utils/cadenceUtils';

function lightenColor(hex, percent = 80) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) + Math.round((255 - (num >> 16)) * (percent / 100));
  const g = ((num >> 8) & 0x00FF) + Math.round((255 - ((num >> 8) & 0x00FF)) * (percent / 100));
  const b = (num & 0x0000FF) + Math.round((255 - (num & 0x0000FF)) * (percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [chartView, setChartView] = useState('spending');
  const [timeRange, setTimeRange] = useState('ytd');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [userProfileData, setUserProfileData] = useState(null);

  const { budgets: budgetData, spendingByCategory } = useBudgetData();

  const handleChartPointClick = (data) => {
    if (chartView === 'spending' && data?.fullDate) {
      const clickedDate = format(data.fullDate, 'yyyy-MM-dd');
      navigate(`${createPageUrl('Banking')}?tab=transactions&date=${clickedDate}&account=${selectedAccount}`);
    }
  };

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', 'posted', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Transaction.filter({ status: 'posted' }, '-date,id', 10000),
    enabled: !!activeProfile?.id,
    staleTime: 30000
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts.filter(acc => acc.class === 'asset' && acc.is_active);
    },
    enabled: !!activeProfile?.id
  });

  const { data: liabilities = [] } = useQuery({
    queryKey: ['liabilities'],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts.filter(acc => acc.class === 'liability' && acc.is_active);
    },
    enabled: !!activeProfile?.id
  });

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts', activeProfile?.id],
    queryFn: async () => {
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts.filter(a => a.level === 3);
    },
    enabled: !!activeProfile?.id,
    staleTime: 30000,
    refetchOnMount: true
  });

  const latestCreditScore = null;
  const getChartAccountById = (id) => chartAccounts.find(c => c.id === id);

  const bankAccounts = [
    ...assets.filter(acc => ['checking_account', 'savings_account'].includes(acc.account_detail)),
    ...liabilities.filter(acc => acc.account_type === 'credit_cards')
  ];

  useEffect(() => {
    const checkProfileSetup = async () => {
      if (!user?.id || !activeProfile) return;

      const hasShownDialog = sessionStorage.getItem('profileSetupShown');
      if (hasShownDialog) return;

      try {
        const { data: userProfile } = await firstsavvy
          .from('user_settings')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const shouldShowDialog =
          !userProfile?.full_name ||
          userProfile.full_name === '' ||
          (activeProfile?.display_name === 'Personal' && !userProfile?.full_name);

        if (shouldShowDialog) {
          setUserProfileData(userProfile);
          setProfileSetupOpen(true);
          sessionStorage.setItem('profileSetupShown', 'true');
        }
      } catch (error) {
        console.error('Error checking profile setup:', error);
      }
    };

    checkProfileSetup();
  }, [user, activeProfile]);

  useEffect(() => {
    const handleProfileSwitch = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener('profileSwitched', handleProfileSwitch);
    return () => window.removeEventListener('profileSwitched', handleProfileSwitch);
  }, [queryClient]);

  // Calculate net worth (only active accounts)
  // Assets - Liabilities (liabilities stored as positive = amount owed)
  const totalAssets = assets.filter(a => a.is_active !== false).reduce((sum, asset) => sum + (asset.current_balance || 0), 0);
  const totalLiabilities = liabilities.filter(l => l.is_active !== false).reduce((sum, liability) => sum + (liability.current_balance || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Calculate net worth change from last month
  const calculateNetWorthChange = () => {
    const today = new Date();
    const lastMonth = subMonths(today, 1);
    const lastMonthEnd = endOfMonth(lastMonth);
    const lastMonthEndStr = format(lastMonthEnd, 'yyyy-MM-dd');
    
    // Get all transactions up to end of last month
    const transactionsUpToLastMonth = transactions.filter(t =>
      t.date <= lastMonthEndStr
    );
    
    // Calculate net worth at end of last month
    // Start with current balances and subtract this month's changes
    const thisMonthStart = startOfMonth(today);
    const thisMonthStartStr = format(thisMonthStart, 'yyyy-MM-dd');
    
    const thisMonthTransactions = transactions.filter(t =>
      t.date >= thisMonthStartStr
    );
    
    let lastMonthNetWorth = netWorth;
    thisMonthTransactions.forEach(t => {
      if (t.type === 'income') {
        lastMonthNetWorth -= t.amount;
      } else if (t.type === 'expense') {
        lastMonthNetWorth += t.amount;
      }
    });
    
    const change = netWorth - lastMonthNetWorth;
    const percentChange = lastMonthNetWorth !== 0 ? (change / Math.abs(lastMonthNetWorth)) * 100 : 0;
    
    return {
      change,
      percentChange,
      hasData: lastMonthNetWorth !== 0 || netWorth !== 0
    };
  };

  const netWorthChange = calculateNetWorthChange();

  const getTimeRangeConfig = (timeRange) => {
    const today = new Date();

    switch (timeRange) {
      case '7d':
        return { startDate: subDays(today, 7), monthsToShow: 1 };
      case '30d':
        return { startDate: subDays(today, 30), monthsToShow: 1 };
      case '90d':
        return { startDate: subDays(today, 90), monthsToShow: 3 };
      case 'mtd':
        return { startDate: startOfMonth(today), monthsToShow: 1 };
      case 'qtd':
        return { startDate: startOfQuarter(today), monthsToShow: (today.getMonth() % 3) + 1 };
      case 'lastQuarter': {
        const lastQ = subQuarters(today, 1);
        return { startDate: startOfQuarter(lastQ), monthsToShow: 3 };
      }
      case 'ytd':
        return { startDate: startOfYear(today), monthsToShow: today.getMonth() + 1 };
      case 'lastYear': {
        const lastYearDate = subYears(today, 1);
        return { startDate: getStartOfYear(lastYearDate), monthsToShow: 12 };
      }
      case 'all':
        return { startDate: null, monthsToShow: null };
      default:
        return { startDate: addDays(subMonths(today, parseInt(timeRange)), 1), monthsToShow: parseInt(timeRange) };
    }
  };

  // Generate chart data
    const generateChartData = () => {
      const data = [];
      const today = new Date();

      if (chartView === 'spending') {
        // Generate daily cumulative data for spending
        let cumulativeSpending = 0;
        const { startDate } = getTimeRangeConfig(timeRange);

        const finalStartDate = timeRange === 'all'
          ? (transactions.length > 0
              ? new Date(Math.min(...transactions.map(t => new Date(t.date).getTime())))
              : subMonths(today, 12))
          : startDate;

        const days = eachDayOfInterval({ start: finalStartDate, end: today });

      // Get active account IDs for filtering
      const activeAccountIds = bankAccounts.map(a => a.id);
      
      days.forEach(currentDayDate => {
        const dayStart = startOfDay(currentDayDate);
        const dayEnd = endOfDay(currentDayDate);

        const dayTransactions = transactions.filter(t => {
          if (!t.date || isNaN(new Date(t.date).getTime())) return false;
          const transactionDateStr = t.date.substring(0, 10);
          const currentDayStr = format(currentDayDate, 'yyyy-MM-dd');
          const matchesAccount = selectedAccount === 'all'
            ? activeAccountIds.includes(t.bank_account_id)
            : t.bank_account_id === selectedAccount;
          const isTransfer = t.type === 'transfer';
          return transactionDateStr === currentDayStr && t.type === 'expense' && matchesAccount && !isTransfer;
        });

        const dailySpending = dayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

        cumulativeSpending += dailySpending;

        const isFirstDayOfMonth = currentDayDate.getDate() === 1;
        data.push({
          date: isFirstDayOfMonth ? format(currentDayDate, 'MMM') : format(currentDayDate, 'MMM dd'),
          fullDate: currentDayDate,
          spending: cumulativeSpending,
          dailySpending: dailySpending,
          income: 0,
          balance: 0
        });
      });
    } else {
      // Monthly aggregation for income and balance views
      const { monthsToShow } = getTimeRangeConfig(timeRange);

      const finalMonthsToShow = timeRange === 'all'
        ? (transactions.length > 0
            ? Math.ceil((today - new Date(Math.min(...transactions.map(t => new Date(t.date).getTime())))) / (1000 * 60 * 60 * 24 * 30))
            : 12)
        : monthsToShow;

      for (let i = finalMonthsToShow - 1; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const monthStartStr = format(startOfMonth(date), 'yyyy-MM-dd');
        const monthEndStr = i === 0 ? format(today, 'yyyy-MM-dd') : format(endOfMonth(date), 'yyyy-MM-dd');

        // Get active account IDs for filtering
        const activeAccountIds = bankAccounts.map(a => a.id);
        
        const monthTransactions = transactions.filter(t => {
          if (!t.date || isNaN(new Date(t.date).getTime())) return false;
          const tDateStr = t.date.substring(0, 10);
          const matchesAccount = selectedAccount === 'all'
            ? activeAccountIds.includes(t.bank_account_id)
            : t.bank_account_id === selectedAccount;
          const isTransfer = t.type === 'transfer';
          return tDateStr >= monthStartStr && tDateStr <= monthEndStr && matchesAccount && !isTransfer;
        });

        const spending = monthTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const income = monthTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);

        data.push({
          date: format(date, 'MMM'),
          spending,
          income,
          balance: income - spending
        });
      }
    }
    
    return data;
  };

  const chartData = generateChartData();

  const budgetUtilization = budgetData
    .filter(b => b.chartAccount?.class === 'expense')
    .map(budget => {
      const categoryData = budget.chartAccount;
      const budgetedAmount = convertCadence(
        parseFloat(budget.allocated_amount || 0),
        budget.cadence || 'monthly',
        'monthly'
      );
      const spent = spendingByCategory[budget.category_account_id] || 0;
      const percentage = budgetedAmount > 0 ? (spent / budgetedAmount) * 100 : 0;

      const isOverBudget = spent > budgetedAmount;
      const isNearLimit = percentage >= 80 && percentage < 100;

      const categoryColor = categoryData?.color || '#64748b';
      let progressColor = categoryColor;
      let bgColor = lightenColor(categoryColor, 85);

      if (isOverBudget) {
        progressColor = '#ef4444';
        bgColor = '#fee2e2';
      } else if (isNearLimit) {
        progressColor = '#f59e0b';
        bgColor = '#fef3c7';
      }

      return {
        categoryName: categoryData?.display_name || 'Unknown',
        icon: categoryData?.icon || 'Circle',
        spent,
        limit: budgetedAmount,
        percentage,
        categoryColor,
        progressColor,
        bgColor
      };
    })
    .filter(item => item.limit > 0)
    .sort((a, b) => b.percentage - a.percentage);



  const upcomingBills = [];

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Column - Chart & Transactions */}
        <div className="flex-[2] space-y-4">
          {/* Main Chart Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-1 pt-3 px-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-center gap-4">
                  <Tabs value={chartView} onValueChange={setChartView}>
                    <TabsList className="h-8">
                      <TabsTrigger value="spending" className="text-xs px-3">Spending</TabsTrigger>
                      <TabsTrigger value="income" className="text-xs px-3">Money In/Out</TabsTrigger>
                      <TabsTrigger value="balance" className="text-xs px-3">Cash Balance</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {chartView === 'income' && (
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-soft-green"></div>
                        <span className="text-slate-600">In</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-orange"></div>
                        <span className="text-slate-600">Out</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <AccountDropdown
                    value={selectedAccount}
                    onValueChange={setSelectedAccount}
                    triggerClassName="w-44 h-8 text-xs hover:bg-slate-50"
                  />
                  <TimeRangeDropdown value={timeRange} onValueChange={setTimeRange} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-1">
              <ResponsiveContainer width="100%" height={180}>
                {chartView === 'income' ? (
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 30, bottom: 5 }} barGap={0} barCategoryGap="60%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={45} tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`} orientation="right" axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      formatter={(value) => `$${value.toFixed(2)}`}
                      itemSorter={(item) => item.dataKey === 'income' ? -1 : 1}
                    />
                    <Bar dataKey="spending" fill="hsl(var(--orange))" name="Money Out" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="income" fill="hsl(var(--soft-green))" name="Money In" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart 
                    data={chartData} 
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--sky-blue))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--sky-blue))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748b" 
                      tick={{ fontSize: 11 }} 
                      axisLine={false} 
                      tickLine={false}
                      ticks={chartView === 'spending' ? chartData.filter((d, i) => d.fullDate && d.fullDate.getDate() === 1).map(d => d.date) : undefined}
                      padding={{ left: 10, right: 10 }}
                    />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={45} tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`} orientation="right" axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0]?.payload;
                        if (!data) return null;
                        
                        if (chartView === 'spending') {
                          const dateLabel = data.fullDate ? format(data.fullDate, 'MMM d') : data.date;
                          return (
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm text-xs">
                              <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="text-[10px] text-slate-400 uppercase tracking-wide">{dateLabel}</div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-wide">Cumulative</div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 mt-1">
                                <span className="font-medium text-sky-blue text-center">${data.dailySpending?.toFixed(2) || '0.00'}</span>
                                <span className="font-medium text-sky-blue text-center">${data.spending?.toFixed(2) || '0.00'}</span>
                              </div>
                            </div>
                          );
                        }
                        
                        // Default for balance view
                        return (
                          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm text-xs">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-600">{data.date}</span>
                              <span className="font-medium text-sky-blue">${data.balance?.toFixed(2) || '0.00'}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={chartView === 'spending' ? 'spending' : 'balance'}
                      stroke="hsl(var(--sky-blue))"
                      fillOpacity={1}
                      fill="url(#colorValue)"
                      activeDot={(props) => {
                        const { cx, cy, payload } = props;
                        if (cx === undefined || cy === undefined) return null;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill="hsl(var(--sky-blue))"
                            stroke="#fff"
                            strokeWidth={2}
                            style={{ cursor: chartView === 'spending' ? 'pointer' : 'default' }}
                            onClick={() => handleChartPointClick(payload)}
                          />
                        );
                      }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>

  {/* Two-column section below chart */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Recent Transactions */}
    <RecentTransactionsCard />

    {/* Top Utilized Budgets */}
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Top Utilized Budgets</p>
        <Button
          variant="link"
          className="text-xs p-0 h-auto text-sky-blue"
          onClick={() => navigate(createPageUrl('Budgeting'))}
        >
          View all
        </Button>
      </CardHeader>
      <CardContent className="pt-2">
        {budgetUtilization.length > 0 ? (
          <div className="space-y-2.5">
            {budgetUtilization.slice(0, 5).map((item, index) => {
              const IconComponent = item.icon && Icons[item.icon] ? Icons[item.icon] : Icons.Circle;
              const displayPercentage = Math.min(item.percentage, 100);

              return (
                <div key={index} className="group relative">
                  <div className="relative h-9 rounded-full overflow-hidden" style={{ backgroundColor: item.bgColor }}>
                    <div
                      className="absolute left-0 top-0 h-full transition-all duration-500 ease-out rounded-full"
                      style={{
                        width: `${displayPercentage}%`,
                        backgroundColor: item.progressColor
                      }}
                    />

                    <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <IconComponent className="w-4 h-4 flex-shrink-0" style={{ color: item.categoryColor }} />
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {item.categoryName}
                          </span>
                          <span className="text-xs text-slate-400 font-normal flex-shrink-0">
                            {item.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <span className="text-slate-900">
                            ${item.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-600">
                            ${item.limit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className="w-12 h-12 bg-light-blue/20 rounded-full flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-sky-blue" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">No Budget Yet</h3>
            <p className="text-xs text-slate-600 text-center mb-4 max-w-[200px]">
              {transactions.length > 0
                ? "Create a budget from your spending history"
                : "Start tracking your spending with a budget"
              }
            </p>
            <div className="flex flex-col gap-2 w-full">
              <Button
                onClick={() => navigate(createPageUrl('Budgeting'))}
                className="w-full h-8 text-xs bg-primary hover:bg-primary/90"
                size="sm"
              >
                <Sparkles className="w-3 h-3 mr-1.5" />
                Set Up Budget
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
  </div>

        {/* Right Column - Net Worth & Quick Actions */}
        <div className="flex flex-col gap-4 flex-1 max-w-[350px]">
          {/* Net Worth Card */}
          <Link to={createPageUrl('NetWorth')}>
            <Card className="shadow-sm border-slate-200 hover:shadow-md hover:border-sky-blue transition-all cursor-pointer group">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Net Worth</p>
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">View details →</span>
                </div>
                <CardTitle className="text-3xl font-bold">${netWorth.toLocaleString()}</CardTitle>
                {netWorthChange.hasData && (
                  <div className={`flex items-center text-sm mt-2 ${netWorthChange.change >= 0 ? 'text-soft-green' : 'text-burgundy'}`}>
                    {netWorthChange.change >= 0 ? (
                      <ArrowUp className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowUp className="w-4 h-4 mr-1 rotate-180" />
                    )}
                    <span>
                      {netWorthChange.change >= 0 ? '+' : ''}{netWorthChange.percentChange.toFixed(1)}% 
                      {netWorthChange.change >= 0 ? ' Up' : ' Down'} from last month
                    </span>
                  </div>
                )}
              </CardHeader>
            </Card>
          </Link>

          {/* Credit Score Card */}
          <CreditScoreCard creditScore={latestCreditScore} />

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-4">
            <Button
              variant="outline"
              className="w-full h-10"
              onClick={() => setWizardOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
            <Button variant="outline" className="w-full h-10">
              <Upload className="w-4 h-4 mr-2" />
              Upload Receipt
            </Button>
            <Link to={createPageUrl('Goals')}>
              <Button variant="outline" className="w-full h-10">
                <Target className="w-4 h-4 mr-2" />
                Create Goal
              </Button>
            </Link>
          </div>

        </div>
        </div>

        <AccountCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onAccountCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['assets'] });
        }}
        />

        <ProfileSetupDialog
        open={profileSetupOpen}
        onClose={() => setProfileSetupOpen(false)}
        currentFullName={userProfileData?.full_name || ''}
        currentDisplayName={activeProfile?.display_name || 'Personal'}
        />
        </div>
        );
        }