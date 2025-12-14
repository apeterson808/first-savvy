import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';

export default function PaymentMethodDropdown({ 
  value, 
  onValueChange, 
  showAllOption = true,
  variant = 'select', // 'select' or 'clickthrough'
  triggerClassName = "w-full hover:bg-slate-50"
}) {
  const options = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'check', label: 'Check' },
    { value: 'other', label: 'Other' }
  ];

  if (variant === 'clickthrough') {
    return (
      <ClickThroughSelect value={value} onValueChange={onValueChange} triggerClassName={triggerClassName}>
        {showAllOption && <ClickThroughSelectItem value="all">All Methods</ClickThroughSelectItem>}
        {options.map(opt => (
          <ClickThroughSelectItem key={opt.value} value={opt.value}>{opt.label}</ClickThroughSelectItem>
        ))}
      </ClickThroughSelect>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {showAllOption && <SelectItem value="all">All Methods</SelectItem>}
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}