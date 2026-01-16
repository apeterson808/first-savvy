import React, { useState } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClickThroughSelect, ClickThroughSelectItem, ClickThroughSelectSeparator } from '@/components/ui/ClickThroughSelect';
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
  const [wizardType, setWizardType] = useState('expense');

  const { data: incomeAccounts = [] } = useQuery({
    queryKey: ['chart-accounts', 'income', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile) return [];
      return await getIncomeAccounts(activeProfile.id);
    },
    enabled: !!activeProfile && !isTransactionTransfer
  });

  const { data: expenseAccounts = [] } = useQuery({
    queryKey: ['chart-accounts', 'expense', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile) return [];
      return await getExpenseAccounts(activeProfile.id);
    },
    enabled: !!activeProfile && !isTransactionTransfer
  });

  const transferIncomeAccount = incomeAccounts.find(a => a.account_detail === 'Transfer Income');
  const transferExpenseAccount = expenseAccounts.find(a => a.account_detail === 'Transfer Expense');

  let currentDisplayValue = value;

  if (isTransactionTransfer) {
    const targetTransferAccount = transactionAmount > 0 ? transferIncomeAccount : transferExpenseAccount;
    if (targetTransferAccount) {
      currentDisplayValue = targetTransferAccount.id;
    }
  }

  const allAccounts = [...incomeAccounts, ...expenseAccounts];
  const suggestedAccount = aiSuggestionId ? allAccounts.find(a => a.id === aiSuggestionId) : null;

  const handleOpenChange = (open) => {
    setIsOpen(open);
    if (!open) {
      setSearchTerm('');
    }
  };

  const selectedAccount = allAccounts.find(a => a.id === currentDisplayValue);
  const displayValue = selectedAccount
    ? getDisplayName(selectedAccount)
    : placeholder;

  return (
    <>
      <ClickThroughSelect
        value={currentDisplayValue || ''}
        onValueChange={(val) => {
          if (val === '__add_new_income__' && onAddNew) {
            setWizardInitialName(searchTerm);
            setWizardType('income');
            setShowAddWizard(true);
            setIsOpen(false);
            return;
          }
          if (val === '__add_new_expense__' && onAddNew) {
            setWizardInitialName(searchTerm);
            setWizardType('expense');
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
        <>
          <ClickThroughSelectItem value="__add_new_income__" className="text-blue-600 font-medium whitespace-nowrap" isAction>
            + Add new income{searchTerm ? `: "${searchTerm}"` : ''}
          </ClickThroughSelectItem>
          <ClickThroughSelectItem value="__add_new_expense__" className="text-blue-600 font-medium whitespace-nowrap" isAction>
            + Add new expense{searchTerm ? `: "${searchTerm}"` : ''}
          </ClickThroughSelectItem>
          <ClickThroughSelectSeparator />
        </>
      )}
      {suggestedAccount && (
        <>
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
          <ClickThroughSelectSeparator />
        </>
      )}

      {incomeAccounts.length > 0 && (
        <>
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0 z-10">
            Income
          </div>
          {incomeAccounts.filter(acc => acc.id !== aiSuggestionId).map((acc) => {
            const displayName = getDisplayName(acc);
            return (
              <ClickThroughSelectItem
                key={acc.id}
                value={acc.id}
                data-display={displayName}
                className="flex items-center justify-between whitespace-nowrap"
              >
                <span className="truncate flex-1">{displayName}</span>
              </ClickThroughSelectItem>
            );
          })}
        </>
      )}

      {expenseAccounts.length > 0 && (
        <>
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0 z-10">
            Expenses
          </div>
          {expenseAccounts.filter(acc => acc.id !== aiSuggestionId).map((acc) => {
            const displayName = getDisplayName(acc);
            return (
              <ClickThroughSelectItem
                key={acc.id}
                value={acc.id}
                data-display={displayName}
                className="flex items-center justify-between whitespace-nowrap"
              >
                <span className="truncate flex-1">{displayName}</span>
              </ClickThroughSelectItem>
            );
          })}
        </>
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
      initialSubtype={wizardType}
      initialCategoryName={wizardInitialName}
      onAccountCreated={(result) => {
        setWizardInitialName('');

        if (result?.account && onValueChange) {
          onValueChange(result.account.id);
        }
      }}
    />
    </>
  );
}
