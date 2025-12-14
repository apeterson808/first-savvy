import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Pencil, Circle } from 'lucide-react';
import {
  Home, ShoppingCart, Coffee, Utensils, Car, Plane, Hotel,
  Smartphone, Laptop, Tv, Music, Gamepad, Book, GraduationCap,
  Briefcase, DollarSign, CreditCard, Wallet, PiggyBank, TrendingUp,
  Heart, Activity, Pill, Stethoscope, Dumbbell, Apple,
  Shirt, Watch, Scissors, Paintbrush, Palette,
  Gift, PartyPopper, Beer, Pizza, IceCream, Cake,
  Bus, Train, Bike, Fuel, Wrench, Hammer,
  Lightbulb, Zap, Droplet, Wifi, Phone, Mail,
  ShoppingBag, Package, Tag, Store, Building, Factory,
  Trees, Flower2, Leaf, Umbrella, CloudRain, Sun,
  Moon, Star, Sparkles, Crown, Trophy, Award,
  Film, Camera, Video, Headphones, Mic, Radio,
  Dog, Cat, Fish, Bird, Bone, PawPrint
} from 'lucide-react';

import { toast } from 'sonner';
import BudgetConflictDialog from './BudgetConflictDialog';
import BudgetCategoryDetailSheet from './BudgetCategoryDetailSheet';

const ICON_MAP = {
  Home, ShoppingCart, Coffee, Utensils, Car, Plane, Hotel,
  Smartphone, Laptop, Tv, Music, Gamepad, Book, GraduationCap,
  Briefcase, DollarSign, CreditCard, Wallet, PiggyBank, TrendingUp,
  Heart, Activity, Pill, Stethoscope, Dumbbell, Apple,
  Shirt, Watch, Scissors, Paintbrush, Palette,
  Gift, PartyPopper, Beer, Pizza, IceCream, Cake,
  Bus, Train, Bike, Fuel, Wrench, Hammer,
  Lightbulb, Zap, Droplet, Wifi, Phone, Mail,
  ShoppingBag, Package, Tag, Store, Building, Factory,
  Trees, Flower2, Leaf, Umbrella, CloudRain, Sun,
  Moon, Star, Sparkles, Crown, Trophy, Award,
  Film, Camera, Video, Headphones, Mic, Radio,
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle
};

export default function BudgetCategoryList({ budgets, spendingByCategory, onEdit, onDelete, isIncome = false, totalIncome = 0, allBudgets = [], groups = [], unbudgetedAmount = 0 }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictBudget, setConflictBudget] = useState(null);
  const [requestedAmount, setRequestedAmount] = useState(0);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const queryClient = useQueryClient();

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Budget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setEditingId(null);
    }
  });

  const handleStartEdit = (budget) => {
    setEditingId(budget.id);
    setEditValue(budget.limit_amount.toString());
  };

  // Calculate total expenses excluding a specific budget
  const getTotalExpensesExcluding = (excludeBudgetId) => {
    const expenseGroupIds = new Set(groups.filter(g => g.type === 'expense').map(g => g.id));
    return allBudgets
      .filter(b => expenseGroupIds.has(b.group_id) && b.id !== excludeBudgetId)
      .reduce((sum, b) => sum + (b.limit_amount || 0), 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const handleSaveEdit = (budgetId) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    let newAmount;
    try {
      const budget = budgets.find(b => b.id === budgetId);
      if (trimmed.match(/^[+\-*/]/)) {
        newAmount = eval(`${budget.limit_amount}${trimmed}`);
      } else {
        newAmount = eval(trimmed);
      }
    } catch (error) {
      toast.error('Invalid calculation');
      setEditingId(null);
      return;
    }

    if (isNaN(newAmount) || newAmount <= 0) {
      toast.error('Result must be a positive number');
      setEditingId(null);
      return;
    }

    // Replace input with result
    setEditValue(newAmount.toString());

    if (!isIncome && totalIncome > 0) {
      const otherExpenses = getTotalExpensesExcluding(budgetId);
      const newTotalExpenses = otherExpenses + newAmount;
      
      if (newTotalExpenses > totalIncome) {
        const budget = budgets.find(b => b.id === budgetId);
        setConflictBudget(budget);
        setRequestedAmount(newAmount);
        setConflictDialogOpen(true);
        setEditingId(null);
        return;
      }
    }
    updateBudgetMutation.mutate({ id: budgetId, data: { limit_amount: newAmount } });
  };

  const handleConflictSave = async (updates) => {
    // Apply all updates
    for (const update of updates) {
      await base44.entities.Budget.update(update.id, { limit_amount: update.limit_amount });
    }
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    toast.success('Budgets updated successfully');
  };

  const handleKeyDown = (e, budgetId) => {
    if (e.key === 'Enter') {
      handleSaveEdit(budgetId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name')
  });

  const getCategoryById = (id) => categories.find(c => c.id === id);

  const getBudgetColor = (budget) => {
    // Use budget's own color first
    if (budget.color) return budget.color;
    // Fallback to category color
    const category = getCategoryById(budget.category_id);
    if (category?.color) return category.color;
    // Final fallback
    return '#64748b';
  };

  const getIconComponent = (category) => {
    if (!category?.icon) return null;
    const Icon = ICON_MAP[category.icon];
    return Icon ? <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" /> : null;
  };;



  if (budgets.length === 0 && unbudgetedAmount === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No budgets set up yet.</p>
        <p className="text-sm mt-1">Go to the Setup tab to create your budget.</p>
      </div>
    );
  }

  return (
    <>
    <BudgetConflictDialog
      open={conflictDialogOpen}
      onOpenChange={setConflictDialogOpen}
      conflictBudget={conflictBudget}
      requestedAmount={requestedAmount}
      totalIncome={totalIncome}
      allBudgets={allBudgets}
      groups={groups}
      onSave={handleConflictSave}
    />
    <div className="divide-y divide-slate-100">
      {budgets.filter(budget => {
        // Exclude transfer categories from budget display
        const category = getCategoryById(budget.category_id);
        return category?.detail_type !== 'transfer';
      }).map((budget) => {
        // Match by category_id or fall back to budget name for legacy data
        const spent = spendingByCategory[budget.category_id] || spendingByCategory[budget.name] || 0;
        const percent = (spent / budget.limit_amount) * 100;
        const remaining = budget.limit_amount - spent;
        const budgetColor = getBudgetColor(budget);
        const category = getCategoryById(budget.category_id);

        return (
          <div 
            key={budget.id} 
            className="py-2.5 flex items-center gap-3 hover:bg-slate-50 -mx-4 px-4 transition-colors group cursor-pointer"
            onClick={() => {
              setSelectedBudget(budget);
              setDetailSheetOpen(true);
            }}
          >
            {/* Category name with icon on colored background */}
            <div className="min-w-[7rem] flex items-center gap-2">
              <div 
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" 
                style={{ backgroundColor: budgetColor }}
              >
                {category?.icon && ICON_MAP[category.icon] && React.createElement(ICON_MAP[category.icon], { className: "w-4 h-4 text-white" })}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-slate-800">{budget.name || category?.name}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div 
              className="flex-1 flex items-center gap-3"
            >
              <div className="flex-1 relative h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: budgetColor }}
                />
              </div>
            </div>

            {/* Amounts */}
            <div className="w-32 text-right flex-shrink-0">
              <span className="text-xs text-slate-500">
                ${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-slate-400"> / </span>
              {editingId === budget.id ? (
                <span className="inline-flex items-center gap-1">
                  <span className="text-xs text-slate-600">$</span>
                  <Input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.+\-*/]/g, ''))}
                    onKeyDown={(e) => handleKeyDown(e, budget.id)}
                    onBlur={() => handleSaveEdit(budget.id)}
                    className="h-5 w-16 text-xs px-1 py-0"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                </span>
              ) : (
                <span 
                  className="text-xs text-slate-600 cursor-pointer hover:text-blue-600 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(budget);
                  }}
                >
                  ${budget.limit_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>

            {/* Remaining/Over */}
            <div className="w-24 text-right flex-shrink-0">
              {isIncome ? (
                <span className={`text-xs font-medium ${remaining <= 0 ? 'text-green-600' : 'text-slate-500'}`}>
                  {remaining <= 0 ? 'Goal met!' : `$${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} to go`}
                </span>
              ) : (
                <span className={`text-xs font-medium ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {remaining >= 0 ? `$${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} left` : `-$${Math.abs(remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </span>
              )}
            </div>

            {/* Spacer for alignment */}
            <div className="h-6 w-6" />
            </div>
            );
            })}

      {unbudgetedAmount > 0 && (
        <div className="py-2.5 flex items-center gap-3 hover:bg-slate-50 -mx-4 px-4 transition-colors group">
          <div className="w-28 flex-shrink-0">
            <span className="text-sm font-medium text-slate-800">{isIncome ? 'Other Income' : 'Other Expenses'}</span>
          </div>
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 relative h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all bg-slate-400"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div className="w-32 text-right flex-shrink-0">
            <span className="text-sm font-medium text-slate-600">
              ${unbudgetedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="w-24 text-right flex-shrink-0">
            <span className="text-xs font-medium text-slate-500">Unbudgeted</span>
          </div>
          <div className="h-6 w-6" />
        </div>
      )}
            </div>

      <BudgetCategoryDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        budget={selectedBudget}
        category={selectedBudget ? getCategoryById(selectedBudget.category_id) : null}
        currentSpent={selectedBudget ? (spendingByCategory[selectedBudget.category_id] || spendingByCategory[selectedBudget.name] || 0) : 0}
      />
            </>
            );
            }