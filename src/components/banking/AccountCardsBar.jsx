import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { getAccountDisplayName } from '../utils/constants';

export default function AccountCardsBar({
  value,
  onValueChange,
  transactions = [],
  accounts: propAccounts = null
}) {
  const shouldFetchOwnAccounts = !propAccounts || propAccounts.length === 0;

  const { data: fetchedAccounts = [], isLoading } = useQuery({
    queryKey: ['activeAccounts'],
    queryFn: async () => {
      const bankAccounts = await base44.entities.BankAccount.filter({ is_active: true });
      const creditCards = await base44.entities.CreditCard.filter({ is_active: true });
      return [
        ...bankAccounts.map(acc => ({ ...acc, entityType: 'BankAccount' })),
        ...creditCards.map(cc => ({
          ...cc,
          account_name: cc.name,
          account_number: cc.last_four || cc.account_number_masked,
          account_type: 'credit_card',
          entityType: 'CreditCard'
        }))
      ];
    },
    enabled: shouldFetchOwnAccounts
  });

  const accounts = (propAccounts && propAccounts.length > 0) ? propAccounts : fetchedAccounts;

  const filteredAccounts = accounts.filter(acc =>
    acc.account_type !== 'investment' && acc.is_active !== false
  );

  const activeAccountIds = accounts.map(a => a.id);

  const getPendingCount = (accountId) => {
    if (accountId === 'all') {
      return transactions.filter(t =>
        (t.status === 'pending' || !t.status) &&
        (activeAccountIds.includes(t.bank_account_id) || activeAccountIds.includes(t.credit_card_id))
      ).length;
    }
    return transactions.filter(t =>
      (t.bank_account_id === accountId || t.credit_card_id === accountId) &&
      (t.status === 'pending' || !t.status)
    ).length;
  };

  if (isLoading && !propAccounts) {
    return (
      <div className="mb-3">
        <div className="flex items-center justify-end mb-2">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 w-40 bg-slate-200 rounded animate-pulse flex-shrink-0"></div>
          ))}
        </div>
      </div>
    );
  }

  const allAccountsPendingCount = getPendingCount('all');
  const isAllSelected = value === 'all';

  return (
    <div className="mb-3">
      <div className="flex items-center justify-end mb-2">
        <label className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={(checked) => {
              if (checked) {
                onValueChange('all');
              }
            }}
            className="h-4 w-4"
          />
          <span className="text-sm text-slate-600 select-none">
            All Accounts
            {allAccountsPendingCount > 0 && (
              <span className="ml-2 bg-red-500 text-white rounded-full min-w-5 h-5 px-1.5 inline-flex items-center justify-center text-[10px] font-semibold">
                {allAccountsPendingCount}
              </span>
            )}
          </span>
        </label>
      </div>

      <div className="relative">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent hover:scrollbar-thumb-slate-400">
          {filteredAccounts.map(acc => {
            const pendingCount = getPendingCount(acc.id);
            const displayName = getAccountDisplayName(acc);
            const last4 = acc.account_number || acc.last_four || '';
            const isSelected = value === acc.id;

            return (
              <button
                key={acc.id}
                onClick={() => onValueChange(acc.id)}
                className={`
                  relative flex-shrink-0 w-40 h-16 rounded-lg border-2 p-3
                  transition-all duration-200 cursor-pointer
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
                  }
                `}
              >
                <div className="flex flex-col items-start justify-between h-full">
                  <div className={`text-sm font-medium truncate w-full text-left ${
                    isSelected ? 'text-blue-700' : 'text-slate-700'
                  }`}>
                    {displayName}
                  </div>
                  {last4 && (
                    <div className={`text-xs truncate w-full text-left ${
                      isSelected ? 'text-blue-600' : 'text-slate-500'
                    }`}>
                      {last4}
                    </div>
                  )}
                </div>
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-semibold shadow-sm">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
