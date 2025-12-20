import React, { useState } from 'react';
import { getAccounts, getTotalBalance } from '@/api/accounts';
import { getTransactions, getTransactionsSummary } from '@/api/transactions';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, DollarSign, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

export default function Dashboard() {
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: getTransactions,
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

  const thisMonthStart = startOfMonth(new Date());
  const thisMonthEnd = endOfMonth(new Date());

  const thisMonthTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate >= thisMonthStart && txDate <= thisMonthEnd;
  });

  const thisMonthIncome = thisMonthTransactions
    .filter((tx) => tx.transaction_type === 'income')
    .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

  const thisMonthExpenses = thisMonthTransactions
    .filter((tx) => tx.transaction_type === 'expense')
    .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

  const recentTransactions = transactions
    .slice(0, 10)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const checkingAccounts = accounts.filter((acc) => acc.account_type === 'checking');
  const savingsAccounts = accounts.filter((acc) => acc.account_type === 'savings');
  const creditAccounts = accounts.filter((acc) => acc.account_type === 'credit');
  const investmentAccounts = accounts.filter((acc) => acc.account_type === 'investment');

  const checkingTotal = checkingAccounts.reduce(
    (sum, acc) => sum + parseFloat(acc.balance || 0),
    0
  );
  const savingsTotal = savingsAccounts.reduce(
    (sum, acc) => sum + parseFloat(acc.balance || 0),
    0
  );
  const creditTotal = creditAccounts.reduce(
    (sum, acc) => sum + parseFloat(acc.balance || 0),
    0
  );
  const investmentTotal = investmentAccounts.reduce(
    (sum, acc) => sum + parseFloat(acc.balance || 0),
    0
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-slate-600 mt-1">Welcome to your financial overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-slate-600">Total Balance</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">
                ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <DollarSign className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-slate-600">This Month Income</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-green-600">
                ${thisMonthIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <ArrowUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-slate-600">This Month Expenses</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-red-600">
                ${thisMonthExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <ArrowDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-slate-600">Net Cashflow</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p
                className={`text-2xl font-bold ${
                  thisMonthIncome - thisMonthExpenses >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                ${(thisMonthIncome - thisMonthExpenses).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <TrendingUp className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {checkingAccounts.length > 0 && (
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">Checking</p>
                  <p className="text-sm text-slate-600">
                    {checkingAccounts.length} account(s)
                  </p>
                </div>
                <p className="text-lg font-bold">
                  ${checkingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {savingsAccounts.length > 0 && (
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">Savings</p>
                  <p className="text-sm text-slate-600">
                    {savingsAccounts.length} account(s)
                  </p>
                </div>
                <p className="text-lg font-bold">
                  ${savingsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {creditAccounts.length > 0 && (
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">Credit Cards</p>
                  <p className="text-sm text-slate-600">
                    {creditAccounts.length} account(s)
                  </p>
                </div>
                <p className="text-lg font-bold text-red-600">
                  ${creditTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {investmentAccounts.length > 0 && (
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">Investments</p>
                  <p className="text-sm text-slate-600">
                    {investmentAccounts.length} account(s)
                  </p>
                </div>
                <p className="text-lg font-bold">
                  ${investmentTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {accounts.length === 0 && (
              <p className="text-center text-slate-500 py-4">
                No accounts yet.{' '}
                <Link to="/Banking" className="text-blue-600 hover:underline">
                  Add your first account
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <p className="text-center text-slate-500 py-4">
                No transactions yet.{' '}
                <Link to="/Banking?tab=transactions" className="text-blue-600 hover:underline">
                  Add your first transaction
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center pb-3 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-sm text-slate-600">
                        {format(new Date(tx.date), 'MMM dd, yyyy')}
                        {tx.category && ` • ${tx.category.name}`}
                      </p>
                    </div>
                    <p
                      className={`font-semibold ${
                        tx.transaction_type === 'income'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {tx.transaction_type === 'income' ? '+' : '-'}$
                      {parseFloat(tx.amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/Banking?tab=transactions">
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-100 transition-colors">
                Add Transaction
              </button>
            </Link>
            <Link to="/Banking?tab=accounts">
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-100 transition-colors">
                Manage Accounts
              </button>
            </Link>
            <Link to="/Categories">
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-100 transition-colors">
                Manage Categories
              </button>
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold">1</span>
                </div>
                <div>
                  <p className="font-semibold">Add Your Accounts</p>
                  <p className="text-sm text-slate-600">
                    Start by adding your bank accounts, credit cards, and other financial accounts.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold">2</span>
                </div>
                <div>
                  <p className="font-semibold">Record Transactions</p>
                  <p className="text-sm text-slate-600">
                    Keep track of your income and expenses by adding transactions.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold">3</span>
                </div>
                <div>
                  <p className="font-semibold">Organize with Categories</p>
                  <p className="text-sm text-slate-600">
                    Categorize your transactions to better understand your spending patterns.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
