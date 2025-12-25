import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';

export default function useAllAccounts() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id || 'default';

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts', profileId],
    queryFn: () => firstsavvy.entities.Account.list('-created_at'),
    staleTime: 30000,
    enabled: !!activeProfile,
  });

  const { data: assets = [], isLoading: loadingAssets } = useQuery({
    queryKey: ['assets', profileId],
    queryFn: () => firstsavvy.entities.Asset.list('name'),
    staleTime: 30000,
    enabled: !!activeProfile,
  });

  const { data: liabilities = [], isLoading: loadingLiabilities } = useQuery({
    queryKey: ['liabilities', profileId],
    queryFn: () => firstsavvy.entities.Liability.list('name'),
    staleTime: 30000,
    enabled: !!activeProfile,
  });

  const { data: equity = [], isLoading: loadingEquity } = useQuery({
    queryKey: ['equity', profileId],
    queryFn: () => firstsavvy.entities.Equity.list('name'),
    staleTime: 30000,
    enabled: !!activeProfile,
  });

  const { data: chartAccounts = [], isLoading: loadingChartAccounts } = useQuery({
    queryKey: ['chart-accounts', profileId],
    queryFn: async () => {
      if (!activeProfile) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts;
    },
    enabled: !!activeProfile,
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

  const getTypeDetailDisplay = (accountType, accountDetail) => {
    if (!accountType) return null;
    return {
      type: accountType,
      detail: accountDetail,
      full: accountDetail ? `${accountType} › ${accountDetail}` : accountType
    };
  };

  const allAccounts = [
    ...accounts.map(a => ({
      ...a,
      account_name: a.account_name || a.name,
      institution: a.institution_name,
      entityType: a.account_type === 'credit_card' ? 'CreditCard' : 'BankAccount',
      typeDetailDisplay: getTypeDetailDisplay(a.account_type, a.account_detail)
    })),
    ...assets.map(a => ({
      ...a,
      account_name: a.name,
      entityType: 'Asset',
      typeDetailDisplay: getTypeDetailDisplay(a.account_type, a.account_detail)
    })),
    ...liabilities.map(l => ({
      ...l,
      account_name: l.name,
      entityType: 'Liability',
      typeDetailDisplay: getTypeDetailDisplay(l.account_type, l.account_detail)
    })),
    ...equity.map(e => ({
      ...e,
      account_name: e.name,
      entityType: 'Equity',
      typeDetailDisplay: getTypeDetailDisplay(e.account_type, e.account_detail)
    })),
    ...chartAccounts.filter(c => c.class === 'income').map(c => ({
      ...c,
      account_name: c.display_name || c.account_detail || c.account_name,
      name: c.display_name || c.account_detail || c.account_name,
      entityType: 'Income'
    })),
    ...chartAccounts.filter(c => c.class === 'expense').map(c => ({
      ...c,
      account_name: c.display_name || c.account_detail || c.account_name,
      name: c.display_name || c.account_detail || c.account_name,
      entityType: 'Expense'
    })),
  ];

  const isLoading = loadingAccounts || loadingAssets || loadingLiabilities || loadingEquity || loadingChartAccounts;

  return {
    allAccounts,
    bankAccounts: bankAccounts.map(a => ({
      ...a,
      account_name: a.account_name || a.name,
      institution: a.institution_name,
      entityType: 'BankAccount',
      typeDetailDisplay: getTypeDetailDisplay(a.account_type, a.account_detail)
    })),
    creditCards: creditCards.map(c => ({
      ...c,
      account_name: c.account_name || c.name,
      last_four: c.account_number_last4,
      institution: c.institution_name,
      entityType: 'CreditCard',
      typeDetailDisplay: getTypeDetailDisplay(c.account_type, c.account_detail)
    })),
    assets,
    liabilities,
    equity,
    chartAccounts,
    categories: chartAccounts,
    incomeCategories: chartAccounts.filter(c => c.class === 'income').map(c => ({
      ...c,
      name: c.display_name || c.account_detail || c.account_name,
      type: 'income'
    })),
    expenseCategories: chartAccounts.filter(c => c.class === 'expense').map(c => ({
      ...c,
      name: c.display_name || c.account_detail || c.account_name,
      type: 'expense'
    })),
    getTypeDetailDisplay,
    isLoading,
  };
}
