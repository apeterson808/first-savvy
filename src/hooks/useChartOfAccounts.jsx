import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';

export function useChartOfAccounts(classFilter = null, options = {}) {
  const { activeProfile } = useProfile();
  const { includeInactive = false, onlyActive = true } = options;

  return useQuery({
    queryKey: ['user-chart-of-accounts', activeProfile?.id, classFilter, includeInactive, onlyActive],
    queryFn: async () => {
      if (!activeProfile?.id) return [];

      const filters = {};

      if (onlyActive && !includeInactive) {
        filters.isActive = true;
      }

      if (classFilter) {
        filters.class = classFilter;
      }

      return await getUserChartOfAccounts(activeProfile.id, filters);
    },
    enabled: !!activeProfile?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccountTypesByClass(classFilter) {
  const { data: chartAccounts = [], isLoading, error } = useChartOfAccounts(classFilter);

  const accountTypes = [...new Set(
    chartAccounts
      .map(account => account.account_type)
      .filter(Boolean)
  )].sort();

  return {
    accountTypes,
    isLoading,
    error,
    chartAccounts
  };
}

export function useAccountDetailsByType(classFilter, accountType) {
  const { data: chartAccounts = [], isLoading, error } = useChartOfAccounts(classFilter);

  const accountDetails = chartAccounts
    .filter(account => account.account_type === accountType)
    .map(account => account.account_detail)
    .filter(Boolean)
    .filter((detail, index, self) => self.indexOf(detail) === index)
    .sort();

  return {
    accountDetails,
    isLoading,
    error
  };
}

export function useChartAccountsByTypeAndDetail(classFilter, accountType, accountDetail) {
  const { data: chartAccounts = [], isLoading, error } = useChartOfAccounts(classFilter);

  const matchingAccounts = chartAccounts.filter(account => {
    if (accountType && account.account_type !== accountType) return false;
    if (accountDetail && account.account_detail !== accountDetail) return false;
    return true;
  });

  return {
    accounts: matchingAccounts,
    isLoading,
    error
  };
}
