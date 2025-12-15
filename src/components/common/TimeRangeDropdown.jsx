import React from 'react';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';

export default function TimeRangeDropdown({ 
  value, 
  onValueChange, 
  triggerClassName = "w-28 h-8 text-xs hover:bg-slate-50"
}) {
  return (
    <ClickThroughSelect value={value} onValueChange={onValueChange} triggerClassName={triggerClassName}>
      <ClickThroughSelectItem value="7d" className="text-xs">Last 7 Days</ClickThroughSelectItem>
      <ClickThroughSelectItem value="30d" className="text-xs">Last 30 Days</ClickThroughSelectItem>
      <ClickThroughSelectItem value="90d" className="text-xs">Last 90 Days</ClickThroughSelectItem>
      <ClickThroughSelectItem value="mtd" className="text-xs">MTD</ClickThroughSelectItem>
      <ClickThroughSelectItem value="1" className="text-xs">1 Month</ClickThroughSelectItem>
      <ClickThroughSelectItem value="3" className="text-xs">3 Months</ClickThroughSelectItem>
      <ClickThroughSelectItem value="6" className="text-xs">6 Months</ClickThroughSelectItem>
      <ClickThroughSelectItem value="qtd" className="text-xs">This Quarter</ClickThroughSelectItem>
      <ClickThroughSelectItem value="lastQuarter" className="text-xs">Last Quarter</ClickThroughSelectItem>
      <ClickThroughSelectItem value="ytd" className="text-xs">YTD</ClickThroughSelectItem>
      <ClickThroughSelectItem value="12" className="text-xs">12 Months</ClickThroughSelectItem>
      <ClickThroughSelectItem value="lastYear" className="text-xs">Last Year</ClickThroughSelectItem>
      <ClickThroughSelectItem value="all" className="text-xs">All Time</ClickThroughSelectItem>
    </ClickThroughSelect>
  );
}