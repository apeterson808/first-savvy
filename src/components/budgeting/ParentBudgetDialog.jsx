import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { convertCadence, formatCadenceAmount } from '@/utils/cadenceUtils';
import { getCadenceLabel } from '@/utils/budgetValidation';

export default function ParentBudgetDialog({
  open,
  onOpenChange,
  parentCategory,
  parentBudget,
  childCategory,
  requestedAmount,
  requestedCadence,
  totalSiblingsAmount,
  overflow,
  onConfirm,
  onCancel
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [editedParentAmount, setEditedParentAmount] = useState('');

  useEffect(() => {
    if (open) {
      setIsCreating(false);
      const parentCadence = parentBudget?.cadence || 'monthly';
      const parentAmount = parentBudget?.allocated_amount || 0;
      const totalNeeded = totalSiblingsAmount + requestedAmount;
      const overflowInParentCadence = convertCadence(overflow, requestedCadence, parentCadence);
      const newParentAmount = parentAmount + overflowInParentCadence;

      const calculatedAmount = parentBudget
        ? newParentAmount
        : convertCadence(totalNeeded, requestedCadence, 'monthly');

      setEditedParentAmount(calculatedAmount.toFixed(2));
    }
  }, [open, parentBudget, requestedAmount, requestedCadence, totalSiblingsAmount, overflow]);

  const handleConfirm = async () => {
    const amount = parseFloat(editedParentAmount);
    if (isNaN(amount) || amount < minimumRequired) {
      return;
    }

    setIsCreating(true);
    try {
      await onConfirm(amount);
    } finally {
      setIsCreating(false);
    }
  };

  if (!childCategory || !parentCategory) return null;

  const parentCadence = parentBudget?.cadence || 'monthly';
  const parentAmount = parentBudget?.allocated_amount || 0;

  const totalNeeded = totalSiblingsAmount + requestedAmount;

  const totalNeededInParentCadence = convertCadence(totalNeeded, requestedCadence, parentCadence);
  const overflowInParentCadence = convertCadence(overflow, requestedCadence, parentCadence);
  const newParentAmount = parentAmount + overflowInParentCadence;

  const minimumRequired = parentBudget
    ? totalNeededInParentCadence
    : convertCadence(totalNeeded, requestedCadence, 'monthly');

  const formatAmount = (amount, cadence) => {
    const formatted = formatCadenceAmount(amount, cadence);
    const label = getCadenceLabel(cadence);
    return `${formatted}${label}`;
  };

  const hasParentBudget = !!parentBudget;

  const enteredAmount = parseFloat(editedParentAmount);
  const isValidAmount = !isNaN(enteredAmount) && enteredAmount >= minimumRequired;
  const showError = editedParentAmount !== '' && !isValidAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            {hasParentBudget ? 'Increase Parent Budget?' : 'Create Parent Budget?'}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            {hasParentBudget ? (
              <>
                Setting <strong>{childCategory.display_name}</strong> to{' '}
                {formatAmount(requestedAmount, requestedCadence)} would exceed the parent budget
                for <strong>{parentCategory.display_name}</strong>.
              </>
            ) : (
              <>
                <strong>{parentCategory.display_name}</strong> needs a budget before you can
                allocate amounts to <strong>{childCategory.display_name}</strong>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasParentBudget ? (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Current parent budget:</span>
                  <span className="font-medium">{formatAmount(parentAmount, parentCadence)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total child budgets needed:</span>
                  <span className="font-medium">{formatAmount(totalNeededInParentCadence, parentCadence)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-300 pt-2">
                  <span className="text-slate-600">Increase needed:</span>
                  <span className="font-medium text-amber-600">+{formatAmount(overflowInParentCadence, parentCadence)}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Minimum required:</span>
                  <span className="font-medium text-slate-900">{formatAmount(totalNeededInParentCadence, parentCadence)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Child budget requested:</span>
                  <span className="font-medium">{formatAmount(requestedAmount, requestedCadence)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Minimum required:</span>
                    <span className="font-medium text-slate-900">{formatAmount(minimumRequired, 'monthly')}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="parent-budget-amount" className="text-sm font-medium text-slate-700">
              {hasParentBudget ? 'New parent budget amount' : 'Parent budget amount'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="parent-budget-amount"
                type="number"
                step="0.01"
                min={minimumRequired}
                value={editedParentAmount}
                onChange={(e) => setEditedParentAmount(e.target.value)}
                className={`pl-7 ${showError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                placeholder="0.00"
              />
            </div>
            {showError && (
              <p className="text-xs text-red-600">
                Amount must be at least {formatAmount(minimumRequired, hasParentBudget ? parentCadence : 'monthly')}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {hasParentBudget
                ? `Enter the new ${getCadenceLabel(parentCadence)} budget for ${parentCategory.display_name}`
                : `Enter the monthly budget for ${parentCategory.display_name}`
              }
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onCancel?.(); onOpenChange(false); }} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isCreating || !isValidAmount}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isCreating ? 'Processing...' : (hasParentBudget ? 'Increase Parent Budget' : 'Create Parent Budget')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
