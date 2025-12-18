import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useAllAccounts() {
  const { data: bankAccounts = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true }),
    staleTime: 30000,
  });

  const { data: creditCards = [], isLoading: loadingCreditCards } = useQuery({
    queryKey: ['creditCards'],
    queryFn: () => base44.entities.CreditCard.filter({ is_active: true }),
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
    ['checking', 'savings'].includes(a.account_type)
  );

  const allAccounts = [
    ...transactionalAccounts.map(a => ({ ...a, account_name: a.account_name, entityType: 'BankAccount' })),
    ...creditCards.map(c => ({ ...c, account_name: c.name, entityType: 'CreditCard' })),
    ...assets.map(a => ({ ...a, account_name: a.name, entityType: 'Asset' })),
    ...liabilities.map(l => ({ ...l, account_name: l.name, entityType: 'Liability' })),
    ...categories.filter(c => c.type === 'income').map(c => ({ ...c, account_name: c.name, entityType: 'Income' })),
    ...categories.filter(c => c.type === 'expense').map(c => ({ ...c, account_name: c.name, entityType: 'Expense' })),
  ];

  const isLoading = loadingBanks || loadingCreditCards || loadingAssets || loadingLiabilities || loadingCategories;

  return {
    allAccounts,
    bankAccounts: transactionalAccounts,
    creditCards: creditCards.map(c => ({ ...c, account_name: c.name, entityType: 'CreditCard' })),
    assets,
    liabilities,
    categories,
    incomeCategories: categories.filter(c => c.type === 'income'),
    expenseCategories: categories.filter(c => c.type === 'expense'),
    isLoading,
  };
}