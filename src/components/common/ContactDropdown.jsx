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

  const activeContacts = contacts.filter(c => c.status === 'Active');
  
  const suggestedContact = aiSuggestionId ? activeContacts.find(c => c.id === aiSuggestionId) : null;
  const otherContacts = activeContacts.filter(c => c.id !== aiSuggestionId);

  const handleOpenChange = (open) => {
    setIsOpen(open);
    if (!open) {
      setSearchTerm('');
    }
  };

  const displayValue = value || '';

  return (
    <ClickThroughSelect 
      value={displayValue}
      onValueChange={(val) => {
        if (val === '__add_new__' && onAddNew) {
          onAddNew(searchTerm);
          return;
        }
        // Handle empty string from cleared search
        if (val === '') {
          onValueChange?.(null);
          return;
        }
        onValueChange?.(val);
      }}
      onOpenChange={handleOpenChange}
      onSearchTermChange={setSearchTerm}
      placeholder={placeholder}
      triggerClassName={`${triggerClassName} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {onAddNew && (
        <ClickThroughSelectItem value="__add_new__" className="text-blue-600 font-medium whitespace-nowrap" isAction>
          + Add new contact{searchTerm ? `: "${searchTerm}"` : ''}
        </ClickThroughSelectItem>
      )}
      {suggestedContact && (
        <>
          <ClickThroughSelectItem 
            key={suggestedContact.id} 
            value={suggestedContact.id} 
            data-display={suggestedContact.name} 
            className="flex items-center justify-between whitespace-nowrap"
            isRecommended
          >
            <span className="truncate">{suggestedContact.name}</span>
            <Sparkles className="w-3 h-3 text-emerald-600 ml-2 flex-shrink-0" />
          </ClickThroughSelectItem>
          <div className="h-px bg-slate-200 my-1" />
        </>
      )}
      {otherContacts.map((contact) => (
        <ClickThroughSelectItem key={contact.id} value={contact.id} data-display={contact.name} className="flex items-center justify-between whitespace-nowrap">
          <span className="truncate">{contact.name}</span>
        </ClickThroughSelectItem>
      ))}
    </ClickThroughSelect>
  );
}