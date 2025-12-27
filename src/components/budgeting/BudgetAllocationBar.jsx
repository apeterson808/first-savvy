import React, { useState } from 'react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

export default function BudgetAllocationBar({ budgets, budgetGroups }) {
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

  const totalBudgeted = expenseBudgets.reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

  if (totalBudgeted === 0 || expenseBudgets.length === 0) {
    return null;
  }

  const budgetSegments = expenseBudgets
    .map(budget => ({
      id: budget.id,
      name: budget.chartAccount?.display_name || budget.chartAccount?.account_detail || 'Unknown',
      amount: budget.allocated_amount || 0,
      color: budget.chartAccount?.color || '#64748b',
      icon: budget.chartAccount?.icon,
      percentage: ((budget.allocated_amount || 0) / totalBudgeted) * 100
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Budget Allocation
        </h3>
        <span className="text-xs text-slate-500">
          ${totalBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total
        </span>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="flex w-full h-10 rounded-lg overflow-hidden shadow-sm border border-slate-200">
          {budgetSegments.map((segment, index) => {
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
                    {segment.percentage > 8 && Icon && (
                      <Icon className="w-4 h-4 text-white/90" />
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

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {budgetSegments.slice(0, 5).map((segment) => {
          const Icon = segment.icon && ICON_MAP[segment.icon];
          return (
            <div
              key={segment.id}
              className="flex items-center gap-1.5 cursor-pointer transition-opacity"
              style={{ opacity: hoveredCategory && hoveredCategory !== segment.id ? 0.5 : 1 }}
              onMouseEnter={() => setHoveredCategory(segment.id)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-xs text-slate-600 truncate max-w-[120px]">
                {segment.name}
              </span>
              <span className="text-xs text-slate-400">
                {segment.percentage.toFixed(0)}%
              </span>
            </div>
          );
        })}
        {budgetSegments.length > 5 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">
              +{budgetSegments.length - 5} more
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
