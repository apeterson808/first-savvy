import React, { useState } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Sparkles } from 'lucide-react';
import { getIncomeAccounts, getExpenseAccounts, getDisplayName } from '@/api/chartOfAccounts';
import AccountCreationWizard from '@/components/banking/AccountCreationWizard';

export default function CategoryDropdown({
  value,
  onValueChange,
  transactionType = 'expense',
  aiSuggestionId,
  disabled = false,
  onAddNew,
  triggerClassName = "h-7 border-slate-300",
  placeholder = "Select category",
  isTransactionTransfer = false,
  transactionAmount = 0
}) {
  const { activeProfile } = useProfile();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [wizardInitialName, setWizardInitialName] = useState('');

  const accountType = transactionType === 'income' ? 'income' : 'expense';

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts', accountType, activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile) return [];
      if (accountType === 'income') {
        return await getIncomeAccounts(activeProfile.id);
      } else {
        return await getExpenseAccounts(activeProfile.id);
      }
    },
    enabled: !!activeProfile && !isTransactionTransfer
  });

  const level3Accounts = chartAccounts;

  const transferIncomeAccount = chartAccounts.find(a => a.account_detail === 'Transfer Income');
  const transferExpenseAccount = chartAccounts.find(a => a.account_detail === 'Transfer Expense');

  let availableAccounts = [];
  let currentDisplayValue = value;

  if (isTransactionTransfer) {
    const targetTransferAccount = transactionAmount > 0 ? transferIncomeAccount : transferExpenseAccount;
    if (targetTransferAccount) {
      availableAccounts = [targetTransferAccount];
      currentDisplayValue = targetTransferAccount.id;
    }
  } else {
    availableAccounts = level3Accounts;
  }

  const suggestedAccount = aiSuggestionId ? availableAccounts.find(a => a.id === aiSuggestionId) : null;

  if (suggestedAccount && !availableAccounts.find(a => a.id === aiSuggestionId)) {
    availableAccounts = [suggestedAccount, ...availableAccounts];
  }

  const handleOpenChange = (open) => {
    setIsOpen(open);
    if (!open) {
      setSearchTerm('');
    }
  };

  const selectedAccount = availableAccounts.find(a => a.id === currentDisplayValue);
  const displayValue = selectedAccount
    ? getDisplayName(selectedAccount)
    : placeholder;

  return (
    <>
      <ClickThroughSelect
        value={currentDisplayValue || ''}
        onValueChange={(val) => {
          if (val === '__add_new__' && onAddNew) {
            setWizardInitialName(searchTerm);
            setShowAddWizard(true);
            setIsOpen(false);
            return;
          }
          onValueChange?.(val);
        }}
        onOpenChange={handleOpenChange}
        onSearchTermChange={setSearchTerm}
        placeholder={placeholder}
        triggerClassName={`${triggerClassName} ${disabled || isTransactionTransfer ? 'opacity-50 pointer-events-none' : ''}`}
        enableSearch={true}
        disabled={disabled || isTransactionTransfer}
        displayValue={displayValue}
      >
      {onAddNew && (
        <ClickThroughSelectItem value="__add_new__" className="text-blue-600 font-medium whitespace-nowrap" isAction>
          + Add new category{searchTerm ? `: "${searchTerm}"` : ''}
        </ClickThroughSelectItem>
      )}
      {suggestedAccount && (
        <ClickThroughSelectItem
          key={`suggested-${suggestedAccount.id}`}
          value={suggestedAccount.id}
          isRecommended={true}
          data-display={getDisplayName(suggestedAccount)}
          className="flex items-center justify-between whitespace-nowrap"
        >
          <span className="truncate">
            {getDisplayName(suggestedAccount)}
          </span>
          <Sparkles className="w-3 h-3 text-blue-500 ml-2 flex-shrink-0" />
        </ClickThroughSelectItem>
      )}
      {availableAccounts.filter(acc => acc.id !== aiSuggestionId).map((acc) => {
        const displayName = getDisplayName(acc);
        return (
          <ClickThroughSelectItem
            key={acc.id}
            value={acc.id}
            data-display={displayName}
            className="flex items-center justify-between whitespace-nowrap"
          >
            <span className="text-xs text-gray-500 font-mono mr-2">{acc.account_number}</span>
            <span className="truncate flex-1">{displayName}</span>
          </ClickThroughSelectItem>
        );
      })}
      {isTransactionTransfer && availableAccounts.length > 0 && (
        <ClickThroughSelectItem
          key={availableAccounts[0].id}
          value={availableAccounts[0].id}
          data-display="Transfer"
        >
          <span className="truncate">Transfer</span>
        </ClickThroughSelectItem>
      )}
    </ClickThroughSelect>

    <AccountCreationWizard
      open={showAddWizard}
      onOpenChange={(open) => {
        setShowAddWizard(open);
        if (!open) {
          setWizardInitialName('');
        }
      }}
      initialAccountType="budget"
      initialSubtype={transactionType}
      initialCategoryName={wizardInitialName}
      onAccountCreated={async (result) => {
        setWizardInitialName('');

        if (result?.account && onValueChange) {
          await queryClient.refetchQueries({
            queryKey: ['chart-accounts', accountType, activeProfile?.id]
          });
          onValueChange(result.account.id);
        }
      }}
    />
    </>
  );
}
