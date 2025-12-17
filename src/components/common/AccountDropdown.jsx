import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { getAccountDisplayName } from '../utils/constants';

export default function AccountDropdown({ 
  value, 
  onValueChange, 
  showAllOption = true,
  showPendingCounts = false,
  transactions = [],
  excludeInvestment = true,
  triggerClassName = "w-64 h-9 hover:bg-slate-50",
  placeholder = "Select account",
  accounts: propAccounts = null
}) {
  const { data: fetchedAccounts = [] } = useQuery({
    queryKey: ['activeAccounts'],
    queryFn: async () => {
      const [bankAccounts, creditCards] = await Promise.all([
        base44.entities.BankAccount.filter({ is_active: true }),
        base44.entities.CreditCard.filter({ is_active: true })
      ]);
      const filteredBankAccounts = bankAccounts.filter(a => a.account_type !== 'credit_card');
      return [...filteredBankAccounts, ...creditCards.map(cc => ({ ...cc, account_name: cc.name }))];
    },
    enabled: propAccounts === null
  });

  const accounts = propAccounts !== null ? propAccounts : fetchedAccounts;

  console.log('AccountDropdown Debug:', {
    propAccounts,
    fetchedAccounts,
    accounts,
    accountsLength: accounts.length
  });

  const filteredAccounts = excludeInvestment
    ? accounts.filter(acc => acc.account_type !== 'investment' && acc.is_active !== false)
    : accounts.filter(acc => acc.is_active !== false);

  console.log('Filtered accounts:', filteredAccounts.length, filteredAccounts);

  const activeAccountIds = accounts.map(a => a.id);

  const getPendingCount = (accountId) => {
    if (!showPendingCounts) return 0;
    if (accountId === 'all') {
      return transactions.filter(t => 
        (t.status === 'pending' || !t.status) && activeAccountIds.includes(t.bank_account_id)
      ).length;
    }
    return transactions.filter(t => 
      t.bank_account_id === accountId && (t.status === 'pending' || !t.status)
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
    <>
      {/* Temporary Debug Info */}
      <div className="text-xs text-red-600 mb-1">
        DEBUG: {accounts.length} total, {filteredAccounts.length} filtered
      </div>
      <ClickThroughSelect
        value={value}
        onValueChange={onValueChange}
        triggerClassName={triggerClassName}
        placeholder={placeholder}
        renderValue={showPendingCounts ? renderValue : undefined}
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
    </>
  );
}