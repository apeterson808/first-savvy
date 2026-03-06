import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DatePresetDropdown({ 
  value, 
  onValueChange, 
  triggerClassName = "w-full hover:bg-slate-50"
}) {
  const presets = [
    { value: 'today', label: 'Today' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'last3months', label: 'Last 3 months' },
    { value: 'last6months', label: 'Last 6 months' },
    { value: 'last12months', label: 'Last 12 months' }
  ];

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {presets.map(preset => (
          <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}