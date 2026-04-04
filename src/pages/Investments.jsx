import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/PageTabs';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, Wallet, Bitcoin, PiggyBank } from 'lucide-react';
import AccountCreationWizard from '../components/banking/AccountCreationWizard';
import { formatCurrency } from '../components/utils/formatters';

export default function Investments() {
  const { activeProfile } = useProfile();
  const urlParams = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState(urlParams.get('tab') || 'overview');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDefaultType, setWizardDefaultType] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const syncTabWithUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const newTab = urlParams.get('tab') || 'overview';
      setActiveTab(newTab);
    };

    window.addEventListener('popstate', syncTabWithUrl);

    return () => {
      window.removeEventListener('popstate', syncTabWithUrl);
    };
  }, []);

  React.useEffect(() => {
    const handleProfileSwitch = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener('profileSwitched', handleProfileSwitch);
    return () => window.removeEventListener('profileSwitched', handleProfileSwitch);
  }, [queryClient]);

  const profileIdToUse = activeProfile?.id;

  const { data: chartAccounts = [], isLoading } = useQuery({
    queryKey: ['chartAccounts', profileIdToUse],
    queryFn: async () => {
      if (!profileIdToUse) return [];
      const accounts = await getUserChartOfAccounts(profileIdToUse);
      return accounts.filter(a => a.is_active && a.account_type === 'investments');
    },
    enabled: !!profileIdToUse,
    staleTime: 30000
  });

  const brokerageAccounts = chartAccounts.filter(acc => acc.account_detail === 'brokerage_account');
  const cryptoAccounts = chartAccounts.filter(acc => acc.account_detail === 'crypto_wallet');
  const retirementAccounts = chartAccounts.filter(acc =>
    ['account_401k', 'traditional_ira', 'roth_ira'].includes(acc.account_detail)
  );

  const totalInvestments = chartAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
  const totalStocksRetirement = [...brokerageAccounts, ...retirementAccounts].reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
  const totalCrypto = cryptoAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

  const openWizard = (type = null) => {
    setWizardDefaultType(type);
    setWizardOpen(true);
  };

  return (
    <div className="p-4 md:p-6">
      <PageTabs tabs={['overview', 'stocks', 'crypto']} defaultTab="overview" />
      <Tabs value={activeTab} className="w-full">

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Total Investments</p>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalInvestments)}</p>
                    <p className="text-xs text-slate-500 mt-1">{chartAccounts.length} accounts</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Stocks & Retirement</p>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalStocksRetirement)}</p>
                    <p className="text-xs text-slate-500 mt-1">{brokerageAccounts.length + retirementAccounts.length} accounts</p>
                  </div>
                  <PiggyBank className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Crypto</p>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalCrypto)}</p>
                    <p className="text-xs text-slate-500 mt-1">{cryptoAccounts.length} wallets</p>
                  </div>
                  <Bitcoin className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {chartAccounts.length === 0 && !isLoading && (
            <Card className="shadow-sm border-slate-200">
              <CardContent className="p-8 text-center">
                <Wallet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">No investment accounts yet</p>
                <Button onClick={() => openWizard('investments')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Investment Account
                </Button>
              </CardContent>
            </Card>
          )}

          {chartAccounts.length > 0 && (
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Performance</p>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-64 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p>Performance tracking coming soon</p>
                    <p className="text-xs text-slate-400 mt-2">Connect your accounts to see investment performance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="stocks" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Stocks & Retirement Accounts</h3>
            <Button onClick={() => openWizard('investments')} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </div>

          {brokerageAccounts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Brokerage Accounts</h4>
              {brokerageAccounts.map((account) => (
                <Card key={account.id} className="shadow-sm border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{account.display_name || account.account_name}</p>
                          {account.institution_name && (
                            <p className="text-xs text-slate-500">{account.institution_name}</p>
                          )}
                          {account.account_number_last4 && (
                            <p className="text-xs text-slate-400">••••{account.account_number_last4}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-slate-900">{formatCurrency(account.current_balance || 0)}</p>
                        <p className="text-xs text-slate-500">Holdings coming soon</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {retirementAccounts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Retirement Accounts</h4>
              {retirementAccounts.map((account) => (
                <Card key={account.id} className="shadow-sm border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <PiggyBank className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{account.display_name || account.account_name}</p>
                          <p className="text-xs text-slate-500">
                            {account.account_detail === 'account_401k' && '401(k)'}
                            {account.account_detail === 'traditional_ira' && 'Traditional IRA'}
                            {account.account_detail === 'roth_ira' && 'Roth IRA'}
                          </p>
                          {account.institution_name && (
                            <p className="text-xs text-slate-400">{account.institution_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-slate-900">{formatCurrency(account.current_balance || 0)}</p>
                        <p className="text-xs text-slate-500">Holdings coming soon</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {brokerageAccounts.length === 0 && retirementAccounts.length === 0 && (
            <Card className="shadow-sm border-slate-200">
              <CardContent className="p-8 text-center">
                <PiggyBank className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">No stocks or retirement accounts yet</p>
                <Button onClick={() => openWizard('investments')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Account
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="crypto" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Crypto Wallets</h3>
            <Button onClick={() => openWizard('investments')} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Wallet
            </Button>
          </div>

          {cryptoAccounts.length > 0 && (
            <div className="space-y-3">
              {cryptoAccounts.map((account) => (
                <Card key={account.id} className="shadow-sm border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <Bitcoin className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{account.display_name || account.account_name}</p>
                          {account.institution_name && (
                            <p className="text-xs text-slate-500">{account.institution_name}</p>
                          )}
                          {account.account_number_last4 && (
                            <p className="text-xs text-slate-400">••••{account.account_number_last4}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-slate-900">{formatCurrency(account.current_balance || 0)}</p>
                        <p className="text-xs text-slate-500">Holdings coming soon</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {cryptoAccounts.length === 0 && (
            <Card className="shadow-sm border-slate-200">
              <CardContent className="p-8 text-center">
                <Bitcoin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">No crypto wallets yet</p>
                <Button onClick={() => openWizard('investments')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Wallet
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>

      <AccountCreationWizard
        isOpen={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setWizardDefaultType(null);
        }}
        defaultType={wizardDefaultType}
      />
    </div>
  );
}
