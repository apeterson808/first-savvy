import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useProfile } from '@/contexts/ProfileContext';

export function useBudgetData() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id || 'default';

  const { data: budgetGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['budgetGroups', profileId],
    queryFn: () => firstsavvy.entities.BudgetGroup.list('order'),
    enabled: !!activeProfile
  });

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets', profileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('budgets')
        .select(`
          *,
          chartAccount:user_chart_of_accounts!budgets_chart_account_id_fkey(
            id,
            display_name,
            class,
            account_type,
            account_detail,
            icon,
            color
          )
        `)
        .eq('is_active', true)
        .order('order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeProfile
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', profileId],
    queryFn: () => firstsavvy.entities.Transaction.list('-date', 1000),
    enabled: !!activeProfile
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', profileId],
    queryFn: () => firstsavvy.entities.BankAccount.filter({ is_active: true }),
    enabled: !!activeProfile
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['chart-accounts-templates-income-expense'],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('chart_of_accounts_templates')
        .select('*')
        .in('class', ['income', 'expense'])
        .order('display_name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const isLoading = groupsLoading || budgetsLoading || transactionsLoading || accountsLoading || categoriesLoading;

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

    const refundTransactions = incomeTransactions.filter(t => t.original_type === 'expense');
    const regularIncomeTransactions = incomeTransactions.filter(t => t.original_type !== 'expense');

    const spendingByCategory = expenseTransactions.reduce((acc, t) => {
      const key = t.chart_account_id || '__uncategorized__';
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    }, {});

    const incomeByCategory = regularIncomeTransactions.reduce((acc, t) => {
      const key = t.chart_account_id || '__uncategorized_income__';
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    }, {});

    const totalActualIncome = regularIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalRefunds = refundTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = Object.values(spendingByCategory).reduce((sum, amt) => sum + amt, 0);

    const incomeGroupIds = new Set(budgetGroups.filter(g => g.type === 'income').map(g => g.id));
    const budgetedIncome = budgets
      .filter(b => incomeGroupIds.has(b.group_id))
      .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

    const expenseGroupIds = new Set(budgetGroups.filter(g => g.type === 'expense').map(g => g.id));
    const totalBudgeted = budgets
      .filter(b => expenseGroupIds.has(b.group_id))
      .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

    const categoryUsage = transactions.reduce((acc, t) => {
      if (t.chart_account_id) {
        if (!acc[t.chart_account_id]) {
          acc[t.chart_account_id] = {
            everUsed: true,
            lastUsed: t.date,
            count: 0
          };
        }
        acc[t.chart_account_id].count += 1;
        if (t.date && (!acc[t.chart_account_id].lastUsed || new Date(t.date) > new Date(acc[t.chart_account_id].lastUsed))) {
          acc[t.chart_account_id].lastUsed = t.date;
        }
      }
      return acc;
    }, {});

    const budgetedCategoryIds = new Set(budgets.map(b => b.chart_account_id));

    const budgetedIncomeCategories = categories
      .filter(c => c.class === 'income' && budgetedCategoryIds.has(c.id))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));

    const budgetedExpenseCategories = categories
      .filter(c => c.class === 'expense' && budgetedCategoryIds.has(c.id))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));

    const availableIncomeCategories = categories
      .filter(c => c.class === 'income' && !budgetedCategoryIds.has(c.id))
      .sort((a, b) => {
        const aUsage = categoryUsage[a.id];
        const bUsage = categoryUsage[b.id];
        if (aUsage?.everUsed && !bUsage?.everUsed) return -1;
        if (!aUsage?.everUsed && bUsage?.everUsed) return 1;
        if (aUsage?.everUsed && bUsage?.everUsed) {
          const aDate = new Date(aUsage.lastUsed);
          const bDate = new Date(bUsage.lastUsed);
          if (aDate > bDate) return -1;
          if (aDate < bDate) return 1;
        }
        return a.display_name.localeCompare(b.display_name);
      });

    const availableExpenseCategories = categories
      .filter(c => c.class === 'expense' && !budgetedCategoryIds.has(c.id))
      .sort((a, b) => {
        const aUsage = categoryUsage[a.id];
        const bUsage = categoryUsage[b.id];
        if (aUsage?.everUsed && !bUsage?.everUsed) return -1;
        if (!aUsage?.everUsed && bUsage?.everUsed) return 1;
        if (aUsage?.everUsed && bUsage?.everUsed) {
          const aDate = new Date(aUsage.lastUsed);
          const bDate = new Date(bUsage.lastUsed);
          if (aDate > bDate) return -1;
          if (aDate < bDate) return 1;
        }
        return a.display_name.localeCompare(b.display_name);
      });

    return {
      spendingByCategory,
      incomeByCategory,
      totalActualIncome,
      totalRefunds,
      totalSpent,
      budgetedIncome,
      totalBudgeted,
      remaining: totalBudgeted - totalSpent,
      monthStart,
      monthEnd,
      refundTransactions,
      regularIncomeTransactions,
      categoryUsage,
      budgetedIncomeCategories,
      budgetedExpenseCategories,
      availableIncomeCategories,
      availableExpenseCategories
    };
  }, [transactions, accounts, budgets, budgetGroups, categories]);

  return {
    budgetGroups,
    budgets,
    transactions,
    accounts,
    categories,
    isLoading,
    hasSetupStarted: budgetGroups.length > 0,
    categoryUsage: calculatedData.categoryUsage,
    budgetedIncomeCategories: calculatedData.budgetedIncomeCategories,
    budgetedExpenseCategories: calculatedData.budgetedExpenseCategories,
    availableIncomeCategories: calculatedData.availableIncomeCategories,
    availableExpenseCategories: calculatedData.availableExpenseCategories,
    ...calculatedData
  };
}
