import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle
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
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle
};

export default function BudgetSetupTable({ budgets, groups, onEditBudget, onEditGroup }) {
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {};
    groups.forEach(g => { initial[g.id] = true; });
    return initial;
  });

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
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

  const renderGroup = (group) => {
    const groupBudgets = budgets.filter(b => b.group_id === group.id).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (groupBudgets.length === 0) return null;

    const isExpanded = expandedGroups[group.id];
    const isIncome = group.type === 'income';

    const totals = groupBudgets.reduce((acc, budget) => {
      const monthlyAmount = budget.allocated_amount || 0;
      return {
        daily: acc.daily + calculatePeriodAmount(monthlyAmount, 'daily'),
        weekly: acc.weekly + calculatePeriodAmount(monthlyAmount, 'weekly'),
        monthly: acc.monthly + monthlyAmount,
        yearly: acc.yearly + calculatePeriodAmount(monthlyAmount, 'yearly')
      };
    }, { daily: 0, weekly: 0, monthly: 0, yearly: 0 });

    return (
      <div key={group.id} className={cn("mb-6 border rounded-lg overflow-hidden bg-white", isIncome ? "border-l-4 border-l-green-500" : "border-l-4 border-l-orange-500")}>
        {/* Header Row */}
        <div className="flex items-center gap-2 py-2 px-3 bg-white border-b border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 hover:bg-slate-100"
            onClick={() => toggleGroup(group.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-600" />
            )}
          </Button>

          <span className="font-semibold text-sm text-slate-900 min-w-[200px]">{group.name}</span>

          {/* Column Headers */}
          <div className="flex-1 flex items-center justify-end gap-2">
            <span className="w-24 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Daily</span>
            <span className="w-24 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Weekly</span>
            <span className="w-28 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Monthly</span>
            <span className="w-28 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Yearly</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-slate-100 ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onEditGroup?.(group);
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-slate-500" />
          </Button>
        </div>

        {isExpanded && (
          <>
            {/* Budget Items */}
            {groupBudgets.map((budget) => {
              const Icon = ICON_MAP[budget.icon] || Circle;
              const monthlyAmount = budget.allocated_amount || 0;

              return (
                <div
                  key={budget.id}
                  className="flex items-center gap-2 py-1.5 px-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group"
                  onClick={() => onEditBudget?.(budget)}
                >
                  <div className="w-5"></div>

                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: budget.color || '#94a3b8' }}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>

                  <span className="text-sm text-slate-900 min-w-[200px]">{budget.name}</span>

                  {/* Amount Columns */}
                  <div className="flex-1 flex items-center justify-end gap-2 text-sm">
                    <div className="w-24 text-center tabular-nums">
                      <span className="text-slate-500">$</span>{' '}<span className="text-slate-700">{formatAmount(calculatePeriodAmount(monthlyAmount, 'daily'), 'daily')}</span>
                    </div>
                    <div className="w-24 text-center tabular-nums">
                      <span className="text-slate-500">$</span>{' '}<span className="text-slate-700">{formatAmount(calculatePeriodAmount(monthlyAmount, 'weekly'), 'weekly')}</span>
                    </div>
                    <div className="w-28 text-center tabular-nums font-semibold">
                      <span className="text-slate-500">$</span>{' '}<span className="text-slate-900">{formatAmount(monthlyAmount, 'monthly')}</span>
                    </div>
                    <div className="w-28 text-center tabular-nums">
                      <span className="text-slate-500">$</span>{' '}<span className="text-slate-700">{formatAmount(calculatePeriodAmount(monthlyAmount, 'yearly'), 'yearly')}</span>
                    </div>
                  </div>

                  <div className="w-6"></div>
                </div>
              );
            })}
          </>
        )}

        {/* Total Row */}
        <div className="flex items-center gap-2 py-2 px-3 bg-slate-50">
          <div className="w-5"></div>
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

          <div className="w-6"></div>
        </div>
      </div>
    );
  };

  const sortedGroups = [...groups].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-0">
      {sortedGroups.map(group => renderGroup(group))}
    </div>
  );
}
