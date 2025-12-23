import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { startOfMonth, endOfMonth } from 'date-fns';

export function useBudgetData() {
  const { data: budgetGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['budgetGroups'],
    queryFn: () => firstsavvy.entities.BudgetGroup.list('order')
  });

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => firstsavvy.entities.Budget.filter({ is_active: true })
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => firstsavvy.entities.Transaction.list('-date', 1000)
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => firstsavvy.entities.BankAccount.filter({ is_active: true })
  });

  const isLoading = groupsLoading || budgetsLoading || transactionsLoading || accountsLoading;

  const calculatedData = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    const activeAccountIds = accounts.map(a => a.id);

    const currentMonthTransactions = transactions.filter(t => {
      if (!t.date) return false;
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;
      const matchesActiveAccount = activeAccountIds.includes(t.bank_account_id);
      const isTransfer = t.type === 'transfer';
      return tDate >= monthStart && tDate <= monthEnd && t.status === 'posted' && matchesActiveAccount && !isTransfer;
    });

    const expenseTransactions = currentMonthTransactions.filter(t => t.type === 'expense');
    const incomeTransactions = currentMonthTransactions.filter(t => t.type === 'income');

    const spendingByCategory = expenseTransactions.reduce((acc, t) => {
      const key = t.category_id || '__uncategorized__';
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    }, {});

    const incomeByCategory = incomeTransactions.reduce((acc, t) => {
      const key = t.category_id || '__uncategorized_income__';
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    }, {});

    const totalActualIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = Object.values(spendingByCategory).reduce((sum, amt) => sum + amt, 0);

    const incomeGroupIds = new Set(budgetGroups.filter(g => g.type === 'income').map(g => g.id));
    const budgetedIncome = budgets
      .filter(b => incomeGroupIds.has(b.group_id))
      .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

    const expenseGroupIds = new Set(budgetGroups.filter(g => g.type === 'expense').map(g => g.id));
    const totalBudgeted = budgets
      .filter(b => expenseGroupIds.has(b.group_id))
      .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

    return {
      spendingByCategory,
      incomeByCategory,
      totalActualIncome,
      totalSpent,
      budgetedIncome,
      totalBudgeted,
      remaining: totalBudgeted - totalSpent,
      monthStart,
      monthEnd
    };
  }, [transactions, accounts, budgets, budgetGroups]);

  return {
    budgetGroups,
    budgets,
    transactions,
    accounts,
    isLoading,
    hasSetupStarted: budgetGroups.length > 0,
    ...calculatedData
  };
}
