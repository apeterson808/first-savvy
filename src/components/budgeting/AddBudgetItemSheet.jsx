import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import AccountCreationWizard from '../banking/AccountCreationWizard';
import BudgetConflictDialog from './BudgetConflictDialog';
import { ChevronLeft, Trash2 } from 'lucide-react';
import AppearancePicker from '@/components/common/AppearancePicker';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getIncomeAccounts, getExpenseAccounts, getDisplayName } from '@/api/chartOfAccounts';

const GROUP_COLORS = {
  income: '#22c55e',
  expense: '#3b82f6'
};

const CATEGORY_COLORS = {
  income: '#22c55e',
  expense: '#ef4444'
};

const DEFAULT_COLOR = '#52A5CE';

export default function AddBudgetItemSheet({ open, onOpenChange, groups, existingBudgetColors = [], editingBudget = null, onDelete = null }) {
  const isEditMode = !!editingBudget;
  const { user } = useAuth();

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [addCategorySheetOpen, setAddCategorySheetOpen] = useState(false);

  // New group form state
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Conflict dialog state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingBudgetData, setPendingBudgetData] = useState(null);

  const queryClient = useQueryClient();

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts-budget', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const [income, expense] = await Promise.all([
        getIncomeAccounts(user.id),
        getExpenseAccounts(user.id)
      ]);
      return [...income, ...expense].filter(a => a.level === 3);
    },
    enabled: !!user
  });

  // Populate form when editing - set group first, then category
  React.useEffect(() => {
    if (editingBudget && open) {
      setSelectedGroupId(editingBudget.group_id || '');
      setLimitAmount(editingBudget.allocated_amount?.toString() || '');
      setSelectedColor(editingBudget.color || '');
      setSelectedIcon(editingBudget.icon || '');
    }
  }, [editingBudget, open]);

  // Set category after group is set (needs separate effect to ensure categoryType is correct)
  React.useEffect(() => {
    if (editingBudget && open && selectedGroupId === editingBudget.group_id) {
      setSelectedCategoryId(editingBudget.chart_account_id || '');
    }
  }, [editingBudget, open, selectedGroupId]);

  const { data: existingBudgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => firstsavvy.entities.Budget.list()
  });

  // Get chart accounts not already in a budget (exclude current budget's account when editing)
  const usedAccountIds = new Set(
    existingBudgets
      .filter(b => !isEditMode || b.id !== editingBudget?.id)
      .map(b => b.chart_account_id)
      .filter(Boolean)
  );

  // Get account type from selected group
  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const accountType = selectedGroup?.type || '';

  // Include current budget's account when editing, plus all unused accounts
  const availableAccounts = chartAccounts.filter(a =>
    a.account_type === accountType && (!usedAccountIds.has(a.id) || (isEditMode && a.id === editingBudget?.chart_account_id))
  );

  const createBudgetMutation = useMutation({
    mutationFn: (data) => firstsavvy.entities.Budget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      resetForm();
      onOpenChange(false);
    }
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }) => firstsavvy.entities.Budget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      resetForm();
      onOpenChange(false);
    }
  });

  const createGroupMutation = useMutation({
    mutationFn: (data) => firstsavvy.entities.BudgetGroup.create(data),
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
      setSelectedGroupId(newGroup.id);
      setShowNewGroupForm(false);
      setNewGroupName('');
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
  };

  // Auto-assign a default color when category is selected
  React.useEffect(() => {
    if (selectedCategoryId && !selectedColor) {
      setSelectedColor(DEFAULT_COLOR);
    }
  }, [selectedCategoryId]);

  // Calculate total income from income groups
  const incomeGroups = groups.filter(g => g.type === 'income');
  const incomeGroupIds = new Set(incomeGroups.map(g => g.id));
  const totalIncome = existingBudgets
    .filter(b => incomeGroupIds.has(b.group_id))
    .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

  // Calculate current total expenses (excluding budget being edited)
  const expenseGroupIds = new Set(groups.filter(g => g.type === 'expense').map(g => g.id));
  const currentTotalExpenses = existingBudgets
    .filter(b => expenseGroupIds.has(b.group_id) && (!isEditMode || b.id !== editingBudget?.id))
    .reduce((sum, b) => sum + (b.allocated_amount || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedCategoryId || !selectedGroupId || !limitAmount) return;

    const selectedAccount = chartAccounts.find(a => a.id === selectedCategoryId);
    const newAmount = parseFloat(limitAmount) || 0;

    // Update chart account icon if changed
    if (selectedIcon && selectedIcon !== selectedAccount?.icon) {
      await firstsavvy.from('user_chart_of_accounts')
        .update({ icon: selectedIcon })
        .eq('id', selectedCategoryId);
      queryClient.invalidateQueries({ queryKey: ['chart-accounts-budget'] });
    }

    const budgetData = {
      name: selectedAccount ? getDisplayName(selectedAccount) : 'Budget Item',
      chart_account_id: selectedCategoryId,
      group_id: selectedGroupId,
      allocated_amount: newAmount,
      color: selectedColor || DEFAULT_COLOR,
      icon: selectedIcon || selectedAccount?.icon,
      is_active: true
    };

    // Check if this is an expense group and would exceed income
    const targetGroup = groups.find(g => g.id === selectedGroupId);
    if (targetGroup?.type === 'expense' && totalIncome > 0) {
      const newTotalExpenses = currentTotalExpenses + newAmount;
      if (newTotalExpenses > totalIncome) {
        // Show conflict dialog instead of blocking
        setPendingBudgetData(budgetData);
        setConflictDialogOpen(true);
        return;
      }
    }

    if (isEditMode) {
      updateBudgetMutation.mutate({ id: editingBudget.id, data: budgetData });
    } else {
      createBudgetMutation.mutate(budgetData);
    }
  };

  const handleConflictSave = async (updates) => {
    // Apply all budget adjustments (only for existing budgets with valid IDs)
    for (const update of updates) {
      if (update.id) {
        await firstsavvy.entities.Budget.update(update.id, { allocated_amount: update.allocated_amount });
      }
    }
    
    // Now create/update the pending budget
    if (pendingBudgetData) {
      if (isEditMode) {
        await firstsavvy.entities.Budget.update(editingBudget.id, pendingBudgetData);
      } else {
        await firstsavvy.entities.Budget.create(pendingBudgetData);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    toast.success('Budgets updated successfully');
    setPendingBudgetData(null);
    resetForm();
    onOpenChange(false);
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
    }
  };

  const [newGroupType, setNewGroupType] = useState('expense');

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    createGroupMutation.mutate({
      name: newGroupName.trim(),
      type: newGroupType,
      order: groups.length
    });
  };

  // Reset category when group changes (type might change) - but not when editing
  React.useEffect(() => {
    if (!isEditMode || selectedGroupId !== editingBudget?.group_id) {
      setSelectedCategoryId('');
    }
  }, [selectedGroupId, isEditMode, editingBudget?.group_id]);

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
                    <span className="text-sm font-medium text-slate-700">New group</span>
                  </div>
                  <Input
                    placeholder="Group name"
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
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.expense }} />
                        <span>Expense</span>
                      </div>
                    </ClickThroughSelectItem>
                    <ClickThroughSelectItem value="income">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.income }} />
                        <span>Income</span>
                      </div>
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
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || createGroupMutation.isPending}
                    >
                      Create
                    </Button>
                  </div>
                </div>
              ) : (
                <ClickThroughSelect
                  value={selectedGroupId}
                  onValueChange={handleGroupSelect}
                  placeholder="Select group"
                  triggerClassName="hover:bg-slate-50"
                  renderValue={(value) => {
                                            const group = groups.find(g => g.id === value);
                                            if (!group) return null;
                                            return <span className="truncate">{group.name}</span>;
                                          }}
                >
                  <ClickThroughSelectItem value="__add_new_group__" className="text-blue-600 font-medium" isAction>
                    + Add new group
                  </ClickThroughSelectItem>
                  {groups.map(group => (
                                            <ClickThroughSelectItem key={group.id} value={group.id} data-display={group.name}>
                                              {group.name}
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
                placeholder="Select category"
                triggerClassName="hover:bg-slate-50"
                renderValue={(value) => {
                                        const acc = chartAccounts.find(a => a.id === value);
                                        if (!acc) return null;
                                        return <span className="truncate">{getDisplayName(acc)}</span>;
                                      }}
              >
                <ClickThroughSelectItem value="__add_new__" className="text-blue-600 font-medium" isAction>
                  + Add new category
                </ClickThroughSelectItem>
                {availableAccounts.map(acc => (
                                        <ClickThroughSelectItem key={acc.id} value={acc.id} data-display={getDisplayName(acc)}>
                                          <span className="text-xs text-gray-500 font-mono mr-2">{acc.account_number}</span>
                                          {getDisplayName(acc)}
                                        </ClickThroughSelectItem>
                                      ))}
                {availableAccounts.length === 0 && selectedGroupId && (
                  <div className="px-2 py-2 text-xs text-slate-400 text-center">
                    No available accounts
                  </div>
                )}
                {!selectedGroupId && (
                  <div className="px-2 py-2 text-xs text-slate-400 text-center">
                    Select a group first
                  </div>
                )}
              </ClickThroughSelect>
            </div>



            <div>
              <Label htmlFor="limitAmount">Monthly Budget*</Label>
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
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!selectedCategoryId || !selectedGroupId || !limitAmount || createBudgetMutation.isPending || updateBudgetMutation.isPending}
                  >
                    {isEditMode ? 'Save' : 'Add'}
                  </Button>
                </SheetFooter>
                {isEditMode && onDelete && (
                                    <div className="pt-4 mt-4">
                                      <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
                                        onClick={() => {
                                          onDelete(editingBudget.id);
                                          onOpenChange(false);
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Budget Item
                                      </Button>
                                    </div>
                                  )}
          </form>
        </SheetContent>
      </Sheet>

      <AccountCreationWizard
        open={addCategorySheetOpen}
        onOpenChange={setAddCategorySheetOpen}
        onAccountCreated={(newCategory) => {
          queryClient.invalidateQueries({ queryKey: ['categories'] });
          if (newCategory?.id) {
            setSelectedCategoryId(newCategory.id);
          }
        }}
      />

      <BudgetConflictDialog
        open={conflictDialogOpen}
        onOpenChange={(open) => {
          setConflictDialogOpen(open);
          if (!open) setPendingBudgetData(null);
        }}
        conflictBudget={pendingBudgetData ? { name: pendingBudgetData.name, allocated_amount: pendingBudgetData.allocated_amount } : null}
        requestedAmount={pendingBudgetData?.allocated_amount || 0}
        totalIncome={totalIncome}
        allBudgets={existingBudgets}
        groups={groups}
        onSave={handleConflictSave}
      />
    </>
  );
}