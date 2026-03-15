import { firstsavvy } from './firstsavvyClient';
import { startOfMonth, endOfMonth, subMonths, format, parseISO, differenceInDays } from 'date-fns';

export const budgetAnalytics = {
  async getHistoricalSpending(categoryAccountId, monthsBack = 12, profileId) {
    const now = new Date();
    const monthlyData = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const targetDate = subMonths(now, i);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);

      const { data: transactions, error } = await firstsavvy.supabase
        .from('transactions')
        .select('amount, date, type, original_type')
        .eq('profile_id', profileId)
        .eq('category_account_id', categoryAccountId)
        .eq('status', 'posted')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString());

      if (error) throw error;

      const expenseTransactions = transactions.filter(t => t.type === 'expense');
      const totalSpent = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const transactionCount = expenseTransactions.length;

      monthlyData.push({
        month: format(targetDate, 'MMM yyyy'),
        monthKey: format(targetDate, 'yyyy-MM'),
        totalSpent,
        transactionCount,
        avgTransaction: transactionCount > 0 ? totalSpent / transactionCount : 0,
      });
    }

    const allSpending = monthlyData.map(m => m.totalSpent).filter(s => s > 0);
    const average = allSpending.length > 0 ? allSpending.reduce((a, b) => a + b, 0) / allSpending.length : 0;
    const max = allSpending.length > 0 ? Math.max(...allSpending) : 0;
    const min = allSpending.length > 0 ? Math.min(...allSpending) : 0;

    return {
      monthlyData,
      summary: {
        average,
        max,
        min,
        trend: calculateTrend(monthlyData)
      }
    };
  },

  async getHistoricalSpendingWithCategories(accountIds, categoryNames, monthsBack = 12, profileId) {
    const now = new Date();
    const monthlyData = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const targetDate = subMonths(now, i);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);

      const { data: transactions, error } = await firstsavvy.supabase
        .from('transactions')
        .select('amount, date, type, category_account_id, contact_id, contacts(id, name)')
        .eq('profile_id', profileId)
        .in('category_account_id', accountIds)
        .eq('status', 'posted')
        .eq('type', 'expense')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString());

      if (error) throw error;

      const byCategory = {};
      accountIds.forEach(id => {
        byCategory[id] = { total: 0, vendors: {} };
      });

      transactions.forEach(t => {
        const catId = t.category_account_id;
        if (!byCategory[catId]) byCategory[catId] = { total: 0, vendors: {} };
        byCategory[catId].total += t.amount || 0;

        if (t.contact_id && t.contacts?.name) {
          const vname = t.contacts.name;
          byCategory[catId].vendors[vname] = (byCategory[catId].vendors[vname] || 0) + (t.amount || 0);
        }
      });

      const totalSpent = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const point = {
        month: format(targetDate, 'MMM yyyy'),
        monthShort: format(targetDate, 'MMM'),
        monthKey: format(targetDate, 'yyyy-MM'),
        totalSpent,
        transactionCount: transactions.length,
        categories: byCategory,
      };

      monthlyData.push(point);
    }

    const allSpending = monthlyData.map(m => m.totalSpent).filter(s => s > 0);
    const average = allSpending.length > 0 ? allSpending.reduce((a, b) => a + b, 0) / allSpending.length : 0;
    const max = allSpending.length > 0 ? Math.max(...allSpending) : 0;
    const min = allSpending.length > 0 ? Math.min(...allSpending) : 0;

    return {
      monthlyData,
      categoryNames,
      summary: { average, max, min, trend: calculateTrend(monthlyData) }
    };
  },

  async getVendorBreakdown(categoryAccountId, dateRange, profileId) {
    const now = new Date();
    const monthsBack = 12;
    const monthlyData = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const targetDate = subMonths(now, i);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);

      const { data: transactions, error } = await firstsavvy.supabase
        .from('transactions')
        .select(`
          id,
          amount,
          date,
          description,
          type,
          contact_id,
          contacts (
            id,
            name,
            type
          )
        `)
        .eq('profile_id', profileId)
        .eq('category_account_id', categoryAccountId)
        .eq('status', 'posted')
        .eq('type', 'expense')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString())
        .order('date', { ascending: false });

      if (error) throw error;

      const vendorMap = {};
      transactions.forEach(t => {
        if (t.contact_id && t.contacts) {
          const vendorId = t.contact_id;
          if (!vendorMap[vendorId]) {
            vendorMap[vendorId] = {
              id: vendorId,
              name: t.contacts.name,
              totalSpent: 0,
              transactionCount: 0
            };
          }
          vendorMap[vendorId].totalSpent += t.amount;
          vendorMap[vendorId].transactionCount += 1;
        }
      });

      monthlyData.push({
        month: format(targetDate, 'MMM yyyy'),
        monthKey: format(targetDate, 'yyyy-MM'),
        vendors: Object.values(vendorMap),
        totalSpent: transactions.reduce((sum, t) => sum + t.amount, 0)
      });
    }

    const allVendors = new Set();
    monthlyData.forEach(month => {
      month.vendors.forEach(vendor => allVendors.add(vendor.name));
    });

    return {
      monthlyData,
      vendors: Array.from(allVendors)
    };
  },

  async getTransactionPatterns(categoryAccountId, profileId) {
    const { data: transactions, error } = await firstsavvy.supabase
      .from('transactions')
      .select('id, amount, date, description, type')
      .eq('profile_id', profileId)
      .eq('category_account_id', categoryAccountId)
      .eq('status', 'posted')
      .eq('type', 'expense')
      .order('date', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const dayOfWeekMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
    const dayOfWeekCounts = {};
    const dayOfMonthCounts = {};

    transactions.forEach(t => {
      const date = parseISO(t.date);
      const dayOfWeek = date.getDay();
      const dayOfMonth = date.getDate();

      dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
      dayOfMonthCounts[dayOfMonth] = (dayOfMonthCounts[dayOfMonth] || 0) + 1;
    });

    const dayOfWeekPattern = Object.entries(dayOfWeekCounts)
      .map(([day, count]) => ({ day: dayOfWeekMap[day], count }))
      .sort((a, b) => b.count - a.count);

    const topDaysOfMonth = Object.entries(dayOfMonthCounts)
      .map(([day, count]) => ({ day: parseInt(day), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      dayOfWeekPattern,
      topDaysOfMonth,
      averageFrequency: calculateFrequency(transactions)
    };
  },

  async getBudgetPerformanceHistory(categoryAccountId, monthsBack = 12, profileId) {
    const now = new Date();
    const performanceData = [];

    const { data: budget } = await firstsavvy.supabase
      .from('budgets')
      .select('allocated_amount, cadence')
      .eq('profile_id', profileId)
      .eq('chart_account_id', categoryAccountId)
      .maybeSingle();

    const monthlyBudget = budget?.allocated_amount || 0;

    for (let i = monthsBack - 1; i >= 0; i--) {
      const targetDate = subMonths(now, i);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);

      const { data: transactions } = await firstsavvy.supabase
        .from('transactions')
        .select('amount, type')
        .eq('profile_id', profileId)
        .eq('category_account_id', categoryAccountId)
        .eq('status', 'posted')
        .eq('type', 'expense')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString());

      const totalSpent = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
      const variance = monthlyBudget - totalSpent;
      const percentUsed = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;

      performanceData.push({
        month: format(targetDate, 'MMM yyyy'),
        budgeted: monthlyBudget,
        actual: totalSpent,
        variance,
        percentUsed,
        underBudget: variance >= 0
      });
    }

    const underBudgetMonths = performanceData.filter(p => p.underBudget).length;
    const adherenceRate = (underBudgetMonths / performanceData.length) * 100;

    return {
      performanceData,
      adherenceRate
    };
  },

  async getSpendingForecast(categoryAccountId, profileId) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
    const daysElapsed = differenceInDays(now, monthStart) + 1;

    const { data: transactions } = await firstsavvy.supabase
      .from('transactions')
      .select('amount')
      .eq('profile_id', profileId)
      .eq('category_account_id', categoryAccountId)
      .eq('status', 'posted')
      .eq('type', 'expense')
      .gte('date', monthStart.toISOString())
      .lte('date', now.toISOString());

    const spentSoFar = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const dailyAverage = daysElapsed > 0 ? spentSoFar / daysElapsed : 0;
    const daysRemaining = daysInMonth - daysElapsed;
    const projectedTotal = spentSoFar + (dailyAverage * daysRemaining);

    const historicalData = await this.getHistoricalSpending(categoryAccountId, 3, profileId);
    const recentAverage = historicalData.summary.average;

    return {
      spentSoFar,
      dailyAverage,
      daysElapsed,
      daysRemaining,
      projectedTotal,
      historicalAverage: recentAverage,
      confidence: daysElapsed / daysInMonth
    };
  },

  async getComparativeAnalysis(categoryAccountId, profileId) {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const lastYearDate = subMonths(now, 12);
    const lastYearMonthStart = startOfMonth(lastYearDate);
    const lastYearMonthEnd = endOfMonth(lastYearDate);

    const { data: currentMonthTxns } = await firstsavvy.supabase
      .from('transactions')
      .select('amount')
      .eq('profile_id', profileId)
      .eq('category_account_id', categoryAccountId)
      .eq('status', 'posted')
      .eq('type', 'expense')
      .gte('date', currentMonthStart.toISOString())
      .lte('date', currentMonthEnd.toISOString());

    const { data: lastYearTxns } = await firstsavvy.supabase
      .from('transactions')
      .select('amount')
      .eq('profile_id', profileId)
      .eq('category_account_id', categoryAccountId)
      .eq('status', 'posted')
      .eq('type', 'expense')
      .gte('date', lastYearMonthStart.toISOString())
      .lte('date', lastYearMonthEnd.toISOString());

    const currentTotal = currentMonthTxns?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const lastYearTotal = lastYearTxns?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const yearOverYearChange = lastYearTotal > 0 ? ((currentTotal - lastYearTotal) / lastYearTotal) * 100 : 0;

    const { data: allExpenses } = await firstsavvy.supabase
      .from('transactions')
      .select('amount, category_account_id')
      .eq('profile_id', profileId)
      .eq('status', 'posted')
      .eq('type', 'expense')
      .gte('date', currentMonthStart.toISOString())
      .lte('date', currentMonthEnd.toISOString());

    const totalExpenses = allExpenses?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const percentOfTotal = totalExpenses > 0 ? (currentTotal / totalExpenses) * 100 : 0;

    return {
      currentMonth: currentTotal,
      lastYearSameMonth: lastYearTotal,
      yearOverYearChange,
      percentOfTotalExpenses: percentOfTotal
    };
  }
};

function calculateTrend(monthlyData) {
  if (monthlyData.length < 2) return 'stable';

  const recentMonths = monthlyData.slice(-3);
  const olderMonths = monthlyData.slice(0, Math.min(3, monthlyData.length - 3));

  const recentAvg = recentMonths.reduce((sum, m) => sum + m.totalSpent, 0) / recentMonths.length;
  const olderAvg = olderMonths.length > 0
    ? olderMonths.reduce((sum, m) => sum + m.totalSpent, 0) / olderMonths.length
    : recentAvg;

  if (recentAvg > olderAvg * 1.1) return 'increasing';
  if (recentAvg < olderAvg * 0.9) return 'decreasing';
  return 'stable';
}

function calculateFrequency(transactions) {
  if (transactions.length < 2) return 'occasional';

  const dates = transactions.map(t => parseISO(t.date)).sort((a, b) => a - b);
  const intervals = [];

  for (let i = 1; i < dates.length; i++) {
    intervals.push(differenceInDays(dates[i], dates[i - 1]));
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  if (avgInterval <= 7) return 'weekly';
  if (avgInterval <= 14) return 'biweekly';
  if (avgInterval <= 31) return 'monthly';
  return 'occasional';
}
