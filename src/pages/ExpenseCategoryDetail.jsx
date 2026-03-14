/**
 * DEPRECATED: This component has been superseded by AccountDetail.jsx
 *
 * All budget analytics functionality has been integrated into AccountDetail.jsx,
 * which now handles both regular accounts (assets, liabilities, equity) and
 * budgetable accounts (expense, income) with conditional rendering.
 *
 * The route /Budgeting/category/:id now redirects to AccountDetail.jsx
 * for a unified account detail experience.
 *
 * This file is kept temporarily for reference but should be removed once
 * the migration is fully tested and confirmed.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { budgetAnalytics } from '@/api/budgetAnalytics';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, BarChart3, TrendingUp, Users, Calendar, Target } from 'lucide-react';
import { getAccountDisplayName } from '@/components/utils/constants';
import { BudgetSettingsCard } from '@/components/budgeting/BudgetSettingsCard';
import { SpendingTrendChart } from '@/components/budgeting/SpendingTrendChart';
import { BudgetPerformanceCard } from '@/components/budgeting/BudgetPerformanceCard';
import { VendorAnalysisCard } from '@/components/budgeting/VendorAnalysisCard';
import { ForecastingCard } from '@/components/budgeting/ForecastingCard';
import { TransactionPatternsCard } from '@/components/budgeting/TransactionPatternsCard';
import { startOfMonth, endOfMonth } from 'date-fns';

export default function ExpenseCategoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: categoryAccount, isLoading: accountLoading } = useQuery({
    queryKey: ['category-account', id, activeProfile?.id],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('user_chart_of_accounts')
        .select('*')
        .eq('id', id)
        .eq('profile_id', activeProfile.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!activeProfile?.id
  });

  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ['budget-for-category', id, activeProfile?.id],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('budgets')
        .select('*')
        .eq('chart_account_id', id)
        .eq('profile_id', activeProfile.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!activeProfile?.id
  });

  const { data: currentMonthSpending, isLoading: spendingLoading } = useQuery({
    queryKey: ['current-month-spending', id, activeProfile?.id],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const { data, error } = await firstsavvy.supabase
        .from('transactions')
        .select('amount')
        .eq('profile_id', activeProfile.id)
        .eq('category_account_id', id)
        .eq('status', 'posted')
        .eq('type', 'expense')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString());

      if (error) throw error;
      return data?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    },
    enabled: !!id && !!activeProfile?.id
  });

  const { data: historicalData, isLoading: historicalLoading } = useQuery({
    queryKey: ['historical-spending', id, activeProfile?.id],
    queryFn: async () => {
      return await budgetAnalytics.getHistoricalSpending(id, 12, activeProfile.id);
    },
    enabled: !!id && !!activeProfile?.id
  });

  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendor-breakdown', id, activeProfile?.id],
    queryFn: async () => {
      return await budgetAnalytics.getVendorBreakdown(
        id,
        null,
        activeProfile.id
      );
    },
    enabled: !!id && !!activeProfile?.id
  });

  const { data: patterns, isLoading: patternsLoading } = useQuery({
    queryKey: ['transaction-patterns', id, activeProfile?.id],
    queryFn: async () => {
      return await budgetAnalytics.getTransactionPatterns(id, activeProfile.id);
    },
    enabled: !!id && !!activeProfile?.id
  });

  const { data: performanceHistory, isLoading: performanceLoading } = useQuery({
    queryKey: ['budget-performance-history', id, activeProfile?.id],
    queryFn: async () => {
      return await budgetAnalytics.getBudgetPerformanceHistory(id, 12, activeProfile.id);
    },
    enabled: !!id && !!activeProfile?.id
  });

  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['spending-forecast', id, activeProfile?.id],
    queryFn: async () => {
      return await budgetAnalytics.getSpendingForecast(id, activeProfile.id);
    },
    enabled: !!id && !!activeProfile?.id
  });

  const { data: comparativeData, isLoading: comparativeLoading } = useQuery({
    queryKey: ['comparative-analysis', id, activeProfile?.id],
    queryFn: async () => {
      return await budgetAnalytics.getComparativeAnalysis(id, activeProfile.id);
    },
    enabled: !!id && !!activeProfile?.id
  });

  const isLoading = accountLoading || budgetLoading || spendingLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!categoryAccount) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Category not found</h1>
        </div>
      </div>
    );
  }

  const categoryName = budget?.custom_name || categoryAccount.display_name;
  const breadcrumbPath = categoryAccount.parent_account_id ? 'Parent > ' : '';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/budgeting')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{categoryName}</h1>
              <Badge variant={budget?.is_active ? 'default' : 'secondary'}>
                {budget?.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {breadcrumbPath && (
              <p className="text-sm text-muted-foreground mt-1">{breadcrumbPath}{categoryName}</p>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Vendors
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Forecast
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Patterns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <BudgetSettingsCard budget={budget} categoryAccount={categoryAccount} />
            </div>
            <div className="lg:col-span-2">
              <BudgetPerformanceCard
                budget={budget}
                currentSpending={currentMonthSpending}
                performanceHistory={performanceHistory}
                comparativeData={comparativeData}
                historicalData={historicalData}
              />
            </div>
          </div>

          <SpendingTrendChart historicalData={historicalData} budget={budget} />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6 mt-6">
          <SpendingTrendChart historicalData={historicalData} budget={budget} />
        </TabsContent>

        <TabsContent value="vendors" className="space-y-6 mt-6">
          <VendorAnalysisCard vendorData={vendorData} />
        </TabsContent>

        <TabsContent value="forecast" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ForecastingCard forecast={forecast} budget={budget} />
            <BudgetPerformanceCard
              budget={budget}
              currentSpending={currentMonthSpending}
              performanceHistory={performanceHistory}
              comparativeData={comparativeData}
              historicalData={historicalData}
            />
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6 mt-6">
          <TransactionPatternsCard patterns={patterns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
