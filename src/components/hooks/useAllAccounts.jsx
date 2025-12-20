import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useAllAccounts() {
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list('-created_at'),
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

  const mapAccountTypeToEntityType = (accountType) => {
    if (accountType === 'credit_card') return 'CreditCard';
    if (['checking', 'savings'].includes(accountType)) return 'BankAccount';
    return 'BankAccount';
  };

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
    ...bankAccounts.map(a => ({
      ...a,
      entityType: 'BankAccount',
      current_balance: a.balance,
      institution: a.institution_name
    })),
    ...creditCards.map(c => ({
      ...c,
      entityType: 'CreditCard',
      name: c.account_name,
      last_four: c.account_number_last4,
      current_balance: c.balance,
      institution: c.institution_name
    })),
    ...assets.map(a => ({ ...a, account_name: a.name, entityType: 'Asset' })),
    ...liabilities.map(l => ({ ...l, account_name: l.name, entityType: 'Liability' })),
    ...categories.filter(c => c.type === 'income').map(c => ({ ...c, account_name: c.name, entityType: 'Income' })),
    ...categories.filter(c => c.type === 'expense').map(c => ({ ...c, account_name: c.name, entityType: 'Expense' })),
  ];

  const isLoading = loadingAccounts || loadingAssets || loadingLiabilities || loadingCategories;

  return {
    allAccounts,
    bankAccounts: bankAccounts.map(a => ({
      ...a,
      entityType: 'BankAccount',
      current_balance: a.balance,
      institution: a.institution_name
    })),
    creditCards: creditCards.map(c => ({
      ...c,
      entityType: 'CreditCard',
      name: c.account_name,
      last_four: c.account_number_last4,
      current_balance: c.balance,
      institution: c.institution_name
    })),
    assets,
    liabilities,
    categories,
    incomeCategories: categories.filter(c => c.type === 'income'),
    expenseCategories: categories.filter(c => c.type === 'expense'),
    isLoading,
  };
}