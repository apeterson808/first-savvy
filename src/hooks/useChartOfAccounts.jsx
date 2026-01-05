import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts, getChartOfAccountsTemplates } from '@/api/chartOfAccounts';

export function useChartOfAccounts(classFilter = null, options = {}) {
  const { activeProfile } = useProfile();
  const { includeInactive = false, onlyActive = true } = options;

  return useQuery({
    queryKey: ['user-chart-of-accounts', activeProfile?.id, classFilter, includeInactive, onlyActive],
    queryFn: async () => {
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
    staleTime: 30000,
    refetchOnMount: true,
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

export function useChartOfAccountsTemplates(classFilter = null) {
  return useQuery({
    queryKey: ['chart-of-accounts-templates', classFilter],
    queryFn: async () => {
      const templates = await getChartOfAccountsTemplates();

      if (classFilter) {
        return templates.filter(template => template.class === classFilter);
      }

      return templates;
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });
}

export function useTemplateAccountTypesByClass(classFilter) {
  const { data: templates = [], isLoading, error } = useChartOfAccountsTemplates(classFilter);

  const accountTypes = [...new Set(
    templates
      .map(template => template.account_type)
      .filter(Boolean)
  )].sort();

  return {
    accountTypes,
    isLoading,
    error,
    templates
  };
}

export function useTemplateAccountDetailsByType(classFilter, accountType) {
  const { data: templates = [], isLoading, error } = useChartOfAccountsTemplates(classFilter);

  const accountDetails = templates
    .filter(template => template.account_type === accountType)
    .map(template => template.account_detail)
    .filter(Boolean)
    .filter((detail, index, self) => self.indexOf(detail) === index)
    .sort();

  return {
    accountDetails,
    isLoading,
    error
  };
}
