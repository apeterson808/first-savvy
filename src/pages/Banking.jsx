import React, { useState } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TransactionsTab from '../components/banking/TransactionsTab';
import CategoryBreakdownDonut from '../components/banking/CategoryBreakdownDonut';
import SpendingChartCard from '../components/banking/SpendingChartCard';
import AccountsTable from '../components/banking/AccountsTable';
import useAllAccounts from '../components/hooks/useAllAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';

export default function Banking() {
  const urlParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState(urlParams.get('tab') || 'overview');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('0');
  const [selectedPastMonth, setSelectedPastMonth] = useState('avg3');
  const queryClient = useQueryClient();
  
  // Check for date param from Dashboard chart click - use a ref to track initial URL params
  const initialUrlDate = React.useRef(urlParams.get('date'));
  const initialUrlAccount = React.useRef(urlParams.get('account'));
  const [transactionFilters, setTransactionFilters] = useState(
    initialUrlDate.current ? { date: initialUrlDate.current, account: initialUrlAccount.current || 'all' } : null
  );

  // Use a counter to force remount of TransactionsTab
  const [filterKey, setFilterKey] = React.useState(0);

  const handleChartPointClick = ({ date, account }) => {
    // Set filters and increment key to force remount
    const newFilters = { date, account };
    setTransactionFilters(newFilters);
    setFilterKey(prev => prev + 1);
    
    // Navigate to transactions tab
    const newUrl = `${window.location.pathname}?tab=transactions&date=${date}&account=${account}`;
    window.history.pushState({}, '', newUrl);
    setActiveTab('transactions');
  };

  // Sync activeTab with URL on popstate only (back/forward buttons)
  React.useEffect(() => {
    const syncTabWithUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const newTab = urlParams.get('tab') || 'overview';
      setActiveTab(newTab);
      
      // Check for date param (from Dashboard click)
      const dateParam = urlParams.get('date');
      const accountParam = urlParams.get('account');
      if (dateParam) {
        setTransactionFilters({ date: dateParam, account: accountParam || 'all' });
      }
    };

    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', syncTabWithUrl);

    return () => {
      window.removeEventListener('popstate', syncTabWithUrl);
    };
  }, []);

  const { allAccounts, isLoading: accountsLoading } = useAllAccounts();

  const accounts = allAccounts.filter(acc =>
    ['checking', 'savings', 'credit_card'].includes(acc.account_type)
  );

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => firstsavvy.entities.Transaction.list('-date', 1000),
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const totalBalance = accounts
    .filter((acc) => acc.is_active !== false)
    .reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

  // Expose setPlaidReviewOpen and setPlaidData globally for AccountsTable
  React.useEffect(() => {
    window.__openPlaidReview = (data) => {
      setPlaidData(data);
      setPlaidReviewOpen(true);
    };
    return () => {
      delete window.__openPlaidReview;
    };
  }, []);

  return (
    <div className="p-3">
      <Tabs value={activeTab} className="w-full">

        <TabsContent value="overview" className="space-y-3">
          {/* Chart and Categories Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <SpendingChartCard
              transactions={transactions}
              accounts={accounts.filter(a => ['checking', 'savings', 'credit_card'].includes(a.account_type))}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              selectedAccount={selectedAccount}
              setSelectedAccount={setSelectedAccount}
              selectedPastMonth={selectedPastMonth}
              setSelectedPastMonth={setSelectedPastMonth}
              onPointClick={handleChartPointClick}
            />

            <CategoryBreakdownDonut 
              transactions={transactions} 
              selectedMonth={selectedMonth}
              selectedAccount={selectedAccount}
              accounts={accounts}
              onCategoryClick={(categoryId) => {
                if (categoryId) {
                  setTransactionFilters({ category: categoryId, account: selectedAccount, month: selectedMonth });
                  setFilterKey(prev => prev + 1);
                  const newUrl = `${window.location.pathname}?tab=transactions&category=${categoryId}&account=${selectedAccount}&month=${selectedMonth}`;
                  window.history.pushState({}, '', newUrl);
                  setActiveTab('transactions');
                }
              }}
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total Balance</p>
                <CardTitle className="text-2xl font-bold">${totalBalance.toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Active Accounts</p>
                <CardTitle className="text-2xl font-bold">
                  {accounts.filter((acc) => acc.is_active).length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total Accounts</p>
                <CardTitle className="text-2xl font-bold">{accounts.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Account Overview</p>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Overview content coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-3">
          <TransactionsTab 
            key={`txn-${filterKey}`}
            initialFilters={transactionFilters}
            onFiltersApplied={() => {
              // Clear URL params after filters are applied
              const newUrl = `${window.location.pathname}?tab=transactions`;
              window.history.replaceState({}, '', newUrl);
              setTransactionFilters(null);
            }}
          />
        </TabsContent>

        <TabsContent value="recurring" className="space-y-3">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Recurring Payments</p>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Recurring payments content coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-3">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Rules</p>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Rules content coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-3">
          <AccountsTable accounts={allAccounts} isLoading={accountsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}