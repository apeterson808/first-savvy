import React, { useState, useEffect } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Customized } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AccountDropdown from '../components/common/AccountDropdown';
import TimeRangeDropdown from '../components/common/TimeRangeDropdown';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUp, Plus, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, endOfDay, addDays, startOfYear, subDays, startOfQuarter, endOfQuarter, subQuarters, subYears, startOfYear as getStartOfYear } from 'date-fns';
import CreditScoreCard from '../components/dashboard/CreditScoreCard';
import RecentTransactionsCard from '../components/dashboard/RecentTransactionsCard';
import AnimatedProgressBar from '../components/dashboard/AnimatedProgressBar';
import FamilyConnectionsCard from '../components/dashboard/FamilyConnectionsCard';
import CalendarCard from '../components/dashboard/CalendarCard';
import AccountCreationWizard from '../components/banking/AccountCreationWizard';
import ProfileSetupDialog from '../components/onboarding/ProfileSetupDialog';
import ChildDashboard from '../components/dashboard/ChildDashboard';
import ParentViewOfChildDashboard from '../components/dashboard/ParentViewOfChildDashboard';
import RetirementSettingsModal from '../components/dashboard/RetirementSettingsModal';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getRetirementSettings } from '@/api/retirementSettings';
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

function adjustColorOpacity(hex, opacity = 0.5) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = num >> 16;
  const g = (num >> 8) & 0x00FF;
  const b = num & 0x0000FF;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeProfile, viewingChildProfile } = useProfile();
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [chartView, setChartView] = useState('networth');
  const [timeRange, setTimeRange] = useState('ytd');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [retirementModalOpen, setRetirementModalOpen] = useState(false);
  const [userProfileData, setUserProfileData] = useState(null);
  const [isLoggedInAsChild, setIsLoggedInAsChild] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState(null);
  const [retirementSettings, setRetirementSettings] = useState(null);

  const { budgets: budgetData, spendingWithChildren } = useBudgetData();

  const handleChartPointClick = (data) => {
    if ((chartView === 'spending' || chartView === 'balance') && data?.fullDate) {
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
    ...liabilities.filter(acc => acc.account_type === 'credit_card')
  ];

  useEffect(() => {
    const checkProfileSetup = async () => {
      if (!user?.id || !activeProfile) return;

      // Check if logged-in user is a child
      const { data: childProfile } = await firstsavvy
        .from('child_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setIsLoggedInAsChild(!!childProfile);

      const hasShownDialog = sessionStorage.getItem('profileSetupShown');
      if (hasShownDialog) return;

      try {
        const { data: userProfile } = await firstsavvy
          .from('user_settings')
          .select('full_name, first_name')
          .eq('id', user.id)
          .maybeSingle();

        const shouldShowDialog =
          !userProfile ||
          !userProfile.first_name ||
          userProfile.first_name === '';

        if (shouldShowDialog) {
          const authMeta = user.user_metadata || {};
          const metaFullName = authMeta.full_name || [authMeta.first_name, authMeta.last_name].filter(Boolean).join(' ');
          setUserProfileData({ ...userProfile, full_name: userProfile?.full_name || metaFullName });
          setProfileSetupOpen(true);
          sessionStorage.setItem('profileSetupShown', 'true');
        }
      } catch (error) {
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

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const { data: prof } = await firstsavvy
          .from('user_settings')
          .select('date_of_birth')
          .eq('id', user.id)
          .maybeSingle();
        if (prof?.date_of_birth) setDateOfBirth(prof.date_of_birth);
        const rs = await getRetirementSettings(user.id);
        if (rs) setRetirementSettings(rs);
      } catch { /* non-fatal */ }
    };
    load();
  }, [user?.id, retirementModalOpen]);

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

  // Average monthly savings (computed before chart data so projection can use it as default)
  const avgMonthlySavings = (() => {
    if (transactions.length === 0) return 2000;
    const recentMonths = 3;
    const cutoff = format(subMonths(new Date(), recentMonths), 'yyyy-MM-dd');
    const recent = transactions.filter(t => t.date >= cutoff);
    const income = recent.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = recent.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    return Math.max(0, Math.round((income - expenses) / recentMonths));
  })();

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
          date: format(currentDayDate, 'MMM d'),
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

      // Get active account IDs for filtering
      const activeAccountIds = bankAccounts.map(a => a.id);

      // Calculate current total balance (for cash balance chart)
      let currentBalance = 0;
      if (chartView === 'balance') {
        if (selectedAccount === 'all') {
          const cashBalanceAccounts = [...assets, ...liabilities].filter(acc =>
            acc.is_active && acc.include_in_cash_balance
          );
          currentBalance = cashBalanceAccounts.reduce((sum, acc) => {
            const balance = acc.current_balance || 0;
            if (acc.class === 'liability') {
              return sum - balance;
            }
            return sum + balance;
          }, 0);
        } else {
          const selectedAcc = bankAccounts.find(a => a.id === selectedAccount);
          if (selectedAcc) {
            currentBalance = selectedAcc.class === 'liability'
              ? -(selectedAcc.current_balance || 0)
              : (selectedAcc.current_balance || 0);
          }
        }
      }

      // Build array of monthly data
      const monthlyData = [];
      for (let i = finalMonthsToShow - 1; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const monthStartStr = format(startOfMonth(date), 'yyyy-MM-dd');
        const monthEndStr = i === 0 ? format(today, 'yyyy-MM-dd') : format(endOfMonth(date), 'yyyy-MM-dd');

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

        monthlyData.push({
          date: format(date, 'MMM'),
          spending,
          income,
          monthTransactions
        });
      }

      // For balance chart: calculate historical cash balance
      if (chartView === 'balance') {
        // Get accounts included in cash balance
        const cashBalanceAccounts = [...assets, ...liabilities].filter(acc =>
          acc.is_active && acc.include_in_cash_balance
        );
        const cashAccountIds = cashBalanceAccounts.map(a => a.id);

        // Get all transactions for cash balance accounts
        const allTransactionsForCashBalance = transactions.filter(t =>
          t.date && !isNaN(new Date(t.date).getTime()) && cashAccountIds.includes(t.bank_account_id)
        );

        const earliestTransactionDate = allTransactionsForCashBalance.length > 0
          ? new Date(Math.min(...allTransactionsForCashBalance.map(t => new Date(t.date).getTime())))
          : subMonths(today, finalMonthsToShow);

        // Calculate start date for daily data
        const finalStartDate = timeRange === 'all'
          ? earliestTransactionDate
          : subMonths(today, finalMonthsToShow);

        // Generate daily cash balance data
        const days = eachDayOfInterval({ start: finalStartDate, end: today });

        // Start with current cash balance
        const currentCashBalance = cashBalanceAccounts.reduce((sum, acc) => {
          const balance = acc.current_balance || 0;
          if (acc.class === 'liability') {
            return sum - balance;
          }
          return sum + balance;
        }, 0);

        // Calculate cash balance for each day by working backwards from today
        const dailyCashBalanceData = [];

        days.forEach(currentDayDate => {
          const currentDayStr = format(currentDayDate, 'yyyy-MM-dd');

          // Calculate cash balance at end of this day
          // Start with current cash balance and subtract all transactions after this day
          let cashBalanceAtDay = currentCashBalance;

          allTransactionsForCashBalance.forEach(t => {
            const tDateStr = t.date.substring(0, 10);
            if (tDateStr > currentDayStr) {
              // Subtract transactions that happened after this day
              if (t.type === 'income') {
                cashBalanceAtDay -= t.amount;
              } else if (t.type === 'expense') {
                cashBalanceAtDay += t.amount;
              }
            }
          });

          // Get day's transactions for display
          const dayTransactions = allTransactionsForCashBalance.filter(t => {
            const tDateStr = t.date.substring(0, 10);
            return tDateStr === currentDayStr;
          });

          const dayIncome = dayTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

          const daySpending = dayTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

          const isFirstDayOfMonth = currentDayDate.getDate() === 1;

          dailyCashBalanceData.push({
            date: format(currentDayDate, 'MMM d'),
            fullDate: currentDayDate,
            spending: daySpending,
            income: dayIncome,
            balance: cashBalanceAtDay
          });
        });

        data.push(...dailyCashBalanceData);
      } else {
        for (const monthData of monthlyData) {
          data.push({
            date: monthData.date,
            spending: monthData.spending,
            income: monthData.income,
            balance: monthData.income - monthData.spending
          });
        }
      }
    }

    if (chartView === 'networth') {
      // All accounts that affect net worth
      const allAccounts = [...assets, ...liabilities].filter(a => a.is_active);
      const allAccountIds = allAccounts.map(a => a.id);

      const networthTransactions = transactions.filter(t =>
        t.date && !isNaN(new Date(t.date).getTime()) && allAccountIds.includes(t.bank_account_id)
      );

      const { startDate } = getTimeRangeConfig(timeRange);
      const finalStartDate = timeRange === 'all'
        ? (networthTransactions.length > 0
            ? new Date(Math.min(...networthTransactions.map(t => new Date(t.date).getTime())))
            : subMonths(today, 12))
        : startDate;

      const days = eachDayOfInterval({ start: finalStartDate, end: today });

      // Start from current net worth and work backwards
      days.forEach(currentDayDate => {
        const currentDayStr = format(currentDayDate, 'yyyy-MM-dd');
        let networthAtDay = netWorth;

        networthTransactions.forEach(t => {
          const tDateStr = t.date.substring(0, 10);
          if (tDateStr > currentDayStr) {
            const acc = allAccounts.find(a => a.id === t.bank_account_id);
            if (!acc) return;
            if (acc.class === 'asset') {
              if (t.type === 'income') networthAtDay -= t.amount;
              else if (t.type === 'expense') networthAtDay += Math.abs(t.amount);
            } else if (acc.class === 'liability') {
              if (t.type === 'expense') networthAtDay -= Math.abs(t.amount);
              else if (t.type === 'income') networthAtDay += t.amount;
            }
          }
        });

        data.push({
          date: format(currentDayDate, 'MMM d'),
          fullDate: currentDayDate,
          networth: networthAtDay,
          balance: 0,
          spending: 0,
          income: 0,
        });
      });

      // --- Forward projection (always shown for net worth, uses defaults if no settings saved) ---
      if (chartView === 'networth') {
        const currentAge = dateOfBirth
          ? Math.floor((today.getTime() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
          : 35;
        const retirementAge = retirementSettings?.retirement_age ?? 65;
        const monthlyRate = (retirementSettings?.assumed_growth_rate ?? 0.07) / 12;
        const monthlySavings = retirementSettings?.monthly_savings ?? avgMonthlySavings;
        const monthlySpend = (retirementSettings?.monthly_retirement_spending ?? 5000) *
          ({ thrifty: 0.7, moderate: 1.0, spendy: 1.5 }[retirementSettings?.spending_style ?? 'moderate'] ?? 1.0);
        const endAge = 90;

        // Emit one data point per 5-year age milestone
        const ageMilestones = [];
        for (let age = Math.ceil(currentAge / 5) * 5; age <= endAge; age += 5) {
          if (age <= currentAge) continue;
          ageMilestones.push(age);
        }

        // Also emit retirement age if it falls between milestones
        if (!ageMilestones.includes(retirementAge) && retirementAge > currentAge && retirementAge <= endAge) {
          ageMilestones.push(retirementAge);
          ageMilestones.sort((a, b) => a - b);
        }

        let projectedNetWorth = netWorth;
        let currentProjectionAge = currentAge;

        // Add a "Today" bridge point (isProjection: false to connect the historical line)
        data.push({
          date: 'Today',
          fullDate: today,
          networth: netWorth,
          projected: netWorth,
          needed: null,
          isToday: true,
          isProjection: false,
          balance: 0, spending: 0, income: 0,
        });

        // Compute "needed at retirement" for the needs line
        const annualRate = retirementSettings?.assumed_growth_rate ?? 0.07;
        const retirementYears = endAge - retirementAge;
        const neededAtRetirement = retirementYears > 0
          ? monthlySpend * 12 * ((1 - Math.pow(1 + annualRate, -retirementYears)) / annualRate)
          : monthlySpend * 12 * 25;

        ageMilestones.forEach(age => {
          const yearsFromNow = age - currentAge;
          const months = yearsFromNow * 12;
          const isRetired = age > retirementAge;
          const yearsToRetirement = Math.max(0, retirementAge - currentAge);
          const retirementMonths = yearsToRetirement * 12;

          let haveVal;
          if (age <= retirementAge) {
            // Accumulation: FV of current NW + savings contributions
            haveVal = monthlyRate > 0
              ? netWorth * Math.pow(1 + monthlyRate, months) +
                monthlySavings * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
              : netWorth + monthlySavings * months;
          } else {
            // Drawdown from the value at retirement
            const atRetirement = monthlyRate > 0
              ? netWorth * Math.pow(1 + monthlyRate, retirementMonths) +
                monthlySavings * ((Math.pow(1 + monthlyRate, retirementMonths) - 1) / monthlyRate)
              : netWorth + monthlySavings * retirementMonths;
            const monthsInRetirement = (age - retirementAge) * 12;
            haveVal = monthlyRate > 0
              ? atRetirement * Math.pow(1 + monthlyRate, monthsInRetirement) -
                monthlySpend * ((Math.pow(1 + monthlyRate, monthsInRetirement) - 1) / monthlyRate)
              : atRetirement - monthlySpend * monthsInRetirement;
          }

          // Needs line: straight line from 0 at today to neededAtRetirement at retirement, then declines
          let needVal = null;
          if (age <= retirementAge) {
            needVal = yearsToRetirement > 0
              ? neededAtRetirement * (yearsFromNow / yearsToRetirement)
              : neededAtRetirement;
          } else {
            const monthsSinceRetirement = (age - retirementAge) * 12;
            const remainingYears = Math.max(0, endAge - age);
            needVal = monthlyRate > 0 && remainingYears > 0
              ? monthlySpend * 12 * ((1 - Math.pow(1 + annualRate, -remainingYears)) / annualRate)
              : monthlySpend * 12 * remainingYears;
          }

          const label = age === retirementAge ? `Retire ${age}` : `Age ${age}`;
          data.push({
            date: label,
            fullDate: null,
            networth: null,
            projected: Math.max(0, haveVal),
            needed: Math.max(0, needVal),
            isProjection: true,
            isRetirementAge: age === retirementAge,
            ageLabel: age,
            balance: 0, spending: 0, income: 0,
          });
        });
      }
    }

    return data;
  };

  const chartData = generateChartData();

  const hasProjection = chartView === 'networth' && chartData.some(d => d.isProjection);

  // X axis ticks
  const chartXTicks = (() => {
    const seen = new Set();
    const ticks = [];
    chartData.forEach(d => {
      if (d.isProjection || d.isToday) {
        ticks.push({ date: d.date, label: d.isToday ? 'Today' : d.date });
        return;
      }
      if (!d.fullDate) return;
      const key = `${d.fullDate.getFullYear()}-${d.fullDate.getMonth()}`;
      if (seen.has(key)) return;
      seen.add(key);
      ticks.push({ date: d.date, label: format(d.fullDate, 'MMM') });
    });
    return ticks;
  })();

  const makeYTicks = (values) => {
    if (values.length === 0) return [0];
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const min = rawMin >= 0 ? 0 : rawMin;
    const max = rawMax;
    if (max === min) return [0, max || 1];
    const range = max - min;
    const roughStep = range / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const niceSteps = [1, 2, 2.5, 5, 10];
    const step = niceSteps.map(s => s * magnitude).find(s => s >= roughStep) || roughStep;
    const start = Math.floor(min / step) * step;
    const ticks = [];
    for (let v = start; ticks.length < 6 && v <= max + step * 0.01; v += step) {
      ticks.push(Math.round(v));
    }
    return ticks;
  };

  // Y axis: when projection is visible, use the full range (historical + projected)
  const chartYTicks = (() => {
    let values;
    if (chartView === 'networth') {
      values = chartData.flatMap(d => [d.networth, d.projected, d.needed]).filter(v => v != null && isFinite(v));
    } else {
      const dataKey = chartView === 'spending' ? 'spending' : 'balance';
      values = chartData.map(d => d[dataKey]).filter(v => v != null && isFinite(v));
    }
    return makeYTicks(values);
  })();


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

      // Status-based pastel color scheme
      let progressColor, bgColor;

      if (isOverBudget) {
        // Very light pastel red for over budget (100%+)
        progressColor = 'rgba(254, 202, 202, 0.85)';
        bgColor = '#f8fafc';
      } else if (isNearLimit) {
        // Very light pastel amber for approaching limit (75-99%)
        progressColor = 'rgba(254, 243, 199, 0.85)';
        bgColor = '#f8fafc';
      } else {
        // Very light pastel green for on-track (0-74%)
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



  const upcomingBills = [];

  // Scenario 1: Logged-in user IS a child (Tucker logs in directly)
  // Show simplified, gamified ChildDashboard
  if (isLoggedInAsChild) {
    return <ChildDashboard />;
  }

  // Scenario 2: Parent is viewing a child profile via the selector (parent-selected mode)
  // Show simplified, gamified ChildDashboard (same as Scenario 1)
  if (viewingChildProfile && viewingChildProfile.loginType === 'parent-selected') {
    return <ChildDashboard />;
  }

  // Scenario 3: Logged-in user is NOT a child BUT is viewing a child profile tab (Andrew views Tucker's tab)
  // Show ParentViewOfChildDashboard with full controls and child's data
  if (!isLoggedInAsChild && activeProfile?.is_child_profile && !viewingChildProfile) {
    return <ParentViewOfChildDashboard />;
  }

  // Scenario 3: Logged-in user is viewing their own profile (Andrew views his own data)
  // Show regular Dashboard
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Column - Chart & Transactions */}
        <div className="flex-[2] space-y-4">
          {/* Main Chart Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-1 pt-3 px-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <Tabs value={chartView} onValueChange={setChartView}>
                  <TabsList className="h-8">
                    <TabsTrigger value="networth" className="text-xs px-3">Net Worth</TabsTrigger>
                    <TabsTrigger value="spending" className="text-xs px-3">Spending</TabsTrigger>
                    <TabsTrigger value="income" className="text-xs px-3">Money In/Out</TabsTrigger>
                    <TabsTrigger value="balance" className="text-xs px-3">Cash Balance</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                  <div style={{ width: '11rem' }} className={chartView !== 'networth' ? '' : 'invisible pointer-events-none'}>
                    <AccountDropdown
                      value={selectedAccount}
                      onValueChange={setSelectedAccount}
                      triggerClassName="w-44 h-8 text-xs hover:bg-slate-50"
                    />
                  </div>
                  <TimeRangeDropdown value={timeRange} onValueChange={setTimeRange} />
                </div>
              </div>
              {/* Fixed-height legend row — always rendered to prevent height shifts */}
              <div className="flex items-center gap-4 text-xs px-1 pb-1 h-5">
                {chartView === 'income' && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-soft-green"></div>
                      <span className="text-slate-500">Money In</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-orange"></div>
                      <span className="text-slate-500">Money Out</span>
                    </div>
                  </>
                )}
                {chartView === 'spending' && (
                  <div className="flex items-center gap-1.5">
                    <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="hsl(var(--sky-blue))" strokeWidth="2.5"/></svg>
                    <span className="text-slate-500">Cumulative spending</span>
                  </div>
                )}
                {chartView === 'balance' && (
                  <div className="flex items-center gap-1.5">
                    <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="hsl(var(--sky-blue))" strokeWidth="2.5"/></svg>
                    <span className="text-slate-500">Cash balance</span>
                  </div>
                )}
                {chartView === 'networth' && !hasProjection && (
                  <div className="flex items-center gap-1.5">
                    <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#10b981" strokeWidth="2.5"/></svg>
                    <span className="text-slate-500">Net worth</span>
                  </div>
                )}
                {chartView === 'networth' && hasProjection && (() => {
                  const retAge = retirementSettings?.retirement_age ?? 65;
                  const retirePoint = chartData.find(d => d.isRetirementAge);
                  const haveVal = retirePoint?.projected ?? 0;
                  const needVal = retirePoint?.needed ?? 0;
                  const onTrack = haveVal >= needVal;
                  const fmtV = v => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${Math.round(v)}`;
                  return (
                    <>
                      <div className="flex items-center gap-1.5">
                        <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#10b981" strokeWidth="2.5" strokeDasharray="8 4"/></svg>
                        <span className="text-slate-500">You'll have</span>
                        <span className={`font-bold ${onTrack ? 'text-emerald-600' : 'text-slate-700'}`}>{fmtV(haveVal)} at {retAge}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5 4"/></svg>
                        <span className="text-slate-500">You'll need</span>
                        <span className={`font-bold ${!onTrack ? 'text-red-500' : 'text-slate-700'}`}>{fmtV(needVal)}</span>
                      </div>
                      <span className={`text-[11px] ml-auto px-2 py-0.5 rounded-full font-medium ${onTrack ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {onTrack ? 'On track' : 'Shortfall'}
                      </span>
                    </>
                  );
                })()}
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-1">
              {hasProjection ? (() => {
                const histData = chartData.filter(d => !d.isProjection && !d.isToday);
                const projData = chartData.filter(d => d.isProjection || d.isToday);
                const retAge = retirementSettings?.retirement_age ?? 65;
                const retirePoint = chartData.find(d => d.isRetirementAge);
                const haveVal = retirePoint?.projected ?? 0;
                const needVal = retirePoint?.needed ?? 0;
                const onTrack = haveVal >= needVal;
                const fmtV = v => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${Math.round(v)}`;
                const yFmt = v => v >= 1000 || v <= -1000 ? `$${(v/1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`;
                const yDomain = [chartYTicks[0], chartYTicks[chartYTicks.length - 1]];
                const histTicks = (() => {
                  const seen = new Set();
                  return histData
                    .filter(d => {
                      if (!d.fullDate) return false;
                      const key = `${d.fullDate.getFullYear()}-${d.fullDate.getMonth()}`;
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    })
                    .map(d => d.date);
                })();
                // Only show every 10-year milestone + retirement age to avoid crowding
                const projTicks = projData
                  .filter(d => !d.isToday && (d.isRetirementAge || (d.ageLabel && d.ageLabel % 10 === 0)))
                  .map(d => d.date);
                const projTickFormatter = (val) => {
                  if (val.startsWith('Retire ')) return `Retire\n${val.split(' ')[1]}`;
                  if (val.startsWith('Age ')) return val.split(' ')[1];
                  return val;
                };

                const tooltipContent = ({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  if (d.isProjection) {
                    const fmt = v => v != null ? `$${Math.round(v).toLocaleString()}` : '—';
                    return (
                      <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-lg text-sm">
                        <div className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Projected · {d.date}</div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-slate-500 text-xs">You'll have</span>
                          <span className="font-semibold text-emerald-600 ml-auto">{fmt(d.projected)}</span>
                        </div>
                        {d.needed != null && (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span className="text-slate-500 text-xs">You'll need</span>
                            <span className="font-semibold text-slate-700 ml-auto">{fmt(d.needed)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  const dateLabel = d.fullDate ? format(d.fullDate, 'MMM d, yyyy') : d.date;
                  const nw = d.networth ?? 0;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-lg text-sm">
                      <div className="text-xs text-slate-500 mb-1">{dateLabel}</div>
                      <div className={`text-lg font-semibold ${nw >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {nw < 0 ? '-' : ''}${Math.abs(nw).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                    </div>
                  );
                };

                return (
                  <div>
                    {/* Dual chart */}
                    <div className="flex" style={{ height: 270 }}>
                      {/* History panel */}
                      <div style={{ flex: '0 0 55%' }}>
                        <ResponsiveContainer width="100%" height={270}>
                          <AreaChart data={histData} margin={{ top: 10, right: 0, left: 0, bottom: 30 }}>
                            <defs>
                              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis
                              dataKey="date"
                              stroke="#64748b"
                              tick={{ fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              ticks={histTicks}
                              interval={0}
                              tickFormatter={val => {
                                const d = histData.find(x => x.date === val);
                                return d?.fullDate ? format(d.fullDate, 'MMM') : val;
                              }}
                            />
                            <YAxis
                              width={0}
                              ticks={chartYTicks}
                              domain={yDomain}
                              tickFormatter={() => ''}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              position={{ y: 0 }}
                              offset={20}
                              cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '3 3' }}
                              wrapperStyle={{ pointerEvents: 'none' }}
                              content={tooltipContent}
                            />
                            <Area
                              type="monotone"
                              dataKey="networth"
                              stroke="#10b981"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#histGrad)"
                              connectNulls={false}
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Today divider */}
                      <div className="relative flex flex-col items-center shrink-0" style={{ width: 1, marginBottom: 30, marginTop: 10 }}>
                        <div className="absolute inset-0" style={{ borderLeft: '2px dashed #cbd5e1' }} />
                        <div className="absolute bottom-0 translate-y-full pt-1 text-[10px] font-medium text-slate-500 whitespace-nowrap" style={{ transform: 'translateX(-50%) translateY(6px)' }}>
                          Today
                        </div>
                      </div>
                      {/* Projection panel */}
                      <div style={{ flex: '0 0 45%' }} className="relative">
                        <ResponsiveContainer width="100%" height={270}>
                          <AreaChart data={projData} margin={{ top: 10, right: 4, left: 0, bottom: 30 }}>
                            <defs>
                              <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis
                              dataKey="date"
                              stroke="#64748b"
                              tick={{ fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              ticks={projTicks}
                              interval={0}
                              tickFormatter={projTickFormatter}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              width={38}
                              ticks={chartYTicks}
                              domain={yDomain}
                              tickFormatter={yFmt}
                              axisLine={false}
                              tickLine={false}
                              orientation="right"
                            />
                            <ReferenceLine
                              x={`Retire ${retAge}`}
                              stroke="#10b981"
                              strokeDasharray="4 3"
                              strokeWidth={1.5}
                            />
                            <Customized component={({ xAxisMap }) => {
                              const xAxis = xAxisMap && Object.values(xAxisMap)[0];
                              if (!xAxis?.scale) return null;
                              const bw = xAxis.scale.bandwidth ? xAxis.scale.bandwidth() / 2 : 0;
                              const retLabel = `Retire ${retAge}`;
                              const xPos = xAxis.scale(retLabel);
                              if (xPos == null) return null;
                              const cx = xPos + bw;
                              const active = !!retirementSettings;
                              const color = active ? '#10b981' : '#94a3b8';
                              const borderColor = active ? '#10b981' : '#cbd5e1';
                              const bg = active ? '#f0fdf4' : '#f8fafc';
                              return (
                                <g
                                  transform={`translate(${cx}, 18)`}
                                  onClick={() => setRetirementModalOpen(true)}
                                  style={{ cursor: 'pointer' }}
                                  role="button"
                                  aria-label="Retirement projection settings"
                                >
                                  <circle r={15} fill={bg} stroke={borderColor} strokeWidth={1.5} />
                                  <g transform="translate(-9,-9)" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/>
                                    <path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>
                                  </g>
                                </g>
                              );
                            }} />
                            <Tooltip
                              position={{ y: 0 }}
                              offset={20}
                              cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '3 3' }}
                              wrapperStyle={{ pointerEvents: 'none' }}
                              content={tooltipContent}
                            />
                            <Area
                              type="monotone"
                              dataKey="projected"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              strokeDasharray="8 4"
                              fillOpacity={1}
                              fill="url(#projGrad)"
                              connectNulls={true}
                              dot={false}
                              activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="needed"
                              stroke="#94a3b8"
                              strokeWidth={1.5}
                              strokeDasharray="5 4"
                              fill="none"
                              fillOpacity={0}
                              connectNulls={true}
                              dot={false}
                              activeDot={{ r: 4, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                );
              })() : (
              <ResponsiveContainer width="100%" height={270}>
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
                        <stop offset="5%" stopColor={chartView === 'networth' ? '#10b981' : 'hsl(var(--sky-blue))'} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={chartView === 'networth' ? '#10b981' : 'hsl(var(--sky-blue))'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      ticks={(chartView === 'spending' || chartView === 'balance' || chartView === 'networth') ? chartXTicks.map(t => t.date) : undefined}
                      interval='preserveStartEnd'
                      tickFormatter={(val) => {
                        const found = chartXTicks.find(t => t.date === val);
                        return found ? found.label : val;
                      }}
                      padding={{ left: 10, right: 10 }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fontSize: 11 }}
                      width={50}
                      ticks={(chartView === 'spending' || chartView === 'balance' || chartView === 'networth') ? chartYTicks : undefined}
                      tickFormatter={(value) => value >= 1000 || value <= -1000 ? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `$${value}`}
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                    />
                    {chartView === 'networth' && (
                      <Customized component={({ xAxisMap }) => {
                        const xAxis = xAxisMap && Object.values(xAxisMap)[0];
                        if (!xAxis?.scale) return null;
                        const bw = xAxis.scale.bandwidth ? xAxis.scale.bandwidth() / 2 : 0;
                        const lastPoint = chartData[chartData.length - 1];
                        if (!lastPoint) return null;
                        const xPos = xAxis.scale(lastPoint.date);
                        if (xPos == null) return null;
                        const active = !!retirementSettings;
                        const color = active ? '#10b981' : '#94a3b8';
                        const borderColor = active ? '#10b981' : '#cbd5e1';
                        const bg = active ? '#f0fdf4' : '#f8fafc';
                        return (
                          <g
                            transform={`translate(${xPos + bw - 18}, 16)`}
                            onClick={() => setRetirementModalOpen(true)}
                            style={{ cursor: 'pointer' }}
                            role="button"
                            aria-label="Retirement projection settings"
                          >
                            <circle r={15} fill={bg} stroke={borderColor} strokeWidth={1.5} />
                            <g transform="translate(-9,-9)" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/>
                              <path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>
                            </g>
                          </g>
                        );
                      }} />
                    )}
                    <Tooltip
                      position={{ y: 0 }}
                      offset={20}
                      cursor={{ stroke: 'hsl(var(--sky-blue))', strokeWidth: 1, strokeDasharray: '3 3' }}
                      wrapperStyle={{ pointerEvents: 'none' }}
                      contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0]?.payload;
                        if (!data) return null;

                        if (chartView === 'spending') {
                          const dateLabel = data.fullDate ? format(data.fullDate, 'MMM d') : data.date;
                          return (
                            <div className="bg-white/95 backdrop-blur-sm p-2 rounded-lg border border-slate-200 shadow-lg text-xs">
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

                        if (chartView === 'networth') {
                          const dateLabel = data.fullDate ? format(data.fullDate, 'MMM d, yyyy') : data.date;
                          const nw = data.networth ?? 0;
                          return (
                            <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-lg text-sm">
                              <div className="text-xs text-slate-500 mb-1">{dateLabel}</div>
                              <div className={`text-lg font-semibold ${nw >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {nw < 0 ? '-' : ''}${Math.abs(nw).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </div>
                            </div>
                          );
                        }

                        if (chartView === 'balance') {
                          const dateLabel = data.fullDate ? format(data.fullDate, 'MMM d, yyyy') : data.date;
                          return (
                            <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-lg text-sm">
                              <div className="text-xs text-slate-500 mb-1">{dateLabel}</div>
                              <div className="text-lg font-semibold text-sky-blue">${data.balance?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</div>
                            </div>
                          );
                        }

                        return (
                          <div className="bg-white/95 backdrop-blur-sm p-2 rounded-lg border border-slate-200 shadow-lg text-xs">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{data.date}</div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-600">Net Flow</span>
                              <span className="font-medium text-sky-blue">${data.balance?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-[10px] border-t border-slate-100 pt-1 mt-1">
                              <span className="text-slate-500">Income</span>
                              <span className="text-soft-green">${data.income?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-[10px]">
                              <span className="text-slate-500">Spending</span>
                              <span className="text-orange">${data.spending?.toFixed(2) || '0.00'}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={chartView === 'networth' ? 'networth' : chartView === 'spending' ? 'spending' : 'balance'}
                      stroke={chartView === 'networth' ? '#10b981' : 'hsl(var(--sky-blue))'}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                      connectNulls={false}
                      activeDot={(props) => {
                        const { cx, cy, payload } = props;
                        if (cx === undefined || cy === undefined) return null;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill={chartView === 'networth' ? '#10b981' : 'hsl(var(--sky-blue))'}
                            stroke="#fff"
                            strokeWidth={2}
                            style={{ cursor: (chartView === 'spending' || chartView === 'balance') ? 'pointer' : 'default' }}
                            onClick={() => handleChartPointClick(payload)}
                          />
                        );
                      }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

  {/* Family card — mobile only */}
  <div className="lg:hidden">
    <FamilyConnectionsCard />
  </div>

  {/* Two-column section below chart */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Recent Transactions */}
    <RecentTransactionsCard />

    {/* Top Utilized Budgets */}
    <Card className="shadow-sm border-slate-200 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 shrink-0">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Top Utilized Budgets</p>
        <Button
          variant="link"
          className="text-xs p-0 h-auto text-sky-blue"
          onClick={() => navigate(createPageUrl('Budgeting'))}
        >
          View all
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 overflow-hidden">
        {budgetUtilization.length > 0 ? (
          <div className="space-y-2 h-full overflow-y-auto">
            {budgetUtilization.slice(0, 7).map((item, index) => (
              <AnimatedProgressBar key={index} item={item} />
            ))}
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

        {/* Right Column - Net Worth, Credit Score, Family, Calendar */}
        <div className="flex flex-col gap-4 flex-1 max-w-[350px]">
          {/* Net Worth Card */}
          <Link to={createPageUrl('NetWorth')}>
            <Card className="shadow-sm border-slate-200 hover:shadow-md hover:border-sky-blue transition-all cursor-pointer group">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Net Worth</p>
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">View details →</span>
                </div>
                <CardTitle className="text-3xl font-bold">${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
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

          {/* Family Connections Card — hidden on mobile, shown via inline slot above */}
          <div className="hidden md:block">
            <FamilyConnectionsCard />
          </div>

          {/* Calendar */}
          <CalendarCard />

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

        <RetirementSettingsModal
          open={retirementModalOpen}
          onClose={() => setRetirementModalOpen(false)}
          dateOfBirth={dateOfBirth}
          currentNetWorth={netWorth}
          avgMonthlySavings={avgMonthlySavings}
        />
        </div>
        );
        }