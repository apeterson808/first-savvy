import React from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery } from '@tanstack/react-query';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { getAccountDisplayName } from '../utils/constants';

export default function AccountDropdown({
  value,
  onValueChange,
  showAllOption = true,
  showPendingCounts = false,
  transactions = [],
  triggerClassName = "w-64 h-9 hover:bg-slate-50",
  placeholder = "Select account",
  accounts: propAccounts = null
}) {
  const shouldFetchOwnAccounts = !propAccounts || propAccounts.length === 0;

  const { data: fetchedAccounts = [], isLoading } = useQuery({
    queryKey: ['activeAccounts'],
    queryFn: async () => {
      const allAccounts = await firstsavvy.entities.ChartAccount.filter({ is_active: true });
      return allAccounts.map(acc => ({
        ...acc,
        account_number: acc.account_number_last4,
        entityType: acc.account_detail === 'credit_card' ? 'CreditCard' : 'BankAccount',
        name: acc.display_name,
        account_name: acc.display_name,
        account_type: acc.account_detail,
        institution: acc.institution_name,
        institution_name: acc.institution_name
      }));
    },
    enabled: shouldFetchOwnAccounts
  });

  const accounts = (propAccounts && propAccounts.length > 0) ? propAccounts : fetchedAccounts;

  const filteredAccounts = accounts.filter(acc => {
    if (acc.is_active === false) return false;

    // Only show bank accounts (checking, savings) and credit cards
    const isCheckingOrSavings = acc.class === 'asset' &&
      ['checking_account', 'savings_account'].includes(acc.account_detail);
    const isCreditCard = acc.class === 'liability' &&
      (acc.account_detail === 'credit_card' || acc.account_type === 'credit_cards');

    return isCheckingOrSavings || isCreditCard;
  });

  const activeAccountIds = accounts.map(a => a.id);

  if (isLoading && !propAccounts) {
    return (
      <div className={triggerClassName}>
        <span className="text-slate-400 text-xs">Loading accounts...</span>
      </div>
    );
  }

  const getPendingCount = (accountId) => {
    if (!showPendingCounts) return 0;
    if (accountId === 'all') {
      return transactions.filter(t =>
        (t.status === 'pending' || !t.status) &&
        activeAccountIds.includes(t.bank_account_id)
      ).length;
    }
    return transactions.filter(t =>
      t.bank_account_id === accountId &&
      (t.status === 'pending' || !t.status)
    ).length;
  };

  const renderValue = (selectedValue, displayText) => {
    if (!showPendingCounts) return <span className="truncate">{displayText}</span>;
    
    const count = getPendingCount(selectedValue);
    return (
      <div className="flex items-center justify-between w-full">
        <span className="truncate">{displayText}</span>
        {count > 0 && (
          <span className="ml-2 bg-red-500 text-white rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-semibold">
            {count}
          </span>
        )}
      </div>
    );
  };

  return (
    <ClickThroughSelect
      value={value}
      onValueChange={(val) => onValueChange(val || null)}
      triggerClassName={triggerClassName}
      placeholder={placeholder}
      renderValue={showPendingCounts ? renderValue : undefined}
      enableSearch={false}
    >
      {showAllOption && (
        <ClickThroughSelectItem value="all" data-display="All Accounts">
          <div className="flex items-center justify-between w-full">
            <span>All Accounts</span>
            {showPendingCounts && (() => {
              const count = getPendingCount('all');
              return count > 0 ? (
                <span className="ml-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-semibold">
                  {count}
                </span>
              ) : null;
            })()}
          </div>
        </ClickThroughSelectItem>
      )}
      {filteredAccounts.map(acc => {
        const pendingCount = getPendingCount(acc.id);
        const displayName = getAccountDisplayName(acc);
        const fullDisplayText = `${displayName}${acc.account_number ? ` (${acc.account_number})` : ''}`;
        return (
          <ClickThroughSelectItem key={acc.id} value={acc.id} data-display={fullDisplayText}>
            <div className="flex items-center justify-between w-full">
              <span>{fullDisplayText}</span>
              {showPendingCounts && pendingCount > 0 && (
                <span className="ml-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-semibold">
                  {pendingCount}
                </span>
              )}
            </div>
          </ClickThroughSelectItem>
        );
      })}
    </ClickThroughSelect>
  );
}