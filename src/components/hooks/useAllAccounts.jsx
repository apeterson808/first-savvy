import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';

export default function useAllAccounts() {
  const { user } = useAuth();
  const { activeProfile, loading: profileLoading } = useProfile();

  const { data: chartAccounts = [], isLoading: loadingChartAccounts } = useQuery({
    queryKey: ['chart-accounts', activeProfile?.id],
    queryFn: async () => {
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts;
    },
    enabled: !!activeProfile?.id,
    staleTime: 30000,
    gcTime: 300000,
    refetchOnMount: true,
  });

  const isLoading = profileLoading || loadingChartAccounts;

  const getTypeDetailDisplay = (accountType, accountDetail) => {
    if (!accountType) return null;
    return {
      type: accountType,
      detail: accountDetail,
      full: accountDetail ? `${accountType} › ${accountDetail}` : accountType
    };
  };

  const mapChartAccountToDisplay = (account) => {
    const classLabel = account.class ? account.class.charAt(0).toUpperCase() + account.class.slice(1) : 'Unknown';
    return {
      ...account,
      account_name: account.display_name || account.account_detail || `Account ${account.account_number}`,
      name: account.display_name || account.account_detail || `Account ${account.account_number}`,
      entityType: classLabel,
      detail_type: account.account_detail,
      typeDetailDisplay: getTypeDetailDisplay(account.account_type, account.account_detail),
      current_balance: account.current_balance || 0
    };
  };

  const allAccounts = chartAccounts.map(mapChartAccountToDisplay);

  const transactionalAccounts = chartAccounts
    .filter(a => a.class === 'asset' && ['checking_account', 'savings_account'].includes(a.account_detail))
    .concat(chartAccounts.filter(a => a.class === 'liability' && a.account_type === 'credit_cards'))
    .map(mapChartAccountToDisplay);

  const bankAccounts = chartAccounts
    .filter(a => a.class === 'asset' && ['checking_account', 'savings_account'].includes(a.account_detail))
    .map(mapChartAccountToDisplay);

  const creditCards = chartAccounts
    .filter(a => a.class === 'liability' && a.account_type === 'credit_cards')
    .map(mapChartAccountToDisplay);

  const assets = chartAccounts
    .filter(a => a.class === 'asset')
    .map(mapChartAccountToDisplay);

  const liabilities = chartAccounts
    .filter(a => a.class === 'liability')
    .map(mapChartAccountToDisplay);

  const equity = chartAccounts
    .filter(a => a.class === 'equity')
    .map(mapChartAccountToDisplay);

  const incomeCategories = chartAccounts
    .filter(c => c.class === 'income')
    .map(c => ({
      ...mapChartAccountToDisplay(c),
      type: 'income'
    }));

  const expenseCategories = chartAccounts
    .filter(c => c.class === 'expense')
    .map(c => ({
      ...mapChartAccountToDisplay(c),
      type: 'expense'
    }));

  return {
    allAccounts,
    bankAccounts,
    creditCards,
    transactionalAccounts,
    assets,
    liabilities,
    equity,
    chartAccounts,
    categories: chartAccounts,
    incomeCategories,
    expenseCategories,
    getTypeDetailDisplay,
    isLoading,
  };
}
