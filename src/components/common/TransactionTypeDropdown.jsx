import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';

export default function TransactionTypeDropdown({ 
  value, 
  onValueChange, 
  showAllOption = true,
  variant = 'select', // 'select' or 'clickthrough'
  triggerClassName = "w-full hover:bg-slate-50"
}) {
  if (variant === 'clickthrough') {
    return (
      <ClickThroughSelect value={value} onValueChange={onValueChange} triggerClassName={triggerClassName}>
        {showAllOption && <ClickThroughSelectItem value="all">All Types</ClickThroughSelectItem>}
        <ClickThroughSelectItem value="expense_income">Income & Expense</ClickThroughSelectItem>
        <ClickThroughSelectItem value="expense">Expense</ClickThroughSelectItem>
        <ClickThroughSelectItem value="income">Income</ClickThroughSelectItem>
        <ClickThroughSelectItem value="transfer">Transfer</ClickThroughSelectItem>
      </ClickThroughSelect>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {showAllOption && <SelectItem value="all">All Types</SelectItem>}
        <SelectItem value="expense_income">Income & Expense</SelectItem>
        <SelectItem value="expense">Expense</SelectItem>
        <SelectItem value="income">Income</SelectItem>
        <SelectItem value="transfer">Transfer</SelectItem>
      </SelectContent>
    </Select>
  );
}