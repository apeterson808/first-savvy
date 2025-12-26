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
import { ChevronLeft } from 'lucide-react';
import AppearancePicker from '@/components/common/AppearancePicker';
import AddEditCategorySheet from './AddEditCategorySheet';
import { toast } from 'sonner';

const DEFAULT_COLOR = '#52A5CE';

export default function AddBudgetItemSheet({
  open,
  onOpenChange,
  groups,
  categories = [],
  editingBudget = null
}) {
  const isEditMode = !!editingBudget;
  const queryClient = useQueryClient();

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');

  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('expense');

  const [addCategorySheetOpen, setAddCategorySheetOpen] = useState(false);

  useEffect(() => {
    if (editingBudget && open) {
      setSelectedGroupId(editingBudget.group_id || '');
      setSelectedCategoryId(editingBudget.chart_account_id || '');
      setLimitAmount(editingBudget.allocated_amount?.toString() || '');
      setSelectedColor(editingBudget.color || '');
      setSelectedIcon(editingBudget.icon || '');
    }
  }, [editingBudget, open]);

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

  const createGroupMutation = useMutation({
    mutationFn: (data) => firstsavvy.entities.BudgetGroup.create(data),
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
      setSelectedGroupId(newGroup.id);
      setShowNewGroupForm(false);
      setNewGroupName('');
      toast.success('Budget group created successfully');
    },
    onError: (error) => {
      console.error('Error creating group:', error);
      toast.error('Failed to create budget group');
    }
  });

  const resetForm = () => {
    setSelectedCategoryId('');
    setSelectedGroupId('');
    setLimitAmount('');
    setSelectedColor('');
    setSelectedIcon('');
    setShowNewGroupForm(false);
    setNewGroupName('');
    setNewGroupType('expense');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCategoryId || !selectedGroupId || !limitAmount) {
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
      group_id: selectedGroupId,
      allocated_amount: newAmount,
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

  const handleGroupSelect = (value) => {
    if (value === '__add_new_group__') {
      setShowNewGroupForm(true);
    } else {
      setSelectedGroupId(value);
      if (!isEditMode) {
        setSelectedCategoryId('');
      }
    }
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    createGroupMutation.mutate({
      name: newGroupName.trim(),
      type: newGroupType,
      order: groups.length
    });
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const accountType = selectedGroup?.type || '';

  const availableCategories = categories.filter(c => c.account_type === accountType);

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
              <Label htmlFor="group">Budget Group*</Label>
              {showNewGroupForm ? (
                <div className="space-y-3 p-3 border rounded-md bg-slate-50">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewGroupForm(false);
                        setNewGroupName('');
                      }}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <span className="text-sm font-medium text-slate-700">New Budget Group</span>
                  </div>
                  <Input
                    placeholder="Group name (e.g., Monthly Expenses)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    autoFocus
                  />
                  <ClickThroughSelect
                    value={newGroupType}
                    onValueChange={setNewGroupType}
                    placeholder="Select type"
                    triggerClassName="hover:bg-slate-50"
                  >
                    <ClickThroughSelectItem value="expense">
                      Expense Group
                    </ClickThroughSelectItem>
                    <ClickThroughSelectItem value="income">
                      Income Group
                    </ClickThroughSelectItem>
                  </ClickThroughSelect>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNewGroupForm(false);
                        setNewGroupName('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || createGroupMutation.isPending}
                    >
                      Create Group
                    </Button>
                  </div>
                </div>
              ) : (
                <ClickThroughSelect
                  value={selectedGroupId}
                  onValueChange={handleGroupSelect}
                  placeholder="Select a budget group"
                  triggerClassName="hover:bg-slate-50"
                >
                  <ClickThroughSelectItem value="__add_new_group__" className="text-primary font-medium" isAction>
                    + Create New Group
                  </ClickThroughSelectItem>
                  {groups.map(group => (
                    <ClickThroughSelectItem key={group.id} value={group.id}>
                      {group.name} ({group.type})
                    </ClickThroughSelectItem>
                  ))}
                </ClickThroughSelect>
              )}
            </div>

            <div>
              <Label htmlFor="category">Category*</Label>
              <ClickThroughSelect
                value={selectedCategoryId}
                onValueChange={handleCategorySelect}
                placeholder={selectedGroupId ? "Select a category" : "Select a group first"}
                triggerClassName="hover:bg-slate-50"
                disabled={!selectedGroupId}
              >
                <ClickThroughSelectItem value="__add_new__" className="text-primary font-medium" isAction>
                  + Create New Category
                </ClickThroughSelectItem>
                {availableCategories.map(cat => (
                  <ClickThroughSelectItem key={cat.id} value={cat.id}>
                    {cat.display_name || cat.account_detail}
                  </ClickThroughSelectItem>
                ))}
                {availableCategories.length === 0 && selectedGroupId && (
                  <div className="px-2 py-2 text-xs text-slate-400 text-center">
                    No categories available for this group type
                  </div>
                )}
              </ClickThroughSelect>
            </div>

            <div>
              <Label htmlFor="limitAmount">Monthly Amount*</Label>
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
                disabled={!selectedCategoryId || !selectedGroupId || !limitAmount || createBudgetMutation.isPending || updateBudgetMutation.isPending}
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
        accountType={accountType}
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
