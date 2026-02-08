import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import AppearancePicker from '@/components/common/AppearancePicker';
import AddEditCategorySheet from '@/components/budgeting/AddEditCategorySheet';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import * as LucideIcons from 'lucide-react';

const DEFAULT_COLOR = '#52A5CE';

const formatCurrency = (value) => {
  if (!value) return '';
  const number = parseFloat(value.replace(/,/g, ''));
  if (isNaN(number)) return '';
  return number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const parseCurrency = (value) => {
  return value.replace(/,/g, '');
};

export default function AddBudgetItemSheet({
  open,
  onOpenChange,
  availableCategories = [],
  editingBudget = null,
  preselectedCategoryId = null
}) {
  const isEditMode = !!editingBudget;
  const queryClient = useQueryClient();
  const { activeProfile } = useProfile();

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [selectedCadence, setSelectedCadence] = useState('monthly');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCategorySheet, setShowAddCategorySheet] = useState(false);

  useEffect(() => {
    if (editingBudget && open) {
      setSelectedCategoryId(editingBudget.chart_account_id || '');
      const amount = editingBudget.allocated_amount?.toString() || '';
      setLimitAmount(amount ? formatCurrency(amount) : '');
      setSelectedColor(editingBudget.chartAccount?.color || '');
      setSelectedIcon(editingBudget.chartAccount?.icon || '');
      setSelectedCadence(editingBudget.cadence || 'monthly');
    } else if (open && !editingBudget) {
      if (preselectedCategoryId) {
        setSelectedCategoryId(preselectedCategoryId);
      }
    }
  }, [editingBudget, open, preselectedCategoryId, availableCategories]);

  useEffect(() => {
    if (selectedCategoryId && !isEditMode) {
      const selectedCategory = availableCategories.find(c => c.id === selectedCategoryId);
      if (selectedCategory) {
        setSelectedColor(selectedCategory.color || DEFAULT_COLOR);
        setSelectedIcon(selectedCategory.icon || 'Circle');
      }
    }
  }, [selectedCategoryId, availableCategories, isEditMode]);

  const createBudgetMutation = useMutation({
    mutationFn: (data) => firstsavvy.entities.Budget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget item created successfully');
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error creating budget:', error);
      toast.error('Failed to create budget item');
    }
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }) => firstsavvy.entities.Budget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget item updated successfully');
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating budget:', error);
      toast.error('Failed to update budget item');
    }
  });

  const resetForm = () => {
    setSelectedCategoryId('');
    setLimitAmount('');
    setSelectedColor('');
    setSelectedIcon('');
    setSelectedCadence('monthly');
    setSearchTerm('');
  };

  const handleCategoryCreated = (newCategory) => {
    if (newCategory?.id) {
      setSelectedCategoryId(newCategory.id);
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts-income-expense'] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCategoryId || !limitAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    const selectedAccount = availableCategories.find(a => a.id === selectedCategoryId);
    const newAmount = parseFloat(parseCurrency(limitAmount)) || 0;

    if (newAmount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    if (!isEditMode) {
      const existingBudgets = queryClient.getQueryData(['budgets']);
      const duplicateBudget = existingBudgets?.find(
        b => b.chart_account_id === selectedCategoryId && b.id !== editingBudget?.id
      );

      if (duplicateBudget) {
        const accountName = selectedAccount?.display_name || selectedAccount?.account_detail;
        toast.error(`A budget already exists for "${accountName}"`);
        return;
      }
    }

    const updates = {};
    if (selectedIcon && selectedIcon !== selectedAccount?.icon) {
      updates.icon = selectedIcon;
    }
    if (selectedColor && selectedColor !== selectedAccount?.color) {
      updates.color = selectedColor;
    }

    if (Object.keys(updates).length > 0) {
      await firstsavvy.supabase.from('user_chart_of_accounts')
        .update(updates)
        .eq('id', selectedCategoryId);
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts-income-expense'] });
    }

    const budgetData = {
      chart_account_id: selectedCategoryId,
      allocated_amount: newAmount,
      cadence: selectedCadence,
      is_active: true
    };

    if (isEditMode) {
      updateBudgetMutation.mutate({ id: editingBudget.id, data: budgetData });
    } else {
      createBudgetMutation.mutate(budgetData);
    }
  };

  const selectedCategory = availableCategories.find(c => c.id === selectedCategoryId);

  const categoryClass = isEditMode && editingBudget?.chartAccount?.class
    ? editingBudget.chartAccount.class
    : selectedCategory?.class;

  const isIncomeCategory = categoryClass === 'income';
  const buttonText = isEditMode
    ? 'Update'
    : isIncomeCategory
      ? 'Add Income'
      : 'Add Budget';

  return (
    <>
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <SheetContent className="overflow-y-auto max-h-screen flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit Budget Item' : 'Add Budget Item'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4 px-1 flex-1 overflow-y-auto flex flex-col">
          <div>
            <Label htmlFor="category">Category*</Label>
            <ClickThroughSelect
              value={selectedCategoryId}
              onValueChange={(val) => {
                if (val === '__add_new_category__') {
                  setShowAddCategorySheet(true);
                  return;
                }
                setSelectedCategoryId(val);
              }}
              onSearchTermChange={setSearchTerm}
              placeholder="Select a category"
              triggerClassName="h-10"
              enableSearch={true}
            >
              <ClickThroughSelectItem
                value="__add_new_category__"
                className="text-blue-600 font-medium whitespace-nowrap"
                isAction
              >
                <Plus className="w-3 h-3 mr-1" />
                Add New Category
              </ClickThroughSelectItem>
              {availableCategories.map((cat) => (
                <ClickThroughSelectItem
                  key={cat.id}
                  value={cat.id}
                  data-display={cat.display_name || cat.account_detail}
                >
                  {cat.display_name || cat.account_detail}
                </ClickThroughSelectItem>
              ))}
            </ClickThroughSelect>
          </div>

          <div>
            <Label htmlFor="limitAmount">Budget Amount*</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="limitAmount"
                type="text"
                value={limitAmount}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setLimitAmount(value);
                }}
                onBlur={() => {
                  const cleanValue = limitAmount.replace(/[^0-9.]/g, '');
                  if (cleanValue) {
                    setLimitAmount(formatCurrency(cleanValue));
                  }
                }}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cadence">Time Period*</Label>
            <Select value={selectedCadence} onValueChange={setSelectedCadence}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              The amount above represents a {selectedCadence} budget
            </p>
          </div>

          <div className="space-y-2">
            <Label>Appearance</Label>
            <AppearancePicker
              color={selectedColor}
              icon={selectedIcon}
              onColorChange={setSelectedColor}
              onIconChange={setSelectedIcon}
            />
          </div>

          <SheetFooter className="pt-4 mt-auto">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90"
              disabled={!selectedCategoryId || !limitAmount || createBudgetMutation.isPending || updateBudgetMutation.isPending}
            >
              {buttonText}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>

    <AddEditCategorySheet
      open={showAddCategorySheet}
      onOpenChange={setShowAddCategorySheet}
      accountType="expense"
      onCategoryCreated={handleCategoryCreated}
    />
  </>
  );
}
