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
import { base44 } from '@/api/base44Client';
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
    queryFn: () => base44.entities.Contact.list('name', 1000)
  });

  const { data: matchingRules = [] } = useQuery({
    queryKey: ['contactMatchingRules'],
    queryFn: () => base44.entities.ContactMatchingRule.list('priority', 1000),
    staleTime: 5 * 60 * 1000
  });

  let availableContacts = contacts.filter(c => c.status === 'active');
  let currentDisplayValue = value || (aiSuggestionId ? aiSuggestionId : value);

  let suggestedContactId = aiSuggestionId;

  if (!suggestedContactId && value && transactionDescription && matchingRules.length > 0) {
    const descLower = transactionDescription.toLowerCase().trim();
    const activeRules = matchingRules
      .filter(r => r.is_active)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of activeRules) {
      const matchVal = rule.match_value.toLowerCase();
      let matches = false;

      switch (rule.match_type) {
        case 'exact':
          matches = descLower === matchVal;
          break;
        case 'starts_with':
          matches = descLower.startsWith(matchVal);
          break;
        case 'ends_with':
          matches = descLower.endsWith(matchVal);
          break;
        case 'contains':
        default:
          matches = descLower.includes(matchVal);
          break;
      }

      if (matches && rule.contact_id === value) {
        suggestedContactId = value;
        break;
      }
    }
  }

  const suggestedContact = suggestedContactId ? contacts.find(c => c.id === suggestedContactId) : null;

  if (suggestedContact && !availableContacts.find(c => c.id === suggestedContactId)) {
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
        onValueChange?.(val);
      }}
      onOpenChange={handleOpenChange}
      onSearchTermChange={setSearchTerm}
      placeholder={placeholder}
      triggerClassName={`${triggerClassName} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      enableSearch={true}
    >
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
      {onAddNew && (
        <ClickThroughSelectItem value="__add_new__" className="text-blue-600 font-medium whitespace-nowrap" isAction>
          + Add new contact{searchTerm ? `: "${searchTerm}"` : ''}
        </ClickThroughSelectItem>
      )}
      {availableContacts.filter(contact => contact.id !== suggestedContactId).map((contact) => (
        <ClickThroughSelectItem key={contact.id} value={contact.id} data-display={contact.name} className="flex items-center justify-between whitespace-nowrap">
          <span className="truncate">{contact.name}</span>
        </ClickThroughSelectItem>
      ))}
    </ClickThroughSelect>
  );
}