import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
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

export default function BudgetCategoryList({ budgets, spendingByCategory, isIncome = false, unbudgetedAmount = 0 }) {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => firstsavvy.entities.Category.list('name')
  });

  const getCategoryById = (id) => categories.find(c => c.id === id);

  const getBudgetColor = (budget) => {
    if (budget.color) return budget.color;
    const category = getCategoryById(budget.category_id);
    if (category?.color) return category.color;
    return '#64748b';
  };

  if (budgets.length === 0 && unbudgetedAmount === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No budgets set up yet.</p>
        <p className="text-sm mt-1">Go to the Setup tab to create your budget.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {budgets.filter(budget => {
        const category = getCategoryById(budget.category_id);
        return category?.detail_type !== 'transfer';
      }).map((budget) => {
        const spent = spendingByCategory[budget.category_id] || spendingByCategory[budget.name] || 0;
        const percent = (spent / budget.limit_amount) * 100;
        const remaining = budget.limit_amount - spent;
        const budgetColor = getBudgetColor(budget);
        const category = getCategoryById(budget.category_id);

        return (
          <div
            key={budget.id}
            className="py-3 flex items-center gap-3"
          >
            <div className="w-44 flex items-center gap-2.5 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: budgetColor }}
              >
                {category?.icon && ICON_MAP[category.icon] && React.createElement(ICON_MAP[category.icon], { className: "w-4 h-4 text-white" })}
              </div>
              <span className="text-sm font-medium text-slate-900">{budget.name || category?.name}</span>
            </div>

            <div className="flex-1 flex items-center">
              <div className="w-full relative h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: budgetColor }}
                />
              </div>
            </div>

            <div className="w-32 text-right flex-shrink-0">
              <span className="text-xs text-slate-600 font-medium">
                ${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-slate-400"> / </span>
              <span className="text-xs text-slate-600 font-medium">
                ${budget.limit_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="w-28 text-right flex-shrink-0">
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
          </div>
        );
      })}

      {unbudgetedAmount > 0 && (
        <div className="py-2.5 flex items-center gap-3">
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
  );
}