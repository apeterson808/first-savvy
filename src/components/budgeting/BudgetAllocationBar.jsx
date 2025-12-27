import React, { useState } from 'react';
import {
  Home, House, ShoppingCart, Coffee, Utensils, Car, Plane, Hotel,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { convertCadence } from '@/utils/cadenceUtils';

const ICON_MAP = {
  Home, House, ShoppingCart, Coffee, Utensils, Car, Plane, Hotel,
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

export default function BudgetAllocationBar({ budgets, budgetGroups }) {
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [selectedCadence, setSelectedCadence] = useState('monthly');

  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');
  const incomeBudgets = budgets.filter(b => b.chartAccount?.class === 'income');

  const totalExpenseBudgeted = expenseBudgets.reduce((sum, b) => {
    const convertedAmount = convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', selectedCadence);
    return sum + convertedAmount;
  }, 0);

  const totalIncomeBudgeted = incomeBudgets.reduce((sum, b) => {
    const convertedAmount = convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', selectedCadence);
    return sum + convertedAmount;
  }, 0);

  const unallocated = Math.max(0, totalIncomeBudgeted - totalExpenseBudgeted);

  if (totalExpenseBudgeted === 0 || expenseBudgets.length === 0) {
    return null;
  }

  const totalForBar = totalIncomeBudgeted > 0 ? totalIncomeBudgeted : totalExpenseBudgeted;

  const budgetSegments = expenseBudgets
    .map(budget => {
      const convertedAmount = convertCadence(parseFloat(budget.allocated_amount || 0), budget.cadence || 'monthly', selectedCadence);
      return {
        id: budget.id,
        name: budget.chartAccount?.display_name || budget.chartAccount?.account_detail || 'Unknown',
        amount: convertedAmount,
        color: budget.chartAccount?.color || '#64748b',
        icon: budget.chartAccount?.icon,
        percentage: (convertedAmount / totalForBar) * 100
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const unallocatedSegment = unallocated > 0 ? {
    id: 'unallocated',
    name: 'Unallocated',
    amount: unallocated,
    color: '#e2e8f0',
    icon: null,
    percentage: (unallocated / totalForBar) * 100
  } : null;

  const allSegments = unallocatedSegment ? [...budgetSegments, unallocatedSegment] : budgetSegments;

  const cadenceLabels = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly'
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">
          Budget Allocation
        </h3>
        <div className="flex items-center gap-3">
          <Select value={selectedCadence} onValueChange={setSelectedCadence}>
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500">
            ${totalIncomeBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total Income
          </span>
        </div>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="flex w-full h-10 rounded-lg overflow-hidden shadow-sm border border-slate-200">
          {allSegments.map((segment, index) => {
            const Icon = segment.icon && ICON_MAP[segment.icon];
            const isHovered = hoveredCategory === segment.id;

            return (
              <Tooltip key={segment.id}>
                <TooltipTrigger asChild>
                  <div
                    className="relative flex items-center justify-center transition-all duration-200 cursor-pointer"
                    style={{
                      width: `${segment.percentage}%`,
                      backgroundColor: segment.color,
                      opacity: hoveredCategory && !isHovered ? 0.5 : 1,
                      transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                      zIndex: isHovered ? 10 : index
                    }}
                    onMouseEnter={() => setHoveredCategory(segment.id)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    {segment.percentage > 5 && Icon && (
                      <Icon className="w-4 h-4 text-white/90 drop-shadow" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-white border border-slate-200 shadow-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {Icon && (
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ backgroundColor: segment.color }}
                      >
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <span className="font-medium text-slate-900">{segment.name}</span>
                  </div>
                  <div className="text-sm space-y-0.5">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Budgeted:</span>
                      <span className="font-medium text-slate-900">
                        ${segment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Allocation:</span>
                      <span className="font-medium text-slate-900">
                        {segment.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      <div className="mt-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Income:</span>
          <span className="text-sm font-semibold text-emerald-600">
            ${totalIncomeBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="text-slate-400">-</div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Expenses:</span>
          <span className="text-sm font-semibold text-rose-600">
            ${totalExpenseBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="text-slate-400">=</div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Remaining:</span>
          <span className={`text-sm font-bold ${unallocated > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            ${unallocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
