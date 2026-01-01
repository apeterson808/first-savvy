/*
 * ⚠️ PROTECTED CONFIGURATION ⚠️
 *
 * This file is part of a protected configuration system and changes require explicit confirmation.
 * Any modifications to this component's filtering logic must be reviewed and approved.
 *
 * Protected aspects:
 * - Contact filtering logic (active status handling)
 * - Display name integration
 * - AI suggestion handling
 *
 * To make changes:
 * 1. Navigate to Settings > Protected tab to unlock the configuration
 * 2. Make your changes
 * 3. Confirm the change when prompted
 *
 * For more information, see the Protected Configurations documentation.
 */

import React, { useState } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery } from '@tanstack/react-query';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Sparkles } from 'lucide-react';

export default function ContactDropdown({
  value,
  onValueChange,
  transactionDescription = '',
  aiSuggestionId,
  disabled = false,
  onAddNew,
  triggerClassName = "h-7 border-slate-300",
  placeholder = "Select contact"
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => firstsavvy.entities.Contact.list('name', 1000)
  });

  let availableContacts = contacts.filter(c => c.status === 'active');
  let currentDisplayValue = value || (aiSuggestionId ? aiSuggestionId : value);

  const suggestedContact = aiSuggestionId ? contacts.find(c => c.id === aiSuggestionId) : null;

  if (suggestedContact && !availableContacts.find(c => c.id === aiSuggestionId)) {
    availableContacts = [suggestedContact, ...availableContacts];
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
        onValueChange?.(val || null);
      }}
      onOpenChange={handleOpenChange}
      onSearchTermChange={setSearchTerm}
      placeholder={placeholder}
      triggerClassName={`${triggerClassName} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      enableSearch={true}
    >
      {onAddNew && (
        <ClickThroughSelectItem value="__add_new__" className="text-blue-600 font-medium whitespace-nowrap" isAction>
          + Add new contact{searchTerm ? `: "${searchTerm}"` : ''}
        </ClickThroughSelectItem>
      )}
      {suggestedContact && (
        <>
          <ClickThroughSelectItem
            key={`suggested-${suggestedContact.id}`}
            value={suggestedContact.id}
            isRecommended={true}
            data-display={suggestedContact.name}
            className="flex items-center justify-between whitespace-nowrap"
          >
            <span className="truncate">{suggestedContact.name}</span>
            <Sparkles className="w-3 h-3 text-blue-500 ml-2 flex-shrink-0" />
          </ClickThroughSelectItem>
        </>
      )}
      {availableContacts.filter(contact => contact.id !== aiSuggestionId).map((contact) => (
        <ClickThroughSelectItem key={contact.id} value={contact.id} data-display={contact.name} className="flex items-center justify-between whitespace-nowrap">
          <span className="truncate">{contact.name}</span>
        </ClickThroughSelectItem>
      ))}
    </ClickThroughSelect>
  );
}