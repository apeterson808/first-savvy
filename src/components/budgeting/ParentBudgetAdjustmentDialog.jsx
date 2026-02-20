import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

export default function ParentBudgetAdjustmentDialog({
  open,
  onOpenChange,
  parentCategory,
  childCategory,
  requestedAmount,
  validationInfo,
  onConfirm
}) {
  const [newParentAmount, setNewParentAmount] = useState('');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const parseCurrency = (value) => {
    return parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
  };

  useEffect(() => {
    if (open && validationInfo) {
      const minimumRequired = validationInfo.allocated_to_children + requestedAmount;
      setNewParentAmount(minimumRequired.toFixed(2));
    }
  }, [open, validationInfo, requestedAmount]);

  if (!validationInfo || !parentCategory || !childCategory) return null;

  const minimumRequired = validationInfo.allocated_to_children + requestedAmount;
  const shortfall = requestedAmount - validationInfo.available_budget;
  const enteredAmount = parseCurrency(newParentAmount);
  const isValid = enteredAmount >= minimumRequired;

  const getSiblingBudgets = () => {
    return validationInfo.sibling_budgets || [];
  };

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(enteredAmount);
    }
  };

  const siblingBudgets = getSiblingBudgets();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Parent Budget Adjustment Required
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p>
              The <strong>"{parentCategory.display_name || parentCategory.account_detail}"</strong> category
              doesn't have enough budget available.
            </p>
          </div>

          <div className="border rounded-lg p-4 space-y-2 bg-slate-50">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total Parent Budget:</span>
              <span className="font-medium">{formatCurrency(validationInfo.parent_budget)}</span>
            </div>

            {siblingBudgets.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <div className="text-sm text-slate-600 mb-1">Already Allocated to Children:</div>
                <div className="pl-3 space-y-1">
                  {siblingBudgets.map((sibling, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-slate-500">{sibling.name}</span>
                      <span className="text-slate-700 font-medium">{formatCurrency(sibling.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm mt-1 pt-1 border-t">
                  <span className="text-slate-600">Total Allocated:</span>
                  <span className="font-medium">{formatCurrency(validationInfo.allocated_to_children)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-slate-600">Available:</span>
              <span className="font-medium">{formatCurrency(validationInfo.available_budget)}</span>
            </div>

            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-slate-600">You're requesting:</span>
              <span className="font-semibold text-blue-600">{formatCurrency(requestedAmount)}</span>
            </div>

            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-red-600 font-medium">Shortfall:</span>
              <span className="font-semibold text-red-600">{formatCurrency(shortfall)}</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-slate-700">
            <p>
              To budget <strong>{formatCurrency(requestedAmount)}</strong> for
              "<strong>{childCategory.display_name || childCategory.account_detail}</strong>",
              the parent "<strong>{parentCategory.display_name || parentCategory.account_detail}</strong>"
              budget needs to be at least <strong>{formatCurrency(minimumRequired)}</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newParentAmount">New Parent Budget Amount*</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="newParentAmount"
                type="text"
                value={newParentAmount}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setNewParentAmount(value);
                }}
                className={`pl-7 ${!isValid && enteredAmount > 0 ? 'border-red-500' : ''}`}
                placeholder="0.00"
              />
            </div>
            {!isValid && enteredAmount > 0 && (
              <p className="text-xs text-red-600">
                Amount must be at least {formatCurrency(minimumRequired)} to cover all child budgets
              </p>
            )}
            <p className="text-xs text-slate-500">
              Minimum required: {formatCurrency(minimumRequired)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Increase Parent Budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
