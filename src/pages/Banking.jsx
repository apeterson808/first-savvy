import React, { useState } from 'react';
import { getAccounts } from '@/api/accounts';
import { getTransactions } from '@/api/transactions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TransactionsTab from '../components/banking/TransactionsTabSimple';
import AccountsTable from '../components/banking/AccountsTableSimple';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';

export default function Banking() {
  const urlParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState(urlParams.get('tab') || 'overview');
  const [transactionFilters, setTransactionFilters] = useState(null);
  const [filterKey, setFilterKey] = React.useState(0);
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: getTransactions,
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const totalBalance = accounts
    .filter((acc) => acc.is_active)
    .reduce((sum, acc) => {
      const balance = parseFloat(acc.balance || 0);
      if (acc.account_type === 'credit') {
        return sum - balance;
      }
      return sum + balance;
    }, 0);

  const totalIncome = transactions
    .filter(tx => tx.transaction_type === 'income')
    .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

  const totalExpenses = transactions
    .filter(tx => tx.transaction_type === 'expense')
    .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

  React.useEffect(() => {
    const syncTabWithUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const newTab = urlParams.get('tab') || 'overview';
      setActiveTab(newTab);
    };

    window.addEventListener('popstate', syncTabWithUrl);

    return () => {
      window.removeEventListener('popstate', syncTabWithUrl);
    };
  }, []);

  return (
    <div className="p-3 rounded-sm">
      <Tabs value={activeTab} className="w-full">
        <TabsContent value="overview" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total Balance</p>
                <CardTitle className="text-2xl font-bold">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total Income</p>
                <CardTitle className="text-2xl font-bold text-green-600">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total Expenses</p>
                <CardTitle className="text-2xl font-bold text-red-600">${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
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
          </div>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Accounts</p>
            </CardHeader>
            <CardContent>
              <AccountsTable accounts={accounts} isLoading={accountsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-3">
          <TransactionsTab
            key={`txn-${filterKey}`}
            initialFilters={transactionFilters}
            onFiltersApplied={() => {
              const newUrl = `${window.location.pathname}?tab=transactions`;
              window.history.replaceState({}, '', newUrl);
              setTransactionFilters(null);
            }}
          />
        </TabsContent>

        <TabsContent value="accounts" className="space-y-3">
          <AccountsTable accounts={accounts} isLoading={accountsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}