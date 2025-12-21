import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';

export default function useAllAccounts() {
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => firstsavvy.entities.Account.list('-created_at'),
    staleTime: 30000,
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['assets'],
    queryFn: () => firstsavvy.entities.Asset.list('name'),
    staleTime: 30000,
  });

  const { data: liabilities = [], isLoading: loadingLiabilities } = useQuery({
    queryKey: ['liabilities'],
    queryFn: () => firstsavvy.entities.Liability.list('name'),
    staleTime: 30000,
  });

  const { data: equity = [], isLoading: loadingEquity } = useQuery({
    queryKey: ['equity'],
    queryFn: () => firstsavvy.entities.Equity.list('name'),
    staleTime: 30000,
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => firstsavvy.entities.Category.list('name'),
    staleTime: 30000,
  });

  const transactionalAccounts = accounts.filter(a =>
    ['checking', 'savings', 'credit_card'].includes(a.account_type) && a.is_active !== false
  );

  const bankAccounts = accounts.filter(a =>
    ['checking', 'savings'].includes(a.account_type) && a.is_active !== false
  );

  const creditCards = accounts.filter(a =>
    a.account_type === 'credit_card' && a.is_active !== false
  );

  const allAccounts = [
    ...accounts.map(a => ({
      ...a,
      account_name: a.account_name || a.name,
      institution: a.institution_name,
      entityType: a.account_type === 'credit_card' ? 'CreditCard' : 'BankAccount'
    })),
    ...assets.map(a => ({ ...a, account_name: a.name, entityType: 'Asset' })),
    ...liabilities.map(l => ({ ...l, account_name: l.name, entityType: 'Liability' })),
    ...equity.map(e => ({ ...e, account_name: e.name, entityType: 'Equity' })),
    ...categories.filter(c => c.type === 'income').map(c => ({ ...c, account_name: c.name, entityType: 'Income' })),
    ...categories.filter(c => c.type === 'expense').map(c => ({ ...c, account_name: c.name, entityType: 'Expense' })),
  ];

  const isLoading = loadingAccounts || loadingAssets || loadingLiabilities || loadingEquity || loadingCategories;

  return {
    allAccounts,
    bankAccounts: bankAccounts.map(a => ({
      ...a,
      account_name: a.account_name || a.name,
      institution: a.institution_name,
      entityType: 'BankAccount'
    })),
    creditCards: creditCards.map(c => ({
      ...c,
      account_name: c.account_name || c.name,
      last_four: c.account_number_last4,
      institution: c.institution_name,
      entityType: 'CreditCard'
    })),
    assets,
    liabilities,
    equity,
    categories,
    incomeCategories: categories.filter(c => c.type === 'income'),
    expenseCategories: categories.filter(c => c.type === 'expense'),
    isLoading,
  };
}