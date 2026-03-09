import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    if (open) {
      setIsCreating(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setIsCreating(true);
    try {
      await onConfirm();
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

  const formatAmount = (amount, cadence) => {
    const formatted = formatCadenceAmount(amount, cadence);
    const label = getCadenceLabel(cadence);
    return `${formatted}${label}`;
  };

  const hasParentBudget = !!parentBudget;

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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700 font-medium">New parent budget:</span>
                  <span className="font-semibold text-blue-700">{formatAmount(newParentAmount, parentCadence)}</span>
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
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700 font-medium">Parent budget to create:</span>
                  <span className="font-semibold text-blue-700">
                    {formatAmount(convertCadence(totalNeeded, requestedCadence, 'monthly'), 'monthly')}
                  </span>
                </div>
              </div>
            </>
          )}

          <p className="text-xs text-slate-500">
            {hasParentBudget
              ? `The parent budget will be automatically increased to accommodate all child budgets.`
              : `A new budget will be created for the parent category with enough allocation for the child.`
            }
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onCancel?.(); onOpenChange(false); }} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isCreating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isCreating ? 'Processing...' : (hasParentBudget ? 'Increase Parent Budget' : 'Create Parent Budget')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
