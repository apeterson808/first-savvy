import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Sparkles } from 'lucide-react';
import { getAccountDisplayName } from '../utils/constants';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name', 1000)
  });

  const transferIncomeCategory = categories.find(c => c.type === 'income' && c.detail_type === 'transfer');
  const transferExpenseCategory = categories.find(c => c.type === 'expense' && c.detail_type === 'transfer');

  let availableCategories = [];
  let currentDisplayValue = value || (aiSuggestionId && !isTransactionTransfer ? aiSuggestionId : value);

  if (isTransactionTransfer) {
    const targetTransferCategory = transactionAmount > 0 ? transferIncomeCategory : transferExpenseCategory;
    if (targetTransferCategory) {
      availableCategories = [targetTransferCategory];
      currentDisplayValue = targetTransferCategory.id;
    }
  } else {
    const nonTransferCategories = categories.filter(c => c.is_active !== false && c.detail_type !== 'transfer');
    availableCategories = transactionType === 'expense'
      ? nonTransferCategories.filter(c => c.type === 'expense')
      : nonTransferCategories.filter(c => c.type === 'income');
  }

  const suggestedCategory = aiSuggestionId ? categories.find(c => c.id === aiSuggestionId) : null;

  if (suggestedCategory && !availableCategories.find(c => c.id === aiSuggestionId)) {
    availableCategories = [suggestedCategory, ...availableCategories];
  }

  const handleOpenChange = (open) => {
    setIsOpen(open);
    if (!open) {
      setSearchTerm('');
    }
  };

  return (
    <ClickThroughSelect
      value={currentDisplayValue}
      onValueChange={(val) => {
        if (val === '__add_new__' && onAddNew) {
          onAddNew(searchTerm);
          return;
        }
        onValueChange?.(val);
      }}
      onOpenChange={handleOpenChange}
      onSearchTermChange={setSearchTerm}
      placeholder={placeholder}
      triggerClassName={`${triggerClassName} ${disabled || isTransactionTransfer ? 'opacity-50 pointer-events-none' : ''}`}
      enableSearch={true}
    >
      {onAddNew && (
        <ClickThroughSelectItem value="__add_new__" className="text-blue-600 font-medium whitespace-nowrap" isAction>
          + Add new category{searchTerm ? `: "${searchTerm}"` : ''}
        </ClickThroughSelectItem>
      )}
      {suggestedCategory && (
        <>
          <ClickThroughSelectItem
            key={`suggested-${suggestedCategory.id}`}
            value={suggestedCategory.id}
            isRecommended={true}
            data-display={getAccountDisplayName({
              account_type: suggestedCategory.type,
              detail_type: suggestedCategory.detail_type,
              name: suggestedCategory.name
            })}
            className="flex items-center justify-between whitespace-nowrap"
          >
            <span className="truncate">
              {getAccountDisplayName({
                account_type: suggestedCategory.type,
                detail_type: suggestedCategory.detail_type,
                name: suggestedCategory.name
              })}
            </span>
            <Sparkles className="w-3 h-3 text-blue-500 ml-2 flex-shrink-0" />
          </ClickThroughSelectItem>
        </>
      )}
      {availableCategories.filter(cat => cat.id !== aiSuggestionId).map((cat) => {
        const displayName = getAccountDisplayName({
          account_type: cat.type,
          detail_type: cat.detail_type,
          name: cat.name
        });
        return (
          <ClickThroughSelectItem key={cat.id} value={cat.id} data-display={displayName} className="flex items-center justify-between whitespace-nowrap">
            <span className="truncate">{displayName}</span>
          </ClickThroughSelectItem>
        );
      })}
      {isTransactionTransfer && availableCategories.length > 0 && (
        <ClickThroughSelectItem key={availableCategories[0].id} value={availableCategories[0].id} data-display="Transfer">
          <span className="truncate">Transfer</span>
        </ClickThroughSelectItem>
      )}
    </ClickThroughSelect>
  );
}