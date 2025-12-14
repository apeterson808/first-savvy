import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Trash2, ChevronDown, ChevronRight,
  Sparkles, Loader2, Undo2, Pencil, Settings, GripVertical,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { subMonths } from 'date-fns';
import { toast } from 'sonner';
import { suggestIconForName } from '../utils/iconMapper';

import AddBudgetItemSheet from './AddBudgetItemSheet';
import EditBudgetGroupSheet from './EditBudgetGroupSheet';
import BudgetAllocationGauge from './BudgetAllocationGauge';
import BudgetConflictDialog from './BudgetConflictDialog';

const GROUP_COLORS = {
  income: '#AACC96',
  expense: '#EF6F3C'
};

const BUDGET_COLORS = [
  '#AACC96', '#25533F', '#F4BEAE', '#52A5CE', '#FF7BAC',
  '#876029', '#6D1F42', '#D3B6D3', '#EFCE7B', '#B8CEE8',
  '#EF6F3C', '#AFAB23'
];

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

// Generate a unique color that hasn't been used yet
const getNextColor = (usedColors) => {
  for (const color of BUDGET_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  // If all colors used, generate a random one
  return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
};

export default function BudgetSetupTab() {
  const [expandedGroups, setExpandedGroups] = useState(null);
  const [manuallyCollapsed, setManuallyCollapsed] = useState({});
  
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [editGroupSheetOpen, setEditGroupSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [isReorderingGroups, setIsReorderingGroups] = useState(false);
  
  // Conflict dialog state for inline editing
  const [inlineConflictDialogOpen, setInlineConflictDialogOpen] = useState(false);
  const [inlineConflictBudget, setInlineConflictBudget] = useState(null);
  const [inlineRequestedAmount, setInlineRequestedAmount] = useState(0);
  
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ['budgetGroups'],
    queryFn: () => base44.entities.BudgetGroup.list('order')
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.Budget.list('order')
  });

  const { data: customCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list()
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date', 1000)
  });

  const createGroupMutation = useMutation({
        mutationFn: (data) => base44.entities.BudgetGroup.create(data),
        onSuccess: (newGroup) => {
          pushUndo({ type: 'create_group', id: newGroup.id });
          queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
        }
      });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BudgetGroup.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgetGroups'] })
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id) => base44.entities.BudgetGroup.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgetGroups'] })
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data) => base44.entities.Budget.create(data),
    onSuccess: (newBudgetResult) => {
      pushUndo({ type: 'create_budget', id: newBudgetResult.id });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setAddSheetOpen(false);
    }
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async ({ id, data, skipCategorySync }) => {
      const result = await base44.entities.Budget.update(id, data);
      
      // Sync changes to linked Category if not skipped
      if (!skipCategorySync) {
        const budget = budgets.find(b => b.id === id);
        if (budget?.category_id) {
          const categoryUpdate = {};
          if (data.name !== undefined) categoryUpdate.name = data.name;
          if (data.color !== undefined) categoryUpdate.color = data.color;
          
          // Sync type based on group
          if (data.group_id !== undefined) {
            const newGroup = groups.find(g => g.id === data.group_id);
            if (newGroup) categoryUpdate.type = newGroup.type;
          }
          
          if (Object.keys(categoryUpdate).length > 0) {
            await base44.entities.Category.update(budget.category_id, categoryUpdate);
          }
        }
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (id) => base44.entities.Budget.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] })
  });

  const pushUndo = (action) => {
    setUndoStack(prev => [...prev.slice(-4), action]); // Keep only last 5 actions
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    
    if (lastAction.type === 'create_budget') {
      await base44.entities.Budget.delete(lastAction.id);
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } else if (lastAction.type === 'delete_budget') {
      await base44.entities.Budget.create(lastAction.data);
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } else if (lastAction.type === 'update_budget') {
      await base44.entities.Budget.update(lastAction.id, lastAction.previousData);
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } else if (lastAction.type === 'create_group') {
      // Delete budgets in this group first, then the group
      const groupBudgets = budgets.filter(b => b.group_id === lastAction.id);
      for (const b of groupBudgets) {
        await base44.entities.Budget.delete(b.id);
      }
      await base44.entities.BudgetGroup.delete(lastAction.id);
      queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } else if (lastAction.type === 'delete_group') {
      const newGroup = await base44.entities.BudgetGroup.create(lastAction.data);
      // Restore budgets with new group id
      for (const b of lastAction.budgets) {
        await base44.entities.Budget.create({ ...b, group_id: newGroup.id });
      }
      queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all budget groups and items? This cannot be undone.')) return;
    
    // Delete all budgets first, then groups
    for (const budget of budgets) {
      await base44.entities.Budget.delete(budget.id);
    }
    for (const group of groups) {
      await base44.entities.BudgetGroup.delete(group.id);
    }
    
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
  };

  const handleAnalyzeWithAI = async () => {
    setIsAnalyzing(true);

    try {
      const twelveMonthsAgo = subMonths(new Date(), 12);
      const recentTransactions = transactions.filter(t =>
        new Date(t.date) >= twelveMonthsAgo && t.status === 'posted'
      );

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-budget-ai`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transactions: recentTransactions,
          categories: customCategories
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze budget');
      }

      const data = await response.json();
      setAiSuggestions(data.suggestions);
    } catch (error) {
      console.error('Error analyzing budget:', error);
      toast.error('Failed to analyze spending. Creating basic budget instead.');
      await handleAutoCreateBasic();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoCreate = async () => {
    setIsAutoCreating(true);

    // Get spending from last 12 months
    const twelveMonthsAgo = subMonths(new Date(), 12);
    const recentTransactions = transactions.filter(t =>
      new Date(t.date) >= twelveMonthsAgo && t.status === 'posted'
    );

    // Calculate expense spending by category_id
    const expenseSpending = {};
    const incomeSpending = {};
    
    recentTransactions.forEach(t => {
      if (t.type === 'expense' && t.category_id) {
        expenseSpending[t.category_id] = (expenseSpending[t.category_id] || 0) + t.amount;
      } else if (t.type === 'income' && t.category_id) {
        incomeSpending[t.category_id] = (incomeSpending[t.category_id] || 0) + t.amount;
      }
    });

    // Helper to get category by id
    const getCategory = (id) => customCategories.find(c => c.id === id);
    
    // Auto-assign icons to categories that don't have them
    for (const category of customCategories) {
      if (!category.icon) {
        const suggestedIcon = suggestIconForName(category.name);
        await base44.entities.Category.update(category.id, { icon: suggestedIcon });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['categories'] });

    // Create Income group if there's income
    if (Object.keys(incomeSpending).length > 0) {
      const incomeGroup = await base44.entities.BudgetGroup.create({
        name: 'Income',
        type: 'income',
        order: 0
      });
      
      // Sort categories alphabetically by name
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
        
        // Get updated category with icon
        const updatedCategory = customCategories.find(c => c.id === categoryId);
        const icon = updatedCategory?.icon || suggestIconForName(category?.name);
        
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

      // Create Expenses group if there are expenses
      if (Object.keys(expenseSpending).length > 0) {
      const expenseGroup = await base44.entities.BudgetGroup.create({
        name: 'Expenses',
        type: 'expense',
        order: 1
      });

      // Sort categories alphabetically by name
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
        
        // Get updated category with icon
        const updatedCategory = customCategories.find(c => c.id === categoryId);
        const icon = updatedCategory?.icon || suggestIconForName(category?.name);
        
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
  };

  const handleAutoCreateBasic = async () => {
    await handleAutoCreate();
  };

  const handleCreateFromSuggestions = async () => {
    if (!aiSuggestions) return;

    setIsAutoCreating(true);

    try {
      const incomeSuggestions = aiSuggestions.filter(s => s.type === 'income');
      const expenseSuggestions = aiSuggestions.filter(s => s.type === 'expense');

      if (incomeSuggestions.length > 0) {
        const incomeGroup = await base44.entities.BudgetGroup.create({
          name: 'Income',
          type: 'income',
          order: 0
        });

        for (let i = 0; i < incomeSuggestions.length; i++) {
          const suggestion = incomeSuggestions[i];
          await base44.entities.Budget.create({
            name: suggestion.category_name,
            category_id: suggestion.category_id,
            limit_amount: suggestion.suggested_amount,
            group_id: incomeGroup.id,
            order: i,
            color: suggestion.color || getNextColor(new Set()),
            is_active: true
          });
        }
      }

      if (expenseSuggestions.length > 0) {
        const expenseGroup = await base44.entities.BudgetGroup.create({
          name: 'Expenses',
          type: 'expense',
          order: 1
        });

        for (let i = 0; i < expenseSuggestions.length; i++) {
          const suggestion = expenseSuggestions[i];
          await base44.entities.Budget.create({
            name: suggestion.category_name,
            category_id: suggestion.category_id,
            limit_amount: suggestion.suggested_amount,
            group_id: expenseGroup.id,
            order: i,
            color: suggestion.color || getNextColor(new Set()),
            is_active: true
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setAiSuggestions(null);
      toast.success('Budget created successfully!');
    } catch (error) {
      console.error('Error creating budget:', error);
      toast.error('Failed to create budget');
    } finally {
      setIsAutoCreating(false);
    }
  };

  const toggleGroup = (groupId) => {
    setManuallyCollapsed(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isGroupExpanded = (groupId) => {
    return !manuallyCollapsed[groupId];
  };



  // Get category by id (for color lookup)
  const getCategory = (id) => customCategories.find(c => c.id === id);

  // Get budget color - prioritize budget color, then category color, then fallback
  const getBudgetColor = (budget) => {
    if (budget.color) return budget.color;
    const category = getCategory(budget.category_id);
    if (category?.color) return category.color;
    return '#64748b';
  };

  const getGroupBudgets = (groupId) => {
    return budgets.filter(b => b.group_id === groupId).sort((a, b) => {
      // If both have explicit order set (non-zero), use order
      if (a.order !== undefined && b.order !== undefined && (a.order !== 0 || b.order !== 0)) {
        if (a.order !== b.order) return a.order - b.order;
      }
      // Otherwise sort alphabetically by name
      return (a.name || '').localeCompare(b.name || '');
    });
  };

  const getGroupTotal = (groupId) => {
    return getGroupBudgets(groupId).reduce((sum, b) => sum + (b.limit_amount || 0), 0);
  };

  // Calculate total income from income groups
  const incomeGroups = groups.filter(g => g.type === 'income');
  const incomeGroupIds = new Set(incomeGroups.map(g => g.id));
  const totalIncome = budgets
    .filter(b => incomeGroupIds.has(b.group_id))
    .reduce((sum, b) => sum + (b.limit_amount || 0), 0);

  // Get existing budget colors for auto-assignment
  const existingBudgetColors = budgets.map(b => b.color).filter(Boolean);

  const formatCurrency = (amount, decimals = 0) => {
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(absAmount);
    return amount < 0 ? `(${formatted})` : formatted;
  };

  const getDaily = (monthly) => monthly / 30;
  const getWeekly = (monthly) => monthly / 4;
  const getYearly = (monthly) => monthly * 12;

  // Check if a budget belongs to an expense group
  const isExpenseBudget = (budgetId) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return false;
    const group = groups.find(g => g.id === budget.group_id);
    return group?.type === 'expense';
  };

  // Calculate current total expenses (excluding a specific budget)
  const getTotalExpensesExcluding = (excludeBudgetId) => {
    const expenseGroupIds = new Set(groups.filter(g => g.type === 'expense').map(g => g.id));
    return budgets
      .filter(b => expenseGroupIds.has(b.group_id) && b.id !== excludeBudgetId)
      .reduce((sum, b) => sum + (b.limit_amount || 0), 0);
  };

  // Evaluate simple math expressions
  const evaluateExpression = (expr) => {
    try {
      // Only allow numbers, operators, parentheses, and decimal points
      const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
      if (!sanitized) return null;
      // Use Function to safely evaluate the expression
      const result = new Function(`return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.max(0, result); // Don't allow negative budgets
      }
      return null;
    } catch {
      return null;
    }
  };

  // Editable group name cell component
  const EditableGroupNameCell = ({ group, onUpdate }) => {
    const [localValue, setLocalValue] = useState(group.name);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    React.useEffect(() => {
      if (!isEditing) {
        setLocalValue(group.name);
      }
    }, [group.name, isEditing]);

    const handleFocus = () => {
      setIsEditing(true);
      setLocalValue(group.name);
    };

    const handleBlur = () => {
      setIsEditing(false);
      const trimmedValue = localValue.trim();

      if (trimmedValue && trimmedValue !== group.name) {
        onUpdate.mutate({ id: group.id, data: { name: trimmedValue } });
      } else {
        setLocalValue(group.name);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        inputRef.current?.blur();
      } else if (e.key === 'Escape') {
        setLocalValue(group.name);
        inputRef.current?.blur();
      }
    };

    return (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="font-medium text-sm text-slate-800 ml-1 bg-transparent border-0 outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
        style={{ width: `${Math.max(localValue.length, 1) + 2}ch` }}
      />
    );
  };

  // Editable name cell component
  const EditableNameCell = ({ budget }) => {
    const [localValue, setLocalValue] = useState(budget.name);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    // Sync local value when budget.name changes from external updates
    React.useEffect(() => {
      if (!isEditing) {
        setLocalValue(budget.name);
      }
    }, [budget.name, isEditing]);

    const handleFocus = () => {
      setIsEditing(true);
      setLocalValue(budget.name);
    };

    const handleBlur = () => {
      setIsEditing(false);
      const trimmedValue = localValue.trim();

      if (trimmedValue && trimmedValue !== budget.name) {
        pushUndo({ type: 'update_budget', id: budget.id, previousData: { name: budget.name } });
        updateBudgetMutation.mutate({ id: budget.id, data: { name: trimmedValue } });
      } else {
        setLocalValue(budget.name);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        inputRef.current?.blur();
      } else if (e.key === 'Escape') {
        setLocalValue(budget.name);
        inputRef.current?.blur();
      }
    };

    return (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="text-sm text-slate-700 py-1 pl-2 bg-transparent border-0 outline-none focus:ring-1 focus:ring-blue-400 rounded"
        style={{ width: `${Math.max(localValue.length, 1) + 2}ch` }}
      />
    );
  };

  // Editable amount cell component
  const EditableAmountCell = ({ budget, period, value, isMonthly }) => {
    const [localValue, setLocalValue] = useState(value.toString());
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    const handleFocus = (e) => {
      setIsEditing(true);
      setLocalValue(value.toFixed(period === 'daily' ? 2 : 0));
      // Move cursor to end
      setTimeout(() => {
        if (inputRef.current) {
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 0);
    };

    const handleBlur = () => {
      setIsEditing(false);
      const trimmed = localValue.trim();
      if (!trimmed) return;

      let numValue;
      try {
        if (trimmed.match(/^[+\-*/]/)) {
          // Convert current limit_amount to the period being edited
          let currentValue;
          switch (period) {
            case 'daily': currentValue = budget.limit_amount / 30; break;
            case 'weekly': currentValue = budget.limit_amount / 4; break;
            case 'yearly': currentValue = budget.limit_amount * 12; break;
            default: currentValue = budget.limit_amount;
          }
          numValue = eval(`${currentValue}${trimmed}`);
        } else {
          numValue = eval(trimmed);
        }
      } catch {
        toast.error('Invalid calculation');
        setLocalValue(value.toFixed(period === 'daily' ? 2 : 0));
        return;
      }

      if (isNaN(numValue) || numValue <= 0) {
        toast.error('Result must be a positive number');
        setLocalValue(value.toFixed(period === 'daily' ? 2 : 0));
        return;
      }

      // Replace display with result
      setLocalValue(numValue.toFixed(period === 'daily' ? 2 : 0));
      
      // Convert to monthly based on period
      let newMonthly;
      switch (period) {
        case 'daily':
          newMonthly = numValue * 30;
          break;
        case 'weekly':
          newMonthly = numValue * 4;
          break;
        case 'yearly':
          newMonthly = numValue / 12;
          break;
        default:
          newMonthly = numValue;
      }

      if (Math.abs(newMonthly - budget.limit_amount) > 0.01) {
        if (isExpenseBudget(budget.id)) {
          const otherExpenses = getTotalExpensesExcluding(budget.id);
          const newTotalExpenses = otherExpenses + newMonthly;
          
          if (newTotalExpenses > totalIncome) {
            setInlineConflictBudget(budget);
            setInlineRequestedAmount(newMonthly);
            setInlineConflictDialogOpen(true);
            return;
          }
        }

        pushUndo({ type: 'update_budget', id: budget.id, previousData: { limit_amount: budget.limit_amount } });
        updateBudgetMutation.mutate({ id: budget.id, data: { limit_amount: Math.round(newMonthly * 100) / 100 } });
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        inputRef.current?.blur();
      } else if (e.key === 'Escape') {
        setLocalValue(value.toFixed(period === 'daily' ? 2 : 0));
        inputRef.current?.blur();
      }
    };

    const displayValue = isEditing 
      ? localValue 
      : value.toLocaleString(undefined, { minimumFractionDigits: period === 'daily' ? 2 : 0, maximumFractionDigits: period === 'daily' ? 2 : 0 });

    return (
      <div className="relative w-full h-full flex items-center">
        {!isEditing && (
          <span className={`absolute left-1 ${isMonthly ? 'text-sm font-medium text-slate-700' : 'text-xs text-slate-500'}`}>$</span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => setLocalValue(e.target.value.replace(/[^0-9.+\-*/()]/g, ''))}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`w-full h-full text-right bg-transparent border-0 outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 ${
            isMonthly ? 'text-sm font-medium text-slate-700' : 'text-xs text-slate-500'
          }`}
          style={{ paddingLeft: isEditing ? '4px' : '16px' }}
        />
      </div>
    );
  };

  return (
    <div className={groups.length === 0 ? "" : "flex gap-3 p-6"}>
      {/* Left column - Budget Groups */}
      <div className={groups.length === 0 ? "" : "flex-1 space-y-3"}>
      {groups.length > 0 && (
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Organize your budget categories into groups</p>
                  <div className="flex gap-2">
                    <div className="flex border rounded-md overflow-hidden">
                                                                                        <Button 
                                                                                          variant="ghost" 
                                                                                          size="sm" 
                                                                                          disabled={undoStack.length === 0}
                                                                                          onClick={handleUndo}
                                                                                          title={undoStack.length > 0 ? "Undo last action" : "Nothing to undo"}
                                                                                          className="rounded-none border-r px-2"
                                                                                        >
                                                                                          <Undo2 className="w-4 h-4" />
                                                                                        </Button>
                                                                                        <Button 
                                                                                          onClick={() => setAddSheetOpen(true)} 
                                                                                          variant="ghost" 
                                                                                          size="sm" 
                                                                                          className="rounded-none border-r px-2 text-slate-500"
                                                                                          title="Add budget item"
                                                                                        >
                                                                                          <Plus className="w-4 h-4" />
                                                                                        </Button>
                                                                                        <DropdownMenu>
                                                                                          <DropdownMenuTrigger asChild>
                                                                                            <Button 
                                                                                              variant="ghost" 
                                                                                              size="sm" 
                                                                                              className="rounded-none px-2 text-slate-500"
                                                                                            >
                                                                                              <Settings className="w-4 h-4" />
                                                                                            </Button>
                                                                                          </DropdownMenuTrigger>
                                                                                          <DropdownMenuContent align="end">
                                                                                            <DropdownMenuItem onClick={() => setIsReorderingGroups(!isReorderingGroups)}>
                                                                                              <GripVertical className="w-4 h-4 mr-2" />
                                                                                              {isReorderingGroups ? 'Done Reordering' : 'Reorder Groups'}
                                                                                            </DropdownMenuItem>
                                                                                            <DropdownMenuItem onClick={handleReset} className="text-red-600 focus:text-red-600">
                                                                                              <Trash2 className="w-4 h-4 mr-2" />
                                                                                              Reset All Budgets
                                                                                            </DropdownMenuItem>
                                                                                          </DropdownMenuContent>
                                                                                        </DropdownMenu>
                                                                                      </div>
                  </div>
                </div>
              )}

      <div className="space-y-2">
                      {[...groups].sort((a, b) => (a.order || 0) - (b.order || 0)).map((group, index) => (
                            <Card 
                              key={group.id}
                              className="border-l-4 shadow-sm border-slate-200"
                              style={{ 
                                borderLeftColor: GROUP_COLORS[group.type] || '#64748b'
                              }}
                            >
                      <CardHeader className="py-0 px-2">
                        <div className="flex items-center">
                          {isReorderingGroups ? (
                            <div className="flex items-center gap-1 mr-1">
                              <button
                                onClick={() => {
                                  if (index > 0) {
                                    const sortedGroups = [...groups].sort((a, b) => (a.order || 0) - (b.order || 0));
                                    const prevGroup = sortedGroups[index - 1];
                                    updateGroupMutation.mutate({ id: group.id, data: { order: (prevGroup.order || 0) - 1 } });
                                  }
                                }}
                                disabled={index === 0}
                                className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4 text-slate-500 rotate-180" />
                              </button>
                              <button
                                onClick={() => {
                                  const sortedGroups = [...groups].sort((a, b) => (a.order || 0) - (b.order || 0));
                                  if (index < sortedGroups.length - 1) {
                                    const nextGroup = sortedGroups[index + 1];
                                    updateGroupMutation.mutate({ id: group.id, data: { order: (nextGroup.order || 0) + 1 } });
                                  }
                                }}
                                disabled={index === groups.length - 1}
                                className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => toggleGroup(group.id)}
                              className="p-0.5 hover:bg-slate-100 rounded flex-shrink-0"
                            >
                              {isGroupExpanded(group.id) ? 
                                <ChevronDown className="w-4 h-4 text-slate-500" /> : 
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                              }
                            </button>
                          )}
                          <EditableGroupNameCell group={group} onUpdate={updateGroupMutation} />
                          <div className="flex-1" />
                          <div className="flex-shrink-0 w-[72px] border-l border-slate-200 text-center py-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Daily</span>
                          </div>
                          <div className="flex-shrink-0 w-[72px] border-l border-slate-200 text-center py-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Weekly</span>
                          </div>
                          <div className="flex-shrink-0 w-[72px] border-l border-slate-200 text-center py-1 bg-slate-50">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Monthly</span>
                          </div>
                          <div className="flex-shrink-0 w-[72px] border-l border-slate-200 text-center py-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Yearly</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => {
                              setEditingGroup(group);
                              setEditGroupSheetOpen(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      
                      

                      {isGroupExpanded(group.id) && (
                        <CardContent className="pt-0 pb-0 px-2">
                          
                          <div className="border-t border-slate-200">
                                {getGroupBudgets(group.id).map((budget, idx) => {
                                                                        const budgetColor = getBudgetColor(budget);
                                                                        const category = getCategory(budget.category_id);
                                                                        return (
                                                                            <div
                                                                                key={budget.id}
                                                                                className={`flex items-center group relative border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                                                                              >
                                                                              <div className="w-8 flex-shrink-0 py-1 pl-1 flex items-center justify-center">
                                                                                <div 
                                                                                  className="w-6 h-6 rounded-full flex items-center justify-center" 
                                                                                  style={{ backgroundColor: budgetColor }}
                                                                                >
                                                                                  {category?.icon && ICON_MAP[category.icon] && React.createElement(ICON_MAP[category.icon], { className: "w-3.5 h-3.5 text-white" })}
                                                                                </div>
                                                                              </div>

                                                          <EditableNameCell budget={budget} />
                                        <div className="flex-1" />
                                        <div className="flex-shrink-0 w-[72px] border-l border-slate-200 py-1 px-1">
                                          <EditableAmountCell budget={budget} period="daily" value={getDaily(budget.limit_amount)} />
                                        </div>
                                        <div className="flex-shrink-0 w-[72px] border-l border-slate-200 py-1 px-1">
                                          <EditableAmountCell budget={budget} period="weekly" value={getWeekly(budget.limit_amount)} />
                                        </div>
                                        <div className="flex-shrink-0 w-[72px] border-l border-slate-200 py-1 px-1 bg-slate-50">
                                          <EditableAmountCell budget={budget} period="monthly" value={budget.limit_amount} isMonthly />
                                        </div>
                                        <div className="flex-shrink-0 w-[72px] border-l border-slate-200 py-1 px-1">
                                          <EditableAmountCell budget={budget} period="yearly" value={getYearly(budget.limit_amount)} />
                                        </div>
                                                                                      <Button 
                                                                                      variant="ghost" 
                                                                                      size="icon" 
                                                                                      className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
                                                                                      onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setEditingBudget(budget);
                                                                                        setAddSheetOpen(true);
                                                                                      }}
                                                                                      >
                                                                                      <Pencil className="w-3.5 h-3.5" />
                                                                                      </Button>
                                          </div>
                                          );
                                          })}
                                {getGroupBudgets(group.id).length === 0 && (
                                  <p className="text-xs text-slate-400 py-2 text-center">No items in this group</p>
                                )}
                              </div>
                        </CardContent>
                      )}
                      
                      {/* Show totals row at bottom of each group */}
                      <div className="flex items-center border-t-2 border-slate-200 bg-slate-100/80 px-2">
                        <div className="w-8 flex-shrink-0 py-1 pl-1"></div>
                        <span className="text-sm font-semibold text-slate-700 flex-1 py-1">Total</span>
                        <div className="flex-shrink-0 w-[72px] border-l border-slate-200 text-right px-2 py-1">
                          <span className="text-xs tabular-nums font-medium text-slate-600">{formatCurrency(getDaily(getGroupTotal(group.id)), 2)}</span>
                        </div>
                        <div className="flex-shrink-0 w-[72px] border-l border-slate-200 text-right px-2 py-1">
                          <span className="text-xs tabular-nums font-medium text-slate-600">{formatCurrency(getWeekly(getGroupTotal(group.id)))}</span>
                        </div>
                        <div className="flex-shrink-0 w-[72px] border-l border-slate-200 text-right px-2 py-1 bg-slate-200/50">
                          <span className="text-sm tabular-nums font-bold text-slate-800">{formatCurrency(getGroupTotal(group.id))}</span>
                        </div>
                        <div className="flex-shrink-0 w-[72px] border-l border-slate-200 text-right px-2 py-1">
                          <span className="text-xs tabular-nums font-medium text-slate-600">{formatCurrency(getYearly(getGroupTotal(group.id)))}</span>
                        </div>
                        <div className="w-6 flex-shrink-0"></div>
                      </div>
                    </Card>
                      ))}
                    </div>

      {groups.length === 0 && !aiSuggestions && (
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
                  onClick={handleAnalyzeWithAI}
                  disabled={isAnalyzing}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  size="lg"
                >
                  {isAnalyzing ? (
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
      )}

      {aiSuggestions && (
        <div className="min-h-[600px] bg-slate-50/30 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">AI Budget Suggestions</h2>
                <p className="text-slate-600">Review and adjust your personalized budget based on 12 months of spending data</p>
              </div>
              <Button
                onClick={() => setAiSuggestions(null)}
                variant="ghost"
                size="sm"
              >
                Start Over
              </Button>
            </div>

            <div className="space-y-4 mb-6">
              {aiSuggestions.filter(s => s.type === 'income').length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Income</h3>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {aiSuggestions.filter(s => s.type === 'income').map((suggestion) => (
                      <div key={suggestion.category_id} className="flex items-start gap-4 p-3 bg-white rounded-lg border border-slate-200">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: suggestion.color || '#64748b' }}>
                          {suggestion.icon && ICON_MAP[suggestion.icon] && React.createElement(ICON_MAP[suggestion.icon], { className: "w-5 h-5 text-white" })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-slate-900">{suggestion.category_name}</h4>
                            <span className="text-lg font-semibold text-slate-900">${suggestion.suggested_amount.toLocaleString()}/mo</span>
                          </div>
                          <p className="text-xs text-slate-500 mb-2">{suggestion.reasoning}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-600">
                            <span>Avg: ${suggestion.monthly_average.toLocaleString()}</span>
                            <span className={`px-2 py-0.5 rounded-full ${
                              suggestion.trend === 'increasing' ? 'bg-green-100 text-green-700' :
                              suggestion.trend === 'decreasing' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {suggestion.trend === 'increasing' ? '↑' : suggestion.trend === 'decreasing' ? '↓' : '→'} {suggestion.trend}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {aiSuggestions.filter(s => s.type === 'expense').length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Expenses</h3>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {aiSuggestions.filter(s => s.type === 'expense').map((suggestion) => (
                      <div key={suggestion.category_id} className="flex items-start gap-4 p-3 bg-white rounded-lg border border-slate-200">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: suggestion.color || '#64748b' }}>
                          {suggestion.icon && ICON_MAP[suggestion.icon] && React.createElement(ICON_MAP[suggestion.icon], { className: "w-5 h-5 text-white" })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-slate-900">{suggestion.category_name}</h4>
                            <span className="text-lg font-semibold text-slate-900">${suggestion.suggested_amount.toLocaleString()}/mo</span>
                          </div>
                          <p className="text-xs text-slate-500 mb-2">{suggestion.reasoning}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-600">
                            <span>Avg: ${suggestion.monthly_average.toLocaleString()}</span>
                            <span className={`px-2 py-0.5 rounded-full ${
                              suggestion.trend === 'increasing' ? 'bg-red-100 text-red-700' :
                              suggestion.trend === 'decreasing' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {suggestion.trend === 'increasing' ? '↑' : suggestion.trend === 'decreasing' ? '↓' : '→'} {suggestion.trend}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleCreateFromSuggestions}
                disabled={isAutoCreating}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                size="lg"
              >
                {isAutoCreating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Create Budget
              </Button>
              <Button onClick={() => setAiSuggestions(null)} variant="outline" size="lg">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Budget Group Sheet */}
      <EditBudgetGroupSheet
        open={editGroupSheetOpen}
        onOpenChange={(open) => {
          setEditGroupSheetOpen(open);
          if (!open) setEditingGroup(null);
        }}
        group={editingGroup}
        onSave={(data) => {
          if (editingGroup) {
            updateGroupMutation.mutate({ id: editingGroup.id, data });
          }
        }}
        onDelete={(id) => {
          const groupBudgetsToDelete = getGroupBudgets(id);
          const group = groups.find(g => g.id === id);
          if (group) {
            const { id: groupId, created_date, updated_date, created_by, ...groupData } = group;
            pushUndo({ 
              type: 'delete_group', 
              data: groupData,
              budgets: groupBudgetsToDelete.map(b => {
                const { id, created_date, updated_date, created_by, group_id, ...bData } = b;
                return bData;
              })
            });
          }
          deleteGroupMutation.mutate(id);
        }}
      />

      {/* Inline Edit Conflict Dialog */}
      <BudgetConflictDialog
        open={inlineConflictDialogOpen}
        onOpenChange={(open) => {
          setInlineConflictDialogOpen(open);
          if (!open) {
            setInlineConflictBudget(null);
            setInlineRequestedAmount(0);
          }
        }}
        conflictBudget={inlineConflictBudget}
        requestedAmount={inlineRequestedAmount}
        totalIncome={totalIncome}
        allBudgets={budgets}
        groups={groups}
        onSave={async (updates) => {
          // Apply all budget adjustments including the original budget
          for (const update of updates) {
            await base44.entities.Budget.update(update.id, { limit_amount: update.limit_amount });
          }
          queryClient.invalidateQueries({ queryKey: ['budgets'] });
          toast.success('Budgets updated successfully');
        }}
      />

      {/* Add/Edit Budget Item Sheet */}
      <AddBudgetItemSheet
        open={addSheetOpen}
        onOpenChange={(open) => {
          setAddSheetOpen(open);
          if (!open) setEditingBudget(null);
        }}
        groups={groups}
        existingBudgetColors={existingBudgetColors}
        editingBudget={editingBudget}
        onDelete={(id) => {
          const budget = budgets.find(b => b.id === id);
          if (budget) {
            const { id: budgetId, created_date, updated_date, created_by, ...budgetData } = budget;
            pushUndo({ type: 'delete_budget', data: budgetData });
          }
          deleteBudgetMutation.mutate(id);
        }}
      />
      </div>

      {/* Right column - Donut Chart */}
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