import React, { useState } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';
import TransactionsTab from '../components/banking/TransactionsTab';
import RulesTab from '../components/banking/RulesTab';
import CategoryBreakdownDonut from '../components/banking/CategoryBreakdownDonut';
import SpendingChartCard from '../components/banking/SpendingChartCard';
import AccountsTable from '../components/banking/AccountsTable';
import FilteredTransactionsTable from '../components/banking/FilteredTransactionsTable';
import useAllAccounts from '../components/hooks/useAllAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/PageTabs';

export default function Banking() {
  const { activeProfile } = useProfile();
  const urlParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState(urlParams.get('tab') || 'spending');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('0');
  const [selectedPastMonth, setSelectedPastMonth] = useState('avg3');
  const queryClient = useQueryClient();

  // State for filtered transactions table on spending tab
  const [spendingTableFilters, setSpendingTableFilters] = useState(null);

  // Check for date param from Dashboard chart click - use a ref to track initial URL params
  const initialUrlDate = React.useRef(urlParams.get('date'));
  const initialUrlAccount = React.useRef(urlParams.get('account'));
  const [transactionFilters, setTransactionFilters] = useState(
    initialUrlDate.current ? { date: initialUrlDate.current, account: initialUrlAccount.current || 'all' } : null
  );

  // Use a counter to force remount of TransactionsTab
  const [filterKey, setFilterKey] = React.useState(0);

  const handleChartPointClick = ({ date, account }) => {
    // Set filters for the spending table instead of navigating away
    setSpendingTableFilters({
      date,
      account,
      type: 'expense'
    });
  };

  React.useEffect(() => {
    const syncTabWithUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const newTab = urlParams.get('tab') || 'spending';
      setActiveTab(newTab);

      const dateParam = urlParams.get('date');
      const accountParam = urlParams.get('account');
      if (dateParam) {
        setTransactionFilters({ date: dateParam, account: accountParam || 'all' });
      }
    };

    window.addEventListener('popstate', syncTabWithUrl);

    return () => {
      window.removeEventListener('popstate', syncTabWithUrl);
    };
  }, []);

  React.useEffect(() => {
    const handleProfileSwitch = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener('profileSwitched', handleProfileSwitch);
    return () => window.removeEventListener('profileSwitched', handleProfileSwitch);
  }, [queryClient]);

  // Reset filtered transactions when month or account settings change
  React.useEffect(() => {
    setSpendingTableFilters(null);
  }, [selectedMonth, selectedAccount]);

  const { allAccounts, isLoading: accountsLoading } = useAllAccounts();

  const accounts = allAccounts.filter(acc =>
    (acc.class === 'asset' && ['checking_account', 'savings_account'].includes(acc.account_detail)) ||
    (acc.class === 'liability' && acc.account_type === 'credit_card')
  );

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => firstsavvy.entities.Transaction.list('-date', 1000),
    staleTime: 30000,
    gcTime: 300000
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => firstsavvy.entities.Category.list('name'),
    staleTime: 30000,
    gcTime: 300000
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => firstsavvy.entities.Contact.list('name'),
    staleTime: 30000,
    gcTime: 300000
  });

  const profileIdToUse = activeProfile?.id;

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chartAccounts', profileIdToUse],
    queryFn: async () => {
      if (!profileIdToUse) return [];
      const accounts = await getUserChartOfAccounts(profileIdToUse);
      return accounts.filter(a => a.is_active);
    },
    enabled: !!profileIdToUse,
    staleTime: 30000
  });

  const totalBalance = accounts
    .filter((acc) => acc.is_active !== false)
    .reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

  return (
    <div className="p-4 md:p-6 overflow-x-hidden">
      <PageTabs tabs={['spending', 'transactions', 'rules', 'recurring', 'accounts']} defaultTab="spending" />
      <Tabs value={activeTab} className="w-full">

        <TabsContent value="spending" className="space-y-4">
          {/* Chart and Categories Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SpendingChartCard
              transactions={transactions}
              accounts={accounts}
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
                  setSpendingTableFilters({
                    category: categoryId,
                    account: selectedAccount,
                    month: selectedMonth,
                    type: 'expense'
                  });
                }
              }}
            />
          </div>

          {/* Filtered Transactions Table */}
          <FilteredTransactionsTable
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            contacts={contacts}
            chartAccounts={chartAccounts}
            filters={spendingTableFilters}
          />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
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

        <TabsContent value="rules" className="space-y-4">
          <RulesTab />
        </TabsContent>

        <TabsContent value="recurring" className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Recurring Payments</p>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Recurring payments content coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <AccountsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}