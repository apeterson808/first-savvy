import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Pencil, Plus, Sparkles, Loader2 } from 'lucide-react';
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
  Moon, Star, Sparkles as SparklesIcon, Crown, Trophy, Award,
  Film, Camera, Video, Headphones, Mic, Radio,
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle
} from 'lucide-react';
import { subMonths } from 'date-fns';
import { toast } from 'sonner';
import { suggestIconForName } from '../utils/iconMapper';
import AddBudgetItemSheet from './AddBudgetItemSheet';
import BudgetAllocationGauge from './BudgetAllocationGauge';

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
  Moon, Star, Sparkles: SparklesIcon, Crown, Trophy, Award,
  Film, Camera, Video, Headphones, Mic, Radio,
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle
};

const BUDGET_COLORS = [
  '#AACC96', '#25533F', '#F4BEAE', '#52A5CE', '#FF7BAC',
  '#876029', '#6D1F42', '#D3B6D3', '#EFCE7B', '#B8CEE8',
  '#EF6F3C', '#AFAB23'
];

const getNextColor = (usedColors) => {
  for (const color of BUDGET_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
};

export default function BudgetSetupTab() {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ['budgetGroups'],
    queryFn: () => base44.entities.BudgetGroup.list('order')
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.Budget.list('order')
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list()
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date', 1000)
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (id) => base44.entities.Budget.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] })
  });

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const getCategory = (id) => categories.find(c => c.id === id);

  const getBudgetColor = (budget) => {
    if (budget.color) return budget.color;
    const category = getCategory(budget.category_id);
    if (category?.color) return category.color;
    return '#64748b';
  };

  const getGroupBudgets = (groupId) => {
    return budgets.filter(b => b.group_id === groupId).sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined && (a.order !== 0 || b.order !== 0)) {
        if (a.order !== b.order) return a.order - b.order;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  };

  const getGroupTotal = (groupId) => {
    return getGroupBudgets(groupId).reduce((sum, b) => sum + (b.limit_amount || 0), 0);
  };

  const incomeGroups = groups.filter(g => g.type === 'income');
  const incomeGroupIds = new Set(incomeGroups.map(g => g.id));
  const totalIncome = budgets
    .filter(b => incomeGroupIds.has(b.group_id))
    .reduce((sum, b) => sum + (b.limit_amount || 0), 0);

  const getDaily = (monthly) => monthly / 30;
  const getWeekly = (monthly) => monthly / 4;
  const getYearly = (monthly) => monthly * 12;

  const handleAutoCreate = async () => {
    setIsAutoCreating(true);

    const twelveMonthsAgo = subMonths(new Date(), 12);
    const recentTransactions = transactions.filter(t =>
      new Date(t.date) >= twelveMonthsAgo && t.status === 'posted'
    );

    const expenseSpending = {};
    const incomeSpending = {};

    recentTransactions.forEach(t => {
      if (t.type === 'expense' && t.category_id) {
        expenseSpending[t.category_id] = (expenseSpending[t.category_id] || 0) + t.amount;
      } else if (t.type === 'income' && t.category_id) {
        incomeSpending[t.category_id] = (incomeSpending[t.category_id] || 0) + t.amount;
      }
    });

    for (const category of categories) {
      if (!category.icon) {
        const suggestedIcon = suggestIconForName(category.name);
        await base44.entities.Category.update(category.id, { icon: suggestedIcon });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['categories'] });

    if (Object.keys(incomeSpending).length > 0) {
      const incomeGroup = await base44.entities.BudgetGroup.create({
        name: 'Income',
        type: 'income',
        order: 0
      });

      const sortedIncomeCategories = Object.entries(incomeSpending).sort((a, b) =>
        (getCategory(a[0])?.name || 'Unknown').localeCompare(getCategory(b[0])?.name || 'Unknown')
      );

      let order = 0;
      const usedColors = new Set();
      for (const [categoryId, total] of sortedIncomeCategories) {
        const monthlyAvg = total / 12;
        const rounded = Math.ceil(monthlyAvg / 10) * 10;
        const category = getCategory(categoryId);
        const color = category?.color || getNextColor(usedColors);
        usedColors.add(color);

        const updatedCategory = categories.find(c => c.id === categoryId);

        await base44.entities.Budget.create({
          name: category?.name || 'Unknown',
          category_id: categoryId,
          limit_amount: Math.max(rounded, 10),
          group_id: incomeGroup.id,
          order: order++,
          color,
          is_active: true
        });
      }
    }

    if (Object.keys(expenseSpending).length > 0) {
      const expenseGroup = await base44.entities.BudgetGroup.create({
        name: 'Expenses',
        type: 'expense',
        order: 1
      });

      const sortedExpenseCategories = Object.entries(expenseSpending).sort((a, b) =>
        (getCategory(a[0])?.name || 'Unknown').localeCompare(getCategory(b[0])?.name || 'Unknown')
      );

      let order = 0;
      const usedExpenseColors = new Set();
      for (const [categoryId, total] of sortedExpenseCategories) {
        const monthlyAvg = total / 12;
        const rounded = Math.ceil(monthlyAvg / 10) * 10;
        const category = getCategory(categoryId);
        const color = category?.color || getNextColor(usedExpenseColors);
        usedExpenseColors.add(color);

        await base44.entities.Budget.create({
          name: category?.name || 'Unknown',
          category_id: categoryId,
          limit_amount: Math.max(rounded, 10),
          group_id: expenseGroup.id,
          order: order++,
          color,
          is_active: true
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    setIsAutoCreating(false);

    toast.success('Budget created successfully! Check out your Overview tab.');

    setTimeout(() => {
      const newUrl = `${window.location.pathname}?tab=overview`;
      window.history.pushState({}, '', newUrl);
      window.dispatchEvent(new Event('popstate'));
    }, 1500);
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setAddSheetOpen(true);
  };

  const handleDelete = (id) => {
    deleteBudgetMutation.mutate(id);
  };

  return (
    <div className={groups.length === 0 ? "" : "flex gap-3 p-6"}>
      <div className={groups.length === 0 ? "" : "flex-1"}>
        {groups.length === 0 ? (
          <div className="min-h-[600px] flex items-center justify-center bg-slate-50/30">
            <div className="text-center max-w-xl px-6">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-7 h-7 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">Set Up Your Budget</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                {transactions.length > 0
                  ? "We can automatically create budget categories based on your spending and income history from the last 12 months."
                  : "Start by creating budget groups to organize your spending categories."
                }
              </p>
              <div className="flex gap-3 justify-center">
                {transactions.length > 0 && (
                  <Button
                    onClick={handleAutoCreate}
                    disabled={isAutoCreating}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    size="lg"
                  >
                    {isAutoCreating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Auto-Create from History
                  </Button>
                )}
                <Button onClick={() => setAddSheetOpen(true)} variant="outline" size="lg" className="border-slate-300">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Manually
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {[...groups].sort((a, b) => (a.order || 0) - (b.order || 0)).map((group) => (
              <Card key={group.id} className="mb-4 shadow-sm border-slate-200">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedGroups[group.id] ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="font-medium text-sm text-slate-800">{group.name}</span>
                  </div>
                  <span className="text-xs text-slate-500">${getGroupTotal(group.id).toLocaleString()}/mo</span>
                </div>

                {expandedGroups[group.id] && (
                  <CardContent className="pt-0 pb-2">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide py-2">Icon</th>
                          <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide py-2">Name</th>
                          <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide py-2">Daily</th>
                          <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide py-2">Weekly</th>
                          <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide py-2">Monthly</th>
                          <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide py-2">Yearly</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {getGroupBudgets(group.id).map((budget) => {
                          const budgetColor = getBudgetColor(budget);
                          const category = getCategory(budget.category_id);
                          return (
                            <tr key={budget.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-2">
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: budgetColor }}
                                >
                                  {category?.icon && ICON_MAP[category.icon] && React.createElement(ICON_MAP[category.icon], { className: "w-3.5 h-3.5 text-white" })}
                                </div>
                              </td>
                              <td className="py-2">
                                <span className="text-sm text-slate-700">{budget.name || category?.name}</span>
                              </td>
                              <td className="py-2 text-right text-xs text-slate-600">
                                ${getDaily(budget.limit_amount).toFixed(2)}
                              </td>
                              <td className="py-2 text-right text-xs text-slate-600">
                                ${getWeekly(budget.limit_amount).toFixed(0)}
                              </td>
                              <td className="py-2 text-right text-sm font-medium text-slate-700">
                                ${budget.limit_amount.toFixed(0)}
                              </td>
                              <td className="py-2 text-right text-xs text-slate-600">
                                ${getYearly(budget.limit_amount).toFixed(0)}
                              </td>
                              <td className="py-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleEdit(budget)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-100 font-semibold">
                          <td className="py-2" colSpan="2">
                            <span className="text-sm text-slate-700">Total</span>
                          </td>
                          <td className="py-2 text-right text-xs text-slate-600">
                            ${getDaily(getGroupTotal(group.id)).toFixed(2)}
                          </td>
                          <td className="py-2 text-right text-xs text-slate-600">
                            ${getWeekly(getGroupTotal(group.id)).toFixed(0)}
                          </td>
                          <td className="py-2 text-right text-sm font-bold text-slate-800">
                            ${getGroupTotal(group.id).toFixed(0)}
                          </td>
                          <td className="py-2 text-right text-xs text-slate-600">
                            ${getYearly(getGroupTotal(group.id)).toFixed(0)}
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        <AddBudgetItemSheet
          open={addSheetOpen}
          onOpenChange={(open) => {
            setAddSheetOpen(open);
            if (!open) setEditingBudget(null);
          }}
          groups={groups}
          editingBudget={editingBudget}
          onDelete={handleDelete}
        />
      </div>

      {groups.length > 0 && (
        <div className="w-72 flex-shrink-0">
          <BudgetAllocationGauge
            budgets={budgets}
            groups={groups}
            totalIncome={totalIncome}
          />
        </div>
      )}
    </div>
  );
}
