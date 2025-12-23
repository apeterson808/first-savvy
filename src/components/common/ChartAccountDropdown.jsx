import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { getIncomeAccounts, getExpenseAccounts, getFullDisplayName } from '@/api/chartOfAccounts';
import { Plus } from 'lucide-react';

export default function ChartAccountDropdown({
  value,
  onValueChange,
  accountType = 'expense',
  disabled = false,
  onAddNew,
  triggerClassName = "h-7 border-slate-300",
  placeholder = "Select account"
}) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ['chart-accounts', accountType, user?.id],
    queryFn: async () => {
      if (accountType === 'income') {
        return await getIncomeAccounts(user.id);
      } else {
        return await getExpenseAccounts(user.id);
      }
    },
    enabled: !!user
  });

  const level3Accounts = accounts.filter(a => a.level === 3);

  const filteredAccounts = searchTerm
    ? level3Accounts.filter(account => {
        const displayName = getFullDisplayName(account).toLowerCase();
        return displayName.includes(searchTerm.toLowerCase());
      })
    : level3Accounts;

  const sortedAccounts = [...filteredAccounts].sort((a, b) =>
    a.account_number - b.account_number
  );

  const selectedAccount = level3Accounts.find(a => a.id === value);

  return (
    <ClickThroughSelect
      value={value || ''}
      onValueChange={onValueChange}
      disabled={disabled}
      open={isOpen}
      onOpenChange={setIsOpen}
      triggerClassName={triggerClassName}
      displayValue={selectedAccount ? getFullDisplayName(selectedAccount) : placeholder}
      searchable={true}
      searchPlaceholder={`Search ${accountType} accounts...`}
      onSearchChange={setSearchTerm}
      searchTerm={searchTerm}
    >
      {sortedAccounts.map((account) => (
        <ClickThroughSelectItem
          key={account.id}
          value={account.id}
          className="flex items-center gap-2"
        >
          <span className="font-mono text-xs text-gray-500">{account.account_number}</span>
          <span className="flex-1">
            {account.custom_display_name || account.category || account.display_name_default}
          </span>
          {account.is_user_created && (
            <span className="text-xs text-gray-400">Custom</span>
          )}
        </ClickThroughSelectItem>
      ))}

      {sortedAccounts.length === 0 && searchTerm && (
        <div className="p-2 text-sm text-gray-500 text-center">
          No accounts found
        </div>
      )}

      {onAddNew && (
        <>
          <div className="h-px bg-gray-200 my-1" />
          <ClickThroughSelectItem
            value="__add_new__"
            onSelect={(e) => {
              e.preventDefault();
              setIsOpen(false);
              onAddNew();
            }}
            className="text-blue-600 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add new {accountType} category
          </ClickThroughSelectItem>
        </>
      )}
    </ClickThroughSelect>
  );
}
