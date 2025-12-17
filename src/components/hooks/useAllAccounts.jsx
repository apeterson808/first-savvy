import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useAllAccounts() {
  const { data: bankAccounts = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true }),
    staleTime: 30000,
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['assets'],
    queryFn: () => base44.entities.Asset.list('name'),
    staleTime: 30000,
  });

  const { data: liabilities = [], isLoading: loadingLiabilities } = useQuery({
    queryKey: ['liabilities'],
    queryFn: () => base44.entities.Liability.list('name'),
    staleTime: 30000,
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name'),
    staleTime: 30000,
  });

  const transactionalAccounts = bankAccounts.filter(a =>
    ['checking', 'savings', 'credit', 'credit_card'].includes(a.account_type)
  );

  const creditCards = bankAccounts.filter(a =>
    a.account_type === 'credit' || a.account_type === 'credit_card'
  );

  const allAccounts = [
    ...transactionalAccounts.map(a => ({ ...a, entityType: 'BankAccount' })),
    ...assets.map(a => ({ ...a, account_name: a.name, entityType: 'Asset' })),
    ...liabilities.map(l => ({ ...l, account_name: l.name, entityType: 'Liability' })),
    ...categories.filter(c => c.type === 'income').map(c => ({ ...c, account_name: c.name, entityType: 'Income' })),
    ...categories.filter(c => c.type === 'expense').map(c => ({ ...c, account_name: c.name, entityType: 'Expense' })),
  ];

  const isLoading = loadingBanks || loadingAssets || loadingLiabilities || loadingCategories;

  return {
    allAccounts,
    bankAccounts: transactionalAccounts,
    creditCards,
    assets,
    liabilities,
    categories,
    incomeCategories: categories.filter(c => c.type === 'income'),
    expenseCategories: categories.filter(c => c.type === 'expense'),
    isLoading,
  };
}