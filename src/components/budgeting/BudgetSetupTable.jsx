import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle, Baby
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle, Baby
};

export default function BudgetSetupTable({ budgets, onEditBudget }) {
  const [expandedSections, setExpandedSections] = useState({
    income: true,
    expense: true
  });
  const [expandedParents, setExpandedParents] = useState(new Set());

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleParent = (parentId) => {
    setExpandedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  const calculatePeriodAmount = (monthlyAmount, period) => {
    if (!monthlyAmount) return 0;
    const DAYS_PER_YEAR = 365;
    const WEEKS_PER_YEAR = 52;
    const MONTHS_PER_YEAR = 12;

    const yearly = monthlyAmount * MONTHS_PER_YEAR;

    switch (period) {
      case 'daily':
        return yearly / DAYS_PER_YEAR;
      case 'weekly':
        return Math.ceil(yearly / WEEKS_PER_YEAR);
      case 'monthly':
        return Math.ceil(monthlyAmount);
      case 'yearly':
        return Math.ceil(yearly);
      default:
        return monthlyAmount;
    }
  };

  const formatAmount = (amount, period) => {
    if (period === 'daily') {
      return amount.toFixed(2);
    }

    if (amount >= 1000) {
      return (amount / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }

    return Math.round(amount).toString();
  };

  const incomeBudgets = budgets.filter(b => b.chartAccount?.class === 'income');
  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

  const renderBudgetRow = (budget, isChild = false) => {
    const Icon = ICON_MAP[budget.chartAccount?.icon] || Circle;
    const monthlyAmount = budget.allocated_amount || 0;
    const children = budgets.filter(b => b.chartAccount?.parent_account_id === budget.chart_account_id);
    const hasChildren = children.length > 0;
    const isParentExpanded = expandedParents.has(budget.chart_account_id);

    return (
      <React.Fragment key={budget.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 border-b border-slate-100 hover:bg-slate-50 transition-colors group",
            isChild ? "bg-slate-50/50" : ""
          )}
        >
          {!isChild && hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-slate-200 ml-3"
              onClick={(e) => {
                e.stopPropagation();
                toggleParent(budget.chart_account_id);
              }}
            >
              {isParentExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              )}
            </Button>
          ) : (
            <div className={cn("w-5", isChild ? "ml-8" : "ml-3")}></div>
          )}

          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
            style={{ backgroundColor: budget.chartAccount?.color || '#94a3b8' }}
            onClick={() => onEditBudget?.(budget)}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>

          <span
            className={cn(
              "text-sm min-w-[200px] cursor-pointer",
              isChild ? "text-slate-700 pl-2" : "text-slate-900"
            )}
            onClick={() => onEditBudget?.(budget)}
          >
            {isChild && (
              <span className="text-slate-400 mr-1.5">└</span>
            )}
            {budget.chartAccount?.display_name || budget.chartAccount?.account_detail || 'Unnamed'}
          </span>

          <div className="flex-1 flex items-center justify-end gap-2 text-sm">
            <div className="w-24 text-center tabular-nums">
              <span className="text-slate-500">$</span>{' '}<span className={cn(isChild ? "text-slate-600" : "text-slate-700")}>{formatAmount(calculatePeriodAmount(monthlyAmount, 'daily'), 'daily')}</span>
            </div>
            <div className="w-24 text-center tabular-nums">
              <span className="text-slate-500">$</span>{' '}<span className={cn(isChild ? "text-slate-600" : "text-slate-700")}>{formatAmount(calculatePeriodAmount(monthlyAmount, 'weekly'), 'weekly')}</span>
            </div>
            <div className={cn("w-28 text-center tabular-nums", isChild ? "" : "font-semibold")}>
              <span className="text-slate-500">$</span>{' '}<span className={cn(isChild ? "text-slate-700" : "text-slate-900")}>{formatAmount(monthlyAmount, 'monthly')}</span>
            </div>
            <div className="w-28 text-center tabular-nums">
              <span className="text-slate-500">$</span>{' '}<span className={cn(isChild ? "text-slate-600" : "text-slate-700")}>{formatAmount(calculatePeriodAmount(monthlyAmount, 'yearly'), 'yearly')}</span>
            </div>
          </div>
        </div>

        {hasChildren && isParentExpanded && children.map(childBudget => renderBudgetRow(childBudget, true))}
      </React.Fragment>
    );
  };

  const renderSection = (title, sectionBudgets, sectionKey, isIncome) => {
    if (sectionBudgets.length === 0) return null;

    const isExpanded = expandedSections[sectionKey];

    const parentBudgets = sectionBudgets.filter(b => !b.chartAccount?.parent_account_id);

    const totals = parentBudgets.reduce((acc, budget) => {
      const monthlyAmount = budget.allocated_amount || 0;
      return {
        daily: acc.daily + calculatePeriodAmount(monthlyAmount, 'daily'),
        weekly: acc.weekly + calculatePeriodAmount(monthlyAmount, 'weekly'),
        monthly: acc.monthly + monthlyAmount,
        yearly: acc.yearly + calculatePeriodAmount(monthlyAmount, 'yearly')
      };
    }, { daily: 0, weekly: 0, monthly: 0, yearly: 0 });

    return (
      <div key={sectionKey} className={cn("mb-6 border rounded-lg overflow-hidden bg-white", isIncome ? "border-l-4 border-l-green-500" : "border-l-4 border-l-orange-500")}>
        <div className="flex items-center gap-2 py-2 px-3 bg-white border-b border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 hover:bg-slate-100"
            onClick={() => toggleSection(sectionKey)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-600" />
            )}
          </Button>

          <span className="font-semibold text-sm text-slate-900 min-w-[200px]">{title}</span>

          <div className="flex-1 flex items-center justify-end gap-2">
            <span className="w-24 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Daily</span>
            <span className="w-24 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Weekly</span>
            <span className="w-28 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Monthly</span>
            <span className="w-28 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Yearly</span>
          </div>
        </div>

        {isExpanded && (
          <>
            {parentBudgets.map(budget => renderBudgetRow(budget, false))}
          </>
        )}

        <div className="flex items-center gap-2 py-2 px-3 bg-slate-50">
          <div className="w-5 ml-3"></div>
          <div className="w-7"></div>
          <span className="text-sm font-semibold text-slate-900 min-w-[200px]">Total</span>

          <div className="flex-1 flex items-center justify-end gap-2 text-sm font-semibold tabular-nums">
            <div className="w-24 text-center text-slate-900">
              ${formatAmount(totals.daily, 'daily')}
            </div>
            <div className="w-24 text-center text-slate-900">
              ${formatAmount(totals.weekly, 'weekly')}
            </div>
            <div className="w-28 text-center font-bold text-slate-900">
              ${formatAmount(totals.monthly, 'monthly')}
            </div>
            <div className="w-28 text-center text-slate-900">
              ${formatAmount(totals.yearly, 'yearly')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-0">
      {renderSection('Income', incomeBudgets, 'income', true)}
      {renderSection('Expenses', expenseBudgets, 'expense', false)}
    </div>
  );
}
