import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Building2, Pencil, Plus, Link2, Car } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { DETAIL_TYPE_LABELS } from '../utils/constants';
import EditAccountDialog from '../banking/EditAccountDialog';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths, subYears, startOfYear, eachMonthOfInterval } from 'date-fns';
import TimeRangeDropdown from '../common/TimeRangeDropdown';
import AccountCreationWizard from '../banking/AccountCreationWizard';
import { getAssetWithLinks } from '@/api/vehiclesAndLoans';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export default function AssetsTab() {
  const [timeRange, setTimeRange] = useState('6');
  const [editingAccount, setEditingAccount] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [accountWizardOpen, setAccountWizardOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleEdit = (account, entityType) => {
    setEditingAccount({ ...account, entityType });
    setSheetOpen(true);
  };
  
  const getDetailTypeLabel = (type) => DETAIL_TYPE_LABELS[type] || type?.replace('_', ' ') || 'Other';

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const allAssets = await firstsavvy.entities.Asset.list();
      return allAssets.filter(a => a.is_active !== false);
    }
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => firstsavvy.entities.BankAccount.filter({ is_active: true })
  });

  const { data: assetLinks = {} } = useQuery({
    queryKey: ['assetLinks'],
    queryFn: async () => {
      const linksMap = {};
      for (const asset of assets) {
        if (asset.type === 'Vehicle') {
          try {
            const assetWithLinks = await getAssetWithLinks(asset.id);
            linksMap[asset.id] = assetWithLinks.linkedLiabilities || [];
          } catch (error) {
            console.error(`Error fetching links for asset ${asset.id}:`, error);
          }
        }
      }
      return linksMap;
    },
    enabled: assets.length > 0,
  });

  const cashAccounts = bankAccounts.filter(a => a.account_type !== 'credit_card');

  // Group all accounts by institution
  const groupByInstitution = () => {
    const groups = {};
    
    cashAccounts.forEach(account => {
      const institution = account.institution || null;
      const instKey = institution || `standalone_${account.id}`;
      if (!groups[instKey]) {
        groups[instKey] = { accounts: [], logo_url: account.logo_url, total: 0, institutionName: institution };
      }
      groups[instKey].accounts.push({ 
        ...account, entityType: 'BankAccount', displayName: account.account_name, 
        value: account.current_balance || 0, detailType: account.account_type
      });
      groups[instKey].total += account.current_balance || 0;
      if (account.logo_url && !groups[instKey].logo_url) groups[instKey].logo_url = account.logo_url;
    });
    
    assets.filter(a => a.type !== 'beginning_balance').forEach(asset => {
      const institution = asset.institution || null;
      const instKey = institution || `standalone_${asset.id}`;
      if (!groups[instKey]) {
        groups[instKey] = { accounts: [], logo_url: asset.logo_url, total: 0, institutionName: institution };
      }

      const linkedLiabilities = assetLinks[asset.id] || [];
      const totalLoanBalance = linkedLiabilities.reduce((sum, link) => sum + (link.liability?.current_balance || 0), 0);
      const netValue = (asset.current_balance || 0) - totalLoanBalance;

      groups[instKey].accounts.push({
        ...asset,
        entityType: 'Asset',
        displayName: asset.name,
        value: asset.current_balance || 0,
        netValue: netValue,
        detailType: asset.type,
        linkedLiabilities: linkedLiabilities,
        hasLoan: linkedLiabilities.length > 0
      });
      groups[instKey].total += asset.current_balance || 0;
      if (asset.logo_url && !groups[instKey].logo_url) groups[instKey].logo_url = asset.logo_url;
    });
    
    return groups;
  };

  const institutionGroups = groupByInstitution();
  const allAccounts = Object.values(institutionGroups).flatMap(g => g.accounts).sort((a, b) => b.value - a.value);
  const selectedAccount = selectedAccountId ? allAccounts.find(a => a.id === selectedAccountId) : null;
  const chartTotal = selectedAccount ? selectedAccount.value : Object.values(institutionGroups).reduce((sum, g) => sum + g.total, 0);
  const totalAssets = Object.values(institutionGroups).reduce((sum, g) => sum + g.total, 0);

  // Generate chart data based on time range
  const generateChartData = () => {
    const today = new Date();
    let startDate;
    
    switch (timeRange) {
      case '1': startDate = subMonths(today, 1); break;
      case '3': startDate = subMonths(today, 3); break;
      case '6': startDate = subMonths(today, 6); break;
      case '12': startDate = subYears(today, 1); break;
      case 'ytd': startDate = startOfYear(today); break;
      case 'all': startDate = subYears(today, 5); break;
      default: startDate = subMonths(today, 6);
    }

    const months = eachMonthOfInterval({ start: startDate, end: today });
    
    return months.map((date, index) => {
      const progress = index / (months.length - 1);
      const baseValue = chartTotal * (0.85 + progress * 0.15);
      const variation = (Math.random() - 0.5) * chartTotal * 0.05;
      
      return {
        date: format(date, 'MMM'),
        fullDate: date,
        value: index === months.length - 1 ? chartTotal : Math.round(baseValue + variation)
      };
    });
  };

  const chartData = generateChartData();
  const startValue = chartData[0]?.value || 0;
  const changeAmount = chartTotal - startValue;

  const formatFullCurrency = (amount) => {
    const isNegative = amount < 0;
    return `${isNegative ? '-' : ''}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };



  return (
    <div className="p-3">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Accounts List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Accounts</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAccountWizardOpen(true)}
              className="h-7"
            >
              <Car className="w-3 h-3 mr-1" />
              Add Vehicle
            </Button>
          </CardHeader>
          <CardContent className="p-0 max-h-[280px] overflow-y-auto">
            {allAccounts.map(account => (
              <div key={account.id}>
                <div
                  className={`flex items-center justify-between px-3 py-1.5 border-b border-slate-100 hover:bg-slate-50 group/row cursor-pointer ${selectedAccountId === account.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedAccountId(selectedAccountId === account.id ? null : account.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {account.logo_url ? (
                      <img src={account.logo_url} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                        {account.type === 'Vehicle' ? <Car className="w-3 h-3 text-slate-400" /> : <Building2 className="w-3 h-3 text-slate-400" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{account.displayName}</p>
                      {account.type === 'Vehicle' && account.hasLoan && (
                        <p className="text-xs text-muted-foreground">
                          Net equity: {formatCurrency(account.netValue)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(account.value)}</p>
                      {account.type === 'Vehicle' && !account.hasLoan && (
                        <Badge variant="outline" className="text-xs">Owned</Badge>
                      )}
                      {account.type === 'Vehicle' && account.hasLoan && (
                        <Badge variant="secondary" className="text-xs">Financed</Badge>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(account, account.entityType);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 opacity-0 group-hover/row:opacity-100 transition-opacity"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {account.type === 'Vehicle' && account.linkedLiabilities?.map(link => (
                  <div key={link.id} className="pl-12 pr-3 py-1 bg-slate-50 border-b border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Link2 className="w-3 h-3" />
                        <span>{link.liability?.name || 'Loan'}</span>
                      </div>
                      <span className="text-red-600">-{formatCurrency(link.liability?.current_balance || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {allAccounts.length === 0 && (
              <p className="text-center text-slate-500 py-8">No assets found</p>
            )}
          </CardContent>
        </Card>

        {/* Right: Chart */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardContent className="pt-4">
            {/* Header with dropdown */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  {selectedAccount ? selectedAccount.displayName : 'Total Assets'}
                </p>
                <p className="text-3xl font-bold text-slate-900">{formatFullCurrency(chartTotal)}</p>
              </div>
              <TimeRangeDropdown value={timeRange} onValueChange={setTimeRange} />
            </div>

            {/* Chart */}
            <div className="h-[200px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b"
                    tick={{ fontSize: 11 }}
                    axisLine={false} 
                    tickLine={false}
                    interval={timeRange === 'all' ? 11 : 0}
                    tickFormatter={(value, index) => {
                      if (timeRange === 'all') {
                        const dataPoint = chartData[index];
                        if (dataPoint?.fullDate) {
                          return format(dataPoint.fullDate, "yyyy");
                        }
                      }
                      return value;
                    }}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{ fontSize: 11 }} 
                    width={45} 
                    tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`} 
                    orientation="right" 
                    axisLine={false} 
                    tickLine={false}
                    domain={[(dataMin) => Math.floor(dataMin / 25000) * 25000, (dataMax) => Math.ceil(dataMax / 25000) * 25000]}
                    ticks={(() => {
                      const min = Math.floor(chartTotal * 0.8 / 25000) * 25000;
                      const max = Math.ceil(chartTotal * 1.1 / 25000) * 25000;
                      const step = 25000;
                      const ticks = [];
                      for (let i = min; i <= max; i += step) ticks.push(i);
                      return ticks;
                    })()}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm text-xs">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-600">{format(data.fullDate, 'MMM d')}</span>
                              <span className="font-medium text-blue-600">{formatFullCurrency(data.value)}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorAssets)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Change indicator */}
            <div className="flex items-center gap-2 mt-4">
              {changeAmount >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm ${changeAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {changeAmount >= 0 ? 'Up' : 'Down'} {formatFullCurrency(Math.abs(changeAmount))} over the last {timeRange === '1' ? 'month' : timeRange === '3' ? '3 months' : timeRange === '6' ? '6 months' : timeRange === '12' ? 'year' : timeRange === 'ytd' ? 'year to date' : 'all time'}
              </span>
            </div>
          </CardContent>
        </Card>
        </div>

      <EditAccountDialog
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setEditingAccount(null);
          }
        }}
        account={editingAccount}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['assets'] });
          queryClient.invalidateQueries({ queryKey: ['bankAccounts'] });
        }}
      />

      <AccountCreationWizard
        open={accountWizardOpen}
        onOpenChange={setAccountWizardOpen}
        onAccountCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['assets'] });
          queryClient.invalidateQueries({ queryKey: ['assetLinks'] });
          queryClient.invalidateQueries({ queryKey: ['liabilities'] });
          queryClient.invalidateQueries({ queryKey: ['liabilityLinks'] });
        }}
      />
    </div>
  );
}