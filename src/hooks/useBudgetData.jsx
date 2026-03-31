import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useProfile } from '@/contexts/ProfileContext';

export function useBudgetData(selectedMonth = null) {
  const { activeProfile } = useProfile();

  const profileIdForAccounts = activeProfile?.id;

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets', activeProfile?.id],
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
            color,
            parent_account_id
          )
        `)
        .eq('profile_id', activeProfile.id)
        .order('order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeProfile?.id,
    refetchOnMount: true
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Transaction.list('-date', 1000),
    enabled: !!activeProfile?.id,
    refetchOnMount: true
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', profileIdForAccounts],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('user_chart_of_accounts')
        .select('*')
        .eq('profile_id', profileIdForAccounts)
        .eq('is_active', true)
        .in('class', ['asset', 'liability']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileIdForAccounts,
    refetchOnMount: true
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['user-chart-accounts-income-expense', profileIdForAccounts],
    queryFn: async () => {
      const { data, error } = await firstsavvy.supabase
        .from('user_chart_of_accounts')
        .select('*')
        .eq('profile_id', profileIdForAccounts)
        .eq('is_active', true)
        .in('class', ['income', 'expense'])
        .order('display_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileIdForAccounts,
    refetchOnMount: true
  });

  const budgetsWithParentInfo = useMemo(() => {
    if (!budgets.length || !categories.length) return budgets;

    return budgets.map(budget => {
      const parentAccountId = budget.chartAccount?.parent_account_id;
      if (!parentAccountId) return budget;

      const parentBudget = budgets.find(b => b.chart_account_id === parentAccountId);
      const parentCategory = categories.find(c => c.id === parentAccountId);

      return {
        ...budget,
        parentBudget: parentBudget ? {
          id: parentBudget.id,
          allocated_amount: parentBudget.allocated_amount,
          name: parentCategory?.display_name
        } : null
      };
    });
  }, [budgets, categories]);

  const isLoading = budgetsLoading || transactionsLoading || accountsLoading || categoriesLoading;

  const calculatedData = useMemo(() => {
    const referenceDate = selectedMonth || new Date();
    const monthStart = startOfMonth(referenceDate);
    const monthEnd = endOfMonth(referenceDate);

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
      const key = t.category_account_id || '__uncategorized__';
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    }, {});

    const spendingWithChildren = (categoryId) => {
      if (!categoryId) return 0;

      const directSpending = spendingByCategory[categoryId] || 0;

      const childCategories = categories.filter(c => c.parent_account_id === categoryId);
      const childSpending = childCategories.reduce((sum, child) => {
        return sum + (spendingByCategory[child.id] || 0);
      }, 0);

      return directSpending + childSpending;
    };

    const incomeByCategory = regularIncomeTransactions.reduce((acc, t) => {
      const key = t.category_account_id || '__uncategorized_income__';
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    }, {});

    const totalActualIncome = regularIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalRefunds = refundTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = Object.values(spendingByCategory).reduce((sum, amt) => sum + amt, 0);

    const budgetedIncome = budgets
      .filter(b => b.chartAccount?.class === 'income' && b.is_active === true)
      .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

    const totalBudgeted = budgets
      .filter(b => b.chartAccount?.class === 'expense' && b.is_active === true)
      .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

    const categoryUsage = transactions.reduce((acc, t) => {
      if (t.category_account_id) {
        if (!acc[t.category_account_id]) {
          acc[t.category_account_id] = {
            everUsed: true,
            lastUsed: t.date,
            count: 0
          };
        }
        acc[t.category_account_id].count += 1;
        if (t.date && (!acc[t.category_account_id].lastUsed || new Date(t.date) > new Date(acc[t.category_account_id].lastUsed))) {
          acc[t.category_account_id].lastUsed = t.date;
        }
      }
      return acc;
    }, {});

    const budgetMap = budgets.reduce((map, b) => {
      map[b.chart_account_id] = b;
      return map;
    }, {});

    const allIncomeCategories = categories
      .filter(c => c.class === 'income')
      .map(category => {
        const budget = budgetMap[category.id];
        return {
          ...category,
          budget,
          budgetStatus: budget ? (budget.is_active ? 'active' : 'inactive') : 'none'
        };
      })
      .sort((a, b) => {
        if (a.budgetStatus === 'active' && b.budgetStatus !== 'active') return -1;
        if (a.budgetStatus !== 'active' && b.budgetStatus === 'active') return 1;
        if (a.budgetStatus === 'inactive' && b.budgetStatus === 'none') return -1;
        if (a.budgetStatus === 'none' && b.budgetStatus === 'inactive') return 1;
        const aUsage = categoryUsage[a.id];
        const bUsage = categoryUsage[b.id];
        if (aUsage?.everUsed && !bUsage?.everUsed) return -1;
        if (!aUsage?.everUsed && bUsage?.everUsed) return 1;
        return a.display_name.localeCompare(b.display_name);
      });

    const allExpenseCategories = categories
      .filter(c => c.class === 'expense')
      .map(category => {
        const budget = budgetMap[category.id];
        return {
          ...category,
          budget,
          budgetStatus: budget ? (budget.is_active ? 'active' : 'inactive') : 'none'
        };
      })
      .sort((a, b) => {
        if (a.budgetStatus === 'active' && b.budgetStatus !== 'active') return -1;
        if (a.budgetStatus !== 'active' && b.budgetStatus === 'active') return 1;
        if (a.budgetStatus === 'inactive' && b.budgetStatus === 'none') return -1;
        if (a.budgetStatus === 'none' && b.budgetStatus === 'inactive') return 1;
        const aUsage = categoryUsage[a.id];
        const bUsage = categoryUsage[b.id];
        if (aUsage?.everUsed && !bUsage?.everUsed) return -1;
        if (!aUsage?.everUsed && bUsage?.everUsed) return 1;
        return a.display_name.localeCompare(b.display_name);
      });

    const groupCategoriesByType = (categoriesList) => {
      return categoriesList.reduce((acc, category) => {
        const type = category.account_type || 'uncategorized';
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(category);
        return acc;
      }, {});
    };

    const allIncomeByType = groupCategoriesByType(allIncomeCategories);
    const allExpenseByType = groupCategoriesByType(allExpenseCategories);

    return {
      spendingByCategory,
      spendingWithChildren,
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
      allIncomeCategories,
      allExpenseCategories,
      allIncomeByType,
      allExpenseByType
    };
  }, [transactions, accounts, budgets, categories, selectedMonth]);

  return {
    budgets: budgetsWithParentInfo,
    transactions,
    accounts,
    categories,
    isLoading,
    hasSetupStarted: budgets.length > 0,
    categoryUsage: calculatedData.categoryUsage,
    allIncomeCategories: calculatedData.allIncomeCategories,
    allExpenseCategories: calculatedData.allExpenseCategories,
    allIncomeByType: calculatedData.allIncomeByType,
    allExpenseByType: calculatedData.allExpenseByType,
    ...calculatedData
  };
}
