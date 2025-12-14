import React from 'react';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';

export default function FromToDropdown({ 
  value, 
  onValueChange, 
  triggerClassName = "h-7 border-slate-300",
  placeholder = "Select customer"
}) {
  return (
    <ClickThroughSelect 
      value={value || 'select'} 
      onValueChange={onValueChange}
      triggerClassName={triggerClassName}
    >
      <ClickThroughSelectItem value="select">{placeholder}</ClickThroughSelectItem>
      <ClickThroughSelectItem value="vendor">Select vendor</ClickThroughSelectItem>
    </ClickThroughSelect>
  );
}