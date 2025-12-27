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
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import AppearancePicker from '@/components/common/AppearancePicker';
import AddEditCategorySheet from './AddEditCategorySheet';
import { toast } from 'sonner';

const DEFAULT_COLOR = '#52A5CE';

export default function AddBudgetItemSheet({
  open,
  onOpenChange,
  categories = [],
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

  const [addCategorySheetOpen, setAddCategorySheetOpen] = useState(false);

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
  }, [editingBudget, open, preselectedCategoryId]);

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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCategoryId || !limitAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    const selectedAccount = categories.find(a => a.id === selectedCategoryId);
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

  const handleCategorySelect = (value) => {
    if (value === '__add_new__') {
      setAddCategorySheetOpen(true);
    } else {
      setSelectedCategoryId(value);
    }
  };

  const availableCategories = categories;

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isEditMode ? 'Edit Budget Item' : 'Add Budget Item'}</SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="category">Category*</Label>
              <ClickThroughSelect
                value={selectedCategoryId}
                onValueChange={handleCategorySelect}
                placeholder="Select a category"
                triggerClassName="hover:bg-slate-50"
              >
                <ClickThroughSelectItem value="__add_new__" className="text-primary font-medium" isAction>
                  + Create New Category
                </ClickThroughSelectItem>
                {availableCategories.map(cat => (
                  <ClickThroughSelectItem key={cat.id} value={cat.id}>
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
              <ClickThroughSelect
                value={selectedCadence}
                onValueChange={setSelectedCadence}
                placeholder="Select time period"
                triggerClassName="hover:bg-slate-50"
              >
                <ClickThroughSelectItem value="daily">Daily</ClickThroughSelectItem>
                <ClickThroughSelectItem value="weekly">Weekly</ClickThroughSelectItem>
                <ClickThroughSelectItem value="monthly">Monthly</ClickThroughSelectItem>
                <ClickThroughSelectItem value="yearly">Yearly</ClickThroughSelectItem>
              </ClickThroughSelect>
              <p className="text-xs text-muted-foreground mt-1">
                The amount above represents a {selectedCadence} budget
              </p>
            </div>

            <div>
              <Label>Appearance</Label>
              <div className="mt-2">
                <AppearancePicker
                  color={selectedColor}
                  icon={selectedIcon}
                  onColorChange={setSelectedColor}
                  onIconChange={setSelectedIcon}
                />
              </div>
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90"
                disabled={!selectedCategoryId || !limitAmount || createBudgetMutation.isPending || updateBudgetMutation.isPending}
              >
                {isEditMode ? 'Update' : 'Create'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AddEditCategorySheet
        open={addCategorySheetOpen}
        onOpenChange={setAddCategorySheetOpen}
        onCategoryCreated={(newCategory) => {
          queryClient.invalidateQueries({ queryKey: ['chart-accounts-income-expense'] });
          if (newCategory?.id) {
            setSelectedCategoryId(newCategory.id);
          }
        }}
      />
    </>
  );
}
