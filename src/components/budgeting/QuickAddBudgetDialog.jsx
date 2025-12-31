import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from '@/components/ui/badge';
import { convertToMonthly, formatCadenceAmount } from '@/utils/cadenceUtils';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export default function QuickAddBudgetDialog({
  open,
  onOpenChange,
  category,
  budgets = [],
  transactions = []
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [selectedCadence, setSelectedCadence] = useState('monthly');

  useEffect(() => {
    if (open && category) {
      setAmount('');
      setSelectedCadence('monthly');
    }
  }, [open, category]);

  const formatNumberWithCommas = (value) => {
    if (!value) return '';
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const isIncome = category?.class === 'income';
  const actionLabel = isIncome ? 'Income' : 'Budget';

  const createBudgetMutation = useMutation({
    mutationFn: (data) => firstsavvy.entities.Budget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(`${actionLabel} created successfully`);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error creating budget:', error);
      toast.error(`Failed to create ${actionLabel.toLowerCase()}`);
    }
  });

  const totalBudgetedIncomeMonthly = useMemo(() => {
    return budgets
      .filter(b => b.chartAccount?.class === 'income')
      .reduce((sum, b) => {
        const monthlyAmount = convertToMonthly(b.allocated_amount || 0, b.cadence || 'monthly');
        return sum + monthlyAmount;
      }, 0);
  }, [budgets]);

  const totalBudgetedExpenseMonthly = useMemo(() => {
    return budgets
      .filter(b => b.chartAccount?.class === 'expense')
      .reduce((sum, b) => {
        const monthlyAmount = convertToMonthly(b.allocated_amount || 0, b.cadence || 'monthly');
        return sum + monthlyAmount;
      }, 0);
  }, [budgets]);

  const historicalSuggestion = useMemo(() => {
    if (!category || !transactions.length) return null;

    const categoryTransactions = transactions.filter(t =>
      t.chart_account_id === category.id &&
      t.status === 'posted' &&
      t.type !== 'transfer'
    );

    if (categoryTransactions.length === 0) return null;

    const monthlyTotals = categoryTransactions.reduce((acc, t) => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      acc[monthKey] = (acc[monthKey] || 0) + t.amount;
      return acc;
    }, {});

    const months = Object.keys(monthlyTotals).length;
    const totalSpent = Object.values(monthlyTotals).reduce((sum, amt) => sum + amt, 0);
    const avgMonthly = months > 0 ? totalSpent / months : 0;

    return {
      avgMonthly,
      transactionCount: categoryTransactions.length,
      monthsWithData: months
    };
  }, [category, transactions]);

  const currentAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const currentAmountMonthly = convertToMonthly(currentAmount, selectedCadence);

  const remainingBeforeAdd = totalBudgetedIncomeMonthly - totalBudgetedExpenseMonthly;
  const remainingAfterAdd = remainingBeforeAdd - currentAmountMonthly;

  const isOverBudget = category?.class === 'expense' && currentAmountMonthly > 0 && remainingAfterAdd < 0;
  const maxAllowableMonthly = remainingBeforeAdd;

  const handleSuggestionClick = () => {
    if (historicalSuggestion?.avgMonthly) {
      const suggestionInSelectedCadence = convertToMonthly(historicalSuggestion.avgMonthly, 'monthly');
      const convertedAmount = selectedCadence === 'monthly'
        ? suggestionInSelectedCadence
        : (() => {
            switch (selectedCadence) {
              case 'daily': return suggestionInSelectedCadence / 30.44;
              case 'weekly': return suggestionInSelectedCadence / 4.33;
              case 'yearly': return suggestionInSelectedCadence * 12;
              default: return suggestionInSelectedCadence;
            }
          })();
      const formattedValue = formatNumberWithCommas(convertedAmount.toFixed(2));
      setAmount(formattedValue);
    }
  };

  const handleAmountChange = (e) => {
    const input = e.target.value;
    const cleanValue = input.replace(/[^0-9.]/g, '');

    const decimalCount = (cleanValue.match(/\./g) || []).length;
    if (decimalCount > 1) return;

    const parts = cleanValue.split('.');
    if (parts[1] && parts[1].length > 2) return;

    const formatted = formatNumberWithCommas(cleanValue);
    setAmount(formatted);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!category || !amount || currentAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (isOverBudget) {
      toast.error('This amount would exceed your budgeted income');
      return;
    }

    const budgetData = {
      chart_account_id: category.id,
      allocated_amount: currentAmount,
      cadence: selectedCadence,
      is_active: true
    };

    createBudgetMutation.mutate(budgetData);
  };

  if (!category) return null;

  const IconComponent = category.icon && LucideIcons[category.icon]
    ? LucideIcons[category.icon]
    : LucideIcons.Circle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add {actionLabel} for {category.display_name || category.account_detail}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: category.color || '#52A5CE' }}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-900">
                {category.display_name || category.account_detail}
              </div>
              <div className="text-xs text-slate-500 capitalize">
                {category.class} Category
              </div>
            </div>
          </div>

          {totalBudgetedIncomeMonthly > 0 && category.class === 'expense' && (
            <div className={`p-4 rounded-lg border ${
              isOverBudget ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                {isOverBudget ? (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 space-y-2">
                  <div className="text-sm font-medium text-slate-900">
                    {currentAmount > 0 ? 'After Adding This Budget' : 'Available to Budget'}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${
                      isOverBudget ? 'text-red-700' : 'text-blue-700'
                    }`}>
                      {formatCadenceAmount(currentAmount > 0 ? remainingAfterAdd : remainingBeforeAdd, 'monthly')}
                    </span>
                    <span className="text-sm text-slate-600">per month</span>
                  </div>
                  {isOverBudget && (
                    <div className="text-sm text-red-700 mt-2">
                      This would exceed your income by {formatCadenceAmount(Math.abs(remainingAfterAdd), 'monthly')}.
                      Maximum you can budget: {formatCadenceAmount(maxAllowableMonthly, 'monthly')} per month.
                    </div>
                  )}
                  {!isOverBudget && currentAmount > 0 && (
                    <div className="text-xs text-slate-600">
                      Currently available: {formatCadenceAmount(remainingBeforeAdd, 'monthly')} per month
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {totalBudgetedIncomeMonthly === 0 && category.class === 'expense' && (
            <div className="p-4 rounded-lg border bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  Set up your income budget first to see how much you can allocate to expenses.
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Time Period</Label>
            <RadioGroup
              value={selectedCadence}
              onValueChange={setSelectedCadence}
              className="grid grid-cols-4 gap-2 mt-2"
            >
              {['daily', 'weekly', 'monthly', 'yearly'].map((cadence) => (
                <div key={cadence}>
                  <RadioGroupItem
                    value={cadence}
                    id={`cadence-${cadence}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`cadence-${cadence}`}
                    className="flex items-center justify-center rounded-md border-2 border-slate-200 bg-white p-3 hover:bg-slate-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all text-sm font-medium capitalize"
                  >
                    {cadence}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="amount">{actionLabel} Amount</Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">$</span>
              <Input
                id="amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="pl-8 h-12 text-lg"
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Enter the amount you want to budget per {selectedCadence === 'daily' ? 'day' : selectedCadence === 'weekly' ? 'week' : selectedCadence === 'monthly' ? 'month' : 'year'}
            </p>
          </div>

          {historicalSuggestion && (
            <div className="p-3 rounded-lg bg-slate-50 border">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 mb-1">
                    Based on Your History
                  </div>
                  <div className="text-xs text-slate-600 mb-2">
                    Average: {formatCadenceAmount(historicalSuggestion.avgMonthly, 'monthly')} per month
                    {' '}({historicalSuggestion.transactionCount} transactions across {historicalSuggestion.monthsWithData} {historicalSuggestion.monthsWithData === 1 ? 'month' : 'months'})
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestionClick}
                    className="h-7 text-xs"
                  >
                    Use This Amount
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!amount || currentAmount <= 0 || isOverBudget || createBudgetMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {createBudgetMutation.isPending ? `Adding ${actionLabel}...` : `Add ${actionLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
