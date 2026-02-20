import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import DatePresetDropdown from '../common/DatePresetDropdown';
import TransactionTypeDropdown from '../common/TransactionTypeDropdown';
import PaymentMethodDropdown from '../common/PaymentMethodDropdown';
import CalculatorAmountInput from '../common/CalculatorAmountInput';

export default function TransactionFilterPanel({ 
  isOpen, 
  onClose, 
  filters, 
  onApply, 
  onReset,
  accounts,
  categories,
  expenseCategories = [],
  incomeCategories = []
}) {
  const [localFilters, setLocalFilters] = useState({
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    account: 'all',
    category: 'all',
    type: 'all',
    amountMin: '',
    amountMax: '',
    paymentMethod: 'all'
  });

  React.useEffect(() => {
    if (isOpen) {
      setLocalFilters({...filters});
    }
  }, [isOpen]);

  const handleApply = () => {
    onApply({...localFilters});
    onClose();
  };

  const handleReset = () => {
    const resetFilters = {
      datePreset: 'all',
      dateFrom: '',
      dateTo: '',
      account: 'all',
      category: 'all',
      type: 'all',
      amountMin: '',
      amountMax: '',
      paymentMethod: 'all'
    };
    setLocalFilters(resetFilters);
    onReset();
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Filter Transactions</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 px-6 py-3 space-y-4">
            {/* Date Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Date Range</Label>
              <DatePresetDropdown 
                value={localFilters.datePreset} 
                onValueChange={(val) => {
                  setLocalFilters(prev => ({ 
                    ...prev, 
                    datePreset: val,
                    dateFrom: val !== 'custom' ? '' : prev.dateFrom,
                    dateTo: val !== 'custom' ? '' : prev.dateTo
                  }));
                }}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-500">From</Label>
                  <Input 
                    type="date" 
                    value={localFilters.dateFrom}
                    onChange={(e) => setLocalFilters(prev => ({ ...prev, dateFrom: e.target.value, datePreset: 'custom' }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">To</Label>
                  <Input 
                    type="date" 
                    value={localFilters.dateTo}
                    onChange={(e) => setLocalFilters(prev => ({ ...prev, dateTo: e.target.value, datePreset: 'custom' }))}
                  />
                </div>
              </div>
            </div>

            {/* Account Filter */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-slate-700">Account</Label>
              <Select 
                value={localFilters.account} 
                onValueChange={(val) => setLocalFilters(prev => ({ ...prev, account: val }))}
              >
                <SelectTrigger className="w-full hover:bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.filter(acc => acc.account_type !== 'investment').map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name} {acc.account_number && `(${acc.account_number})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-slate-700">Type</Label>
              <TransactionTypeDropdown 
                value={localFilters.type} 
                onValueChange={(val) => setLocalFilters(prev => ({ ...prev, type: val }))}
              />
            </div>

            {/* Detail Filter */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-slate-700">Detail</Label>
              <Select 
                value={localFilters.category} 
                onValueChange={(val) => setLocalFilters(prev => ({ ...prev, category: val }))}
              >
                <SelectTrigger className="w-full hover:bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {expenseCategories.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-slate-500">Expense Accounts</div>
                      {expenseCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {incomeCategories.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-slate-500 mt-2">Income Accounts</div>
                      {incomeCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Range */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-slate-700">Amount Range</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-500">Min</Label>
                  <CalculatorAmountInput
                    value={parseFloat(localFilters.amountMin) || 0}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, amountMin: value.toString() }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Max</Label>
                  <CalculatorAmountInput
                    value={parseFloat(localFilters.amountMax) || 0}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, amountMax: value.toString() }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-slate-700">Payment Method</Label>
              <PaymentMethodDropdown 
                value={localFilters.paymentMethod} 
                onValueChange={(val) => setLocalFilters(prev => ({ ...prev, paymentMethod: val }))}
              />
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 mb-8 border-t border-slate-200 flex gap-3 flex-shrink-0 bg-white relative z-[60]">
            <Button variant="outline" className="flex-1 h-10" onClick={handleReset}>
              Reset All
            </Button>
            <Button className="flex-1 h-10 bg-blue-600 hover:bg-blue-700" onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}