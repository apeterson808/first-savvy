import React, { useState } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClickThroughSelect, ClickThroughSelectItem, ClickThroughSelectSeparator } from '@/components/ui/ClickThroughSelect';
import { Sparkles } from 'lucide-react';
import { getIncomeAccounts, getExpenseAccounts, getDisplayName } from '@/api/chartOfAccounts';
import { getIconComponent } from '@/components/utils/iconMapper';
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

  // Build hierarchy for accounts
  const buildHierarchy = (accounts) => {
    const parents = accounts.filter(acc => !acc.parent_account_id);
    return parents.map(parent => ({
      ...parent,
      children: accounts.filter(acc => acc.parent_account_id === parent.id)
        .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
    })).sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
  };

  const incomeHierarchy = buildHierarchy(incomeAccounts);
  const expenseHierarchy = buildHierarchy(expenseAccounts);

  const selectedAccount = allAccounts.find(a => a.id === currentDisplayValue);
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
        <>
          <ClickThroughSelectItem value="__add_new__" className="text-blue-600 font-medium whitespace-nowrap" isAction>
            + Add new{searchTerm ? `: "${searchTerm}"` : ''}
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
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
            Income
          </div>
          {incomeHierarchy.filter(acc => acc.id !== aiSuggestionId).map((parent) => {
            const displayName = getDisplayName(parent);
            const IconComponent = getIconComponent(parent.icon);
            return (
              <React.Fragment key={parent.id}>
                <ClickThroughSelectItem
                  value={parent.id}
                  data-display={displayName}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <IconComponent
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: parent.color }}
                  />
                  <span className="truncate flex-1">{displayName}</span>
                </ClickThroughSelectItem>
                {parent.children && parent.children.length > 0 && parent.children.filter(child => child.id !== aiSuggestionId).map((child) => {
                  const childDisplayName = getDisplayName(child);
                  const ChildIcon = getIconComponent(child.icon);
                  return (
                    <ClickThroughSelectItem
                      key={child.id}
                      value={child.id}
                      data-display={childDisplayName}
                      className="flex items-center gap-2 whitespace-nowrap pl-6"
                    >
                      <ChildIcon
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: child.color }}
                      />
                      <span className="truncate flex-1">{childDisplayName}</span>
                    </ClickThroughSelectItem>
                  );
                })}
              </React.Fragment>
            );
          })}
        </>
      )}

      {expenseAccounts.length > 0 && (
        <>
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
            Expenses
          </div>
          {expenseHierarchy.filter(acc => acc.id !== aiSuggestionId).map((parent) => {
            const displayName = getDisplayName(parent);
            const IconComponent = getIconComponent(parent.icon);
            return (
              <React.Fragment key={parent.id}>
                <ClickThroughSelectItem
                  value={parent.id}
                  data-display={displayName}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <IconComponent
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: parent.color }}
                  />
                  <span className="truncate flex-1">{displayName}</span>
                </ClickThroughSelectItem>
                {parent.children && parent.children.length > 0 && parent.children.filter(child => child.id !== aiSuggestionId).map((child) => {
                  const childDisplayName = getDisplayName(child);
                  const ChildIcon = getIconComponent(child.icon);
                  return (
                    <ClickThroughSelectItem
                      key={child.id}
                      value={child.id}
                      data-display={childDisplayName}
                      className="flex items-center gap-2 whitespace-nowrap pl-6"
                    >
                      <ChildIcon
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: child.color }}
                      />
                      <span className="truncate flex-1">{childDisplayName}</span>
                    </ClickThroughSelectItem>
                  );
                })}
              </React.Fragment>
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
      initialSubtype={transactionType}
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
