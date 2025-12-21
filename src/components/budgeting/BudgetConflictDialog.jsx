import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

export default function BudgetConflictDialog({ 
  open, 
  onOpenChange, 
  conflictBudget,
  requestedAmount,
  totalIncome,
  allBudgets,
  groups,
  onSave
}) {
  const [adjustments, setAdjustments] = useState({});
  const [incomeAdjustments, setIncomeAdjustments] = useState({});

  // Get expense and income budgets
  const expenseGroupIds = new Set(groups.filter(g => g.type === 'expense').map(g => g.id));
  const incomeGroupIds = new Set(groups.filter(g => g.type === 'income').map(g => g.id));
  
  const otherExpenseBudgets = allBudgets.filter(b => 
    expenseGroupIds.has(b.group_id) && b.id !== conflictBudget?.id
  );
  const incomeBudgets = allBudgets.filter(b => incomeGroupIds.has(b.group_id));

  // Calculate the overflow amount
  const currentOtherExpenses = otherExpenseBudgets.reduce((sum, b) => sum + (b.allocated_amount || 0), 0);
  const originalAmount = conflictBudget?.allocated_amount || 0;
  const overflowAmount = (currentOtherExpenses + requestedAmount) - totalIncome;

  // Calculate adjusted values
  const totalReduction = Object.values(adjustments).reduce((sum, adj) => sum + adj, 0);
  const totalIncomeIncrease = Object.values(incomeAdjustments).reduce((sum, adj) => sum + adj, 0);
  const adjustedIncome = totalIncome + totalIncomeIncrease;
  const newTotalExpenses = currentOtherExpenses - totalReduction + requestedAmount;
  const isResolved = newTotalExpenses <= adjustedIncome;

  // Reset adjustments when dialog opens
  useEffect(() => {
    if (open) {
      setAdjustments({});
      setIncomeAdjustments({});
    }
  }, [open]);

  const handleIncomeAdjustment = (budgetId, increase) => {
    const clampedIncrease = Math.max(0, increase);
    setIncomeAdjustments(prev => ({
      ...prev,
      [budgetId]: clampedIncrease
    }));
  };

  const handleAdjustment = (budgetId, reduction) => {
    const budget = otherExpenseBudgets.find(b => b.id === budgetId);
    const maxReduction = budget?.allocated_amount || 0;
    const clampedReduction = Math.max(0, Math.min(reduction, maxReduction));
    
    setAdjustments(prev => ({
      ...prev,
      [budgetId]: clampedReduction
    }));
  };

  const handleSave = () => {
    const updates = [];
    
    // Add the original budget update only if it has an ID (existing budget)
    if (conflictBudget.id) {
      updates.push({ id: conflictBudget.id, allocated_amount: requestedAmount });
    }
    
    // Add expense budget reductions
    Object.entries(adjustments).forEach(([budgetId, reduction]) => {
      if (reduction > 0) {
        const budget = otherExpenseBudgets.find(b => b.id === budgetId);
        if (budget) {
          updates.push({ id: budgetId, allocated_amount: budget.allocated_amount - reduction });
        }
      }
    });
    
    // Add income increases
    Object.entries(incomeAdjustments).forEach(([budgetId, increase]) => {
      if (increase > 0) {
        const budget = incomeBudgets.find(b => b.id === budgetId);
        if (budget) {
          updates.push({ id: budgetId, allocated_amount: budget.allocated_amount + increase });
        }
      }
    });
    
    onSave(updates);
    onOpenChange(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  if (!conflictBudget) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Budget Exceeds Income
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Explanation */}
          <div className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p>
              Setting <strong>{conflictBudget.name}</strong> to {formatCurrency(requestedAmount)} would 
              exceed your budgeted income by <strong className="text-red-600">{formatCurrency(overflowAmount)}</strong>.
            </p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-500">Total Income:</div>
            <div className="text-right font-medium">
              {formatCurrency(adjustedIncome)}
              {totalIncomeIncrease > 0 && (
                <span className="text-green-600 ml-1">(+{formatCurrency(totalIncomeIncrease)})</span>
              )}
            </div>
            <div className="text-slate-500">Total Expenses:</div>
            <div className={`text-right font-medium ${isResolved ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(newTotalExpenses)}
            </div>
          </div>

          {/* Option 1: Reduce other budgets */}
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-slate-700 mb-2">Take from another budget:</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {otherExpenseBudgets.map(budget => {
                const reduction = adjustments[budget.id] || 0;
                const newAmount = budget.allocated_amount - reduction;
                
                return (
                  <div key={budget.id} className="flex items-center gap-2 py-1">
                    <span className="text-sm text-slate-600 flex-1 truncate">{budget.name}</span>
                    <span className="text-xs text-slate-400 w-16 text-right">
                      {formatCurrency(newAmount)}
                    </span>
                    <div className="flex items-center">
                      <span className="text-xs text-slate-500 mr-1">-$</span>
                      <Input
                        type="number"
                        value={reduction || ''}
                        placeholder="0"
                        onChange={(e) => handleAdjustment(budget.id, parseFloat(e.target.value) || 0)}
                        className="w-20 h-7 text-xs text-right px-2"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Option 2: Increase income */}
          {incomeBudgets.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-slate-700 mb-2">Or increase income budget:</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {incomeBudgets.map(budget => {
                  const increase = incomeAdjustments[budget.id] || 0;
                  const newAmount = budget.allocated_amount + increase;
                  
                  return (
                    <div key={budget.id} className="flex items-center gap-2 py-1">
                      <span className="text-sm text-slate-600 flex-1 truncate">{budget.name}</span>
                      <span className="text-xs text-slate-400 w-16 text-right">
                        {formatCurrency(newAmount)}
                      </span>
                      <div className="flex items-center">
                        <span className="text-xs text-slate-500 mr-1">+$</span>
                        <Input
                          type="number"
                          value={increase || ''}
                          placeholder="0"
                          onChange={(e) => handleIncomeAdjustment(budget.id, parseFloat(e.target.value) || 0)}
                          className="w-20 h-7 text-xs text-right px-2"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status indicator */}
          <div className={`text-center py-2 rounded-lg text-sm font-medium ${
            isResolved ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {isResolved ? '✓ Budget balanced' : `Still ${formatCurrency(newTotalExpenses - adjustedIncome)} over budget`}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!isResolved}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}