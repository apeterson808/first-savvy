import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Info } from 'lucide-react';
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
  onCancel,
  siblingBudgets = []
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [editedParentAmount, setEditedParentAmount] = useState('');
  const [editedChildAmount, setEditedChildAmount] = useState('');
  const [editedSiblingAmounts, setEditedSiblingAmounts] = useState({});

  useEffect(() => {
    if (open) {
      setIsCreating(false);
      const parentCadence = parentBudget?.cadence || 'monthly';
      const parentAmount = parentBudget?.allocated_amount || 0;

      const requestedInParentCadence = convertCadence(requestedAmount, requestedCadence, parentCadence);
      const totalSiblingsInParentCadence = convertCadence(totalSiblingsAmount, requestedCadence, parentCadence);
      const totalNeededInParentCadence = totalSiblingsInParentCadence + requestedInParentCadence;

      const calculatedAmount = parentBudget
        ? Math.max(parentAmount, totalNeededInParentCadence)
        : totalNeededInParentCadence;

      setEditedParentAmount(calculatedAmount.toFixed(2));
      setEditedChildAmount(requestedInParentCadence.toFixed(2));

      const siblingAmounts = {};
      siblingBudgets.forEach(sibling => {
        const siblingAmount = convertCadence(sibling.allocated_amount || 0, sibling.cadence || 'monthly', parentCadence);
        siblingAmounts[sibling.id] = siblingAmount.toFixed(2);
      });
      setEditedSiblingAmounts(siblingAmounts);
    }
  }, [open, parentBudget, requestedAmount, requestedCadence, totalSiblingsAmount, overflow, siblingBudgets]);

  const handleConfirm = async () => {
    const parentAmount = parseFloat(editedParentAmount);
    const childAmount = parseFloat(editedChildAmount);

    if (isNaN(parentAmount) || isNaN(childAmount) || remaining < 0) {
      return;
    }

    setIsCreating(true);
    try {
      await onConfirm({
        parentAmount,
        childAmount,
        siblingAmounts: editedSiblingAmounts
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!childCategory || !parentCategory) return null;

  const parentCadence = parentBudget?.cadence || 'monthly';

  const parentAmount = parseFloat(editedParentAmount) || 0;
  const childAmount = parseFloat(editedChildAmount) || 0;
  const totalSiblings = Object.values(editedSiblingAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const totalChildren = totalSiblings + childAmount;
  const remaining = parentAmount - totalChildren;

  const canContinue = remaining >= 0;

  const formatAmount = (amount) => {
    return formatCadenceAmount(amount, parentCadence);
  };

  const hasParentBudget = !!parentBudget;

  const getDialogTitle = () => {
    if (!hasParentBudget) return 'Create Parent Budget';
    return 'Adjust Budget Allocation';
  };

  const getDialogIcon = () => {
    return <Info className="w-5 h-5" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            {getDialogIcon()}
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Adjust budget allocation for <strong>{parentCategory.display_name}</strong> and its child budgets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            {/* Parent Budget */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Parent Budget
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-900">
                  {parentCategory.display_name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editedParentAmount}
                    onChange={(e) => setEditedParentAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-32 text-right font-medium"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-300"></div>

            {/* Child Budgets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Child Budgets (subtracted from parent)
                </span>
              </div>

              {siblingBudgets.map((sibling) => (
                <div key={sibling.id} className="flex items-center justify-between pl-6 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">−</span>
                    <span className="text-sm text-slate-700">
                      {sibling.categoryName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editedSiblingAmounts[sibling.id] || '0.00'}
                      onChange={(e) => setEditedSiblingAmounts(prev => ({
                        ...prev,
                        [sibling.id]: e.target.value
                      }))}
                      onFocus={(e) => e.target.select()}
                      className="w-32 text-right"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pl-6 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">−</span>
                  <span className="text-sm font-medium text-slate-900">
                    {childCategory.display_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editedChildAmount}
                    onChange={(e) => setEditedChildAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-32 text-right"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Remaining */}
            <div className="border-t border-slate-300 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${remaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  Remaining
                </span>
                <div className={`text-base font-semibold tabular-nums ${remaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatAmount(remaining)}
                </div>
              </div>
              {remaining < 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Remaining must be greater than or equal to $0.00
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            All amounts shown in {getCadenceLabel(parentCadence)} format
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onCancel?.(); onOpenChange(false); }} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isCreating || !canContinue}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isCreating ? 'Processing...' : 'Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
