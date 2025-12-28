import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
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
import { toast } from 'sonner';

const DEFAULT_COLOR = '#52A5CE';

export default function AddBudgetItemSheet({
  open,
  onOpenChange,
  availableCategories = [],
  editingBudget = null,
  preselectedCategoryId = null
}) {
  const isEditMode = !!editingBudget;
  const queryClient = useQueryClient();

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [selectedCadence, setSelectedCadence] = useState('monthly');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (editingBudget && open) {
      setSelectedCategoryId(editingBudget.chart_account_id || '');
      setLimitAmount(editingBudget.allocated_amount?.toString() || '');
      setSelectedColor(editingBudget.color || '');
      setSelectedIcon(editingBudget.icon || '');
      setSelectedCadence(editingBudget.cadence || 'monthly');
    } else if (open && !editingBudget) {
      if (preselectedCategoryId) {
        setSelectedCategoryId(preselectedCategoryId);
      }
    }
  }, [editingBudget, open, preselectedCategoryId, availableCategories]);

  useEffect(() => {
    if (selectedCategoryId && !selectedColor) {
      setSelectedColor(DEFAULT_COLOR);
    }
  }, [selectedCategoryId, selectedColor]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCategoryId || !limitAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    const selectedAccount = availableCategories.find(a => a.id === selectedCategoryId);
    const newAmount = parseFloat(limitAmount) || 0;

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

    if (selectedIcon && selectedIcon !== selectedAccount?.icon) {
      await firstsavvy.supabase.from('user_chart_of_accounts')
        .update({ icon: selectedIcon })
        .eq('id', selectedCategoryId);
      queryClient.invalidateQueries({ queryKey: ['chart-accounts-income-expense'] });
    }

    const budgetData = {
      chart_account_id: selectedCategoryId,
      allocated_amount: newAmount,
      cadence: selectedCadence,
      color: selectedColor || DEFAULT_COLOR,
      icon: selectedIcon || selectedAccount?.icon,
      is_active: true
    };

    if (isEditMode) {
      updateBudgetMutation.mutate({ id: editingBudget.id, data: budgetData });
    } else {
      createBudgetMutation.mutate(budgetData);
    }
  };

  const selectedCategory = availableCategories.find(c => c.id === selectedCategoryId);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <SheetContent className="overflow-y-auto max-h-screen flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit Budget Item' : 'Add Budget Item'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4 px-1 flex-1 overflow-y-auto">
          <div>
            <Label htmlFor="category">Category*</Label>
            <ClickThroughSelect
              value={selectedCategoryId}
              onValueChange={setSelectedCategoryId}
              onSearchTermChange={setSearchTerm}
              placeholder="Select a category"
              triggerClassName="h-10"
              enableSearch={true}
            >
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
                onChange={(e) => setLimitAmount(e.target.value.replace(/[^0-9.]/g, ''))}
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

          <div>
            <Label className="mb-2 block">Appearance</Label>
            <AppearancePicker
              color={selectedColor}
              icon={selectedIcon}
              onColorChange={setSelectedColor}
              onIconChange={setSelectedIcon}
              inline={true}
            />
          </div>
        </form>

        <SheetFooter className="pt-4 mt-auto">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            className="bg-primary hover:bg-primary/90"
            disabled={!selectedCategoryId || !limitAmount || createBudgetMutation.isPending || updateBudgetMutation.isPending}
          >
            {isEditMode ? 'Update' : 'Create'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
