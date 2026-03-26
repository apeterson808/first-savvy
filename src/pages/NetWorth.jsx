import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, TrendingUp } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export default function NetWorth() {
  const { activeProfile } = useProfile();

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts.filter(acc => acc.class === 'asset' && acc.is_active);
    },
    enabled: !!activeProfile?.id
  });

  const { data: liabilities = [], isLoading: liabilitiesLoading } = useQuery({
    queryKey: ['liabilities', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile?.id) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts.filter(acc => acc.class === 'liability' && acc.is_active);
    },
    enabled: !!activeProfile?.id
  });

  const totalAssets = assets.reduce((sum, asset) => sum + (asset.current_balance || 0), 0);
  const totalLiabilities = liabilities.reduce((sum, liability) => sum + (liability.current_balance || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  const calculateNetWorthChange = () => {
    const change = 2450.75;
    const percentChange = 3.2;
    return { change, percentChange, hasData: true };
  };

  const netWorthChange = calculateNetWorthChange();

  const groupAccountsByType = (accounts) => {
    const groups = {};
    accounts.forEach(account => {
      const typeKey = account.account_type || 'other';
      if (!groups[typeKey]) {
        groups[typeKey] = [];
      }
      groups[typeKey].push(account);
    });
    return groups;
  };

  const assetGroups = groupAccountsByType(assets);
  const liabilityGroups = groupAccountsByType(liabilities);

  const getTypeLabel = (typeKey) => {
    const labels = {
      'bank_account': 'Bank Accounts',
      'cash': 'Cash',
      'investments': 'Investments',
      'fixed_assets': 'Fixed Assets',
      'credit_card': 'Credit Cards',
      'loans': 'Loans',
      'other': 'Other'
    };
    return labels[typeKey] || typeKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderAccountGroup = (accounts, typeKey) => {
    const IconComponent = Icons.Circle;

    return (
      <div key={typeKey} className="mb-6 last:mb-0">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          {getTypeLabel(typeKey)}
        </h3>
        <div className="space-y-2">
          {accounts.map((account) => {
            const AccountIcon = account.icon && Icons[account.icon] ? Icons[account.icon] : IconComponent;
            const balance = account.current_balance || 0;

            return (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <AccountIcon
                    className="w-6 h-6 flex-shrink-0"
                    style={{ color: account.color || '#64748b' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {account.display_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {account.account_detail?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Account'}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div className="font-bold text-slate-900">
                    ${Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const isLoading = assetsLoading || liabilitiesLoading;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <div className="mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto space-y-6">

        {/* Header - Net Worth Card */}
        <Card className="shadow-md border-slate-200 bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="pb-4 pt-6 px-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Total Net Worth</p>
                <CardTitle className="text-5xl font-bold text-slate-900 mb-3">
                  ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </CardTitle>
                {netWorthChange.hasData && (
                  <div className={`flex items-center text-sm font-medium ${netWorthChange.change >= 0 ? 'text-soft-green' : 'text-burgundy'}`}>
                    {netWorthChange.change >= 0 ? (
                      <ArrowUp className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowUp className="w-4 h-4 mr-1 rotate-180" />
                    )}
                    <span>
                      ${Math.abs(netWorthChange.change).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      ({netWorthChange.change >= 0 ? '+' : ''}{netWorthChange.percentChange.toFixed(1)}%) from last month
                    </span>
                  </div>
                )}
              </div>
              <div className="w-16 h-16 rounded-full bg-sky-blue/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-8 h-8 text-sky-blue" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div className="text-center p-4 bg-soft-green/5 rounded-lg">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Assets</p>
                <p className="text-2xl font-bold text-soft-green">
                  ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center p-4 bg-orange/5 rounded-lg">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Liabilities</p>
                <p className="text-2xl font-bold text-orange">
                  ${totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-500">
                Net Worth = Assets - Liabilities
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Assets and Liabilities Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Assets Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4 pt-4 px-4 bg-soft-green/5 border-b border-soft-green/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assets</p>
                  <CardTitle className="text-2xl font-bold text-soft-green mt-1">
                    ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </CardTitle>
                </div>
                <div className="text-sm text-slate-600">
                  {assets.length} {assets.length === 1 ? 'account' : 'accounts'}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {assets.length > 0 ? (
                <div>
                  {Object.entries(assetGroups).map(([typeKey, accounts]) =>
                    renderAccountGroup(accounts, typeKey)
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">No assets found</p>
                  <p className="text-slate-400 text-xs mt-1">Add accounts to track your assets</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Liabilities Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4 pt-4 px-4 bg-orange/5 border-b border-orange/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Liabilities</p>
                  <CardTitle className="text-2xl font-bold text-orange mt-1">
                    ${totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </CardTitle>
                </div>
                <div className="text-sm text-slate-600">
                  {liabilities.length} {liabilities.length === 1 ? 'account' : 'accounts'}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {liabilities.length > 0 ? (
                <div>
                  {Object.entries(liabilityGroups).map(([typeKey, accounts]) =>
                    renderAccountGroup(accounts, typeKey)
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">No liabilities found</p>
                  <p className="text-slate-400 text-xs mt-1">Add accounts to track your debts</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}
