import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import AddFinancialAccountSheet from '../banking/AddFinancialAccountSheet';
import BudgetConflictDialog from './BudgetConflictDialog';
import { ChevronLeft, Trash2 } from 'lucide-react';
import AppearancePicker from '@/components/common/AppearancePicker';
import { toast } from 'sonner';

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
  
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [addCategorySheetOpen, setAddCategorySheetOpen] = useState(false);
  const [isSubAccount, setIsSubAccount] = useState(false);
  const [parentBudgetId, setParentBudgetId] = useState('');
  const [allowRollover, setAllowRollover] = useState(false);
  
  // New group form state
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  // Conflict dialog state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingBudgetData, setPendingBudgetData] = useState(null);

  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name')
  });

  // Populate form when editing - set group first, then category
  React.useEffect(() => {
    if (editingBudget && open) {
      setSelectedGroupId(editingBudget.group_id || '');
      setLimitAmount(editingBudget.limit_amount?.toString() || '');
      setSelectedColor(editingBudget.color || '');
      setIsSubAccount(!!editingBudget.parent_budget_id);
      setParentBudgetId(editingBudget.parent_budget_id || '');
      setAllowRollover(editingBudget.allow_rollover || false);
    }
  }, [editingBudget, open]);

  // Set category after group is set (needs separate effect to ensure categoryType is correct)
  React.useEffect(() => {
    if (editingBudget && open && selectedGroupId === editingBudget.group_id) {
      setSelectedCategoryId(editingBudget.category_id || '');
    }
  }, [editingBudget, open, selectedGroupId]);

  // Load icon from associated category when editing
  React.useEffect(() => {
    if (editingBudget && open && categories.length > 0) {
      const category = categories.find(c => c.id === editingBudget.category_id);
      setSelectedIcon(category?.icon || '');
    }
  }, [editingBudget, open, categories]);

  const { data: existingBudgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.Budget.list()
  });

  // Fetch all account types for parent selection
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true })
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => base44.entities.Asset.list()
  });

  const { data: liabilities = [] } = useQuery({
    queryKey: ['liabilities'],
    queryFn: () => base44.entities.Liability.list()
  });

  // Get categories not already in a budget (exclude current budget's category when editing)
  const usedCategoryIds = new Set(
    existingBudgets
      .filter(b => !isEditMode || b.id !== editingBudget?.id)
      .map(b => b.category_id)
      .filter(Boolean)
  );
  
  // Get category type from selected group
  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const categoryType = selectedGroup?.type || '';

  // Include current budget's category when editing, plus all unused categories
  const availableCategories = categories.filter(c => 
    c.type === categoryType && (!usedCategoryIds.has(c.id) || (isEditMode && c.id === editingBudget?.category_id))
  );

  const createBudgetMutation = useMutation({
    mutationFn: (data) => base44.entities.Budget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      resetForm();
      onOpenChange(false);
    }
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Budget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      resetForm();
      onOpenChange(false);
    }
  });

  const createGroupMutation = useMutation({
    mutationFn: (data) => base44.entities.BudgetGroup.create(data),
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
    setIsSubAccount(false);
    setParentBudgetId('');
    setAllowRollover(false);
    setShowNewGroupForm(false);
    setNewGroupName('');
  };

  // Auto-assign a default color when category is selected
  React.useEffect(() => {
    if (selectedCategoryId && !selectedColor) {
      setSelectedColor(DEFAULT_COLOR);
    }
  }, [selectedCategoryId]);

  // Get all top-level budgets for parent selection (across all groups)
  const allParentBudgets = existingBudgets.filter(b => !b.parent_budget_id);

  // Calculate total income from income groups
  const incomeGroups = groups.filter(g => g.type === 'income');
  const incomeGroupIds = new Set(incomeGroups.map(g => g.id));
  const totalIncome = existingBudgets
    .filter(b => incomeGroupIds.has(b.group_id))
    .reduce((sum, b) => sum + (b.limit_amount || 0), 0);

  // Calculate current total expenses (excluding budget being edited)
  const expenseGroupIds = new Set(groups.filter(g => g.type === 'expense').map(g => g.id));
  const currentTotalExpenses = existingBudgets
    .filter(b => expenseGroupIds.has(b.group_id) && (!isEditMode || b.id !== editingBudget?.id))
    .reduce((sum, b) => sum + (b.limit_amount || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedCategoryId || !selectedGroupId || !limitAmount) return;

    const selectedCategory = categories.find(c => c.id === selectedCategoryId);
    const newAmount = parseFloat(limitAmount) || 0;
    
    // Update category icon if changed
    if (selectedIcon && selectedIcon !== selectedCategory?.icon) {
      await base44.entities.Category.update(selectedCategoryId, { icon: selectedIcon });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
    
    const budgetData = {
      name: selectedCategory?.name || 'Budget Item',
      category_id: selectedCategoryId,
      group_id: selectedGroupId,
      limit_amount: newAmount,
      color: selectedColor || DEFAULT_COLOR,
      is_active: true,
      allow_rollover: allowRollover
    };

    if (isSubAccount && parentBudgetId) {
      budgetData.parent_budget_id = parentBudgetId;
    } else {
      budgetData.parent_budget_id = null;
    }

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
        await base44.entities.Budget.update(update.id, { limit_amount: update.limit_amount });
      }
    }
    
    // Now create/update the pending budget
    if (pendingBudgetData) {
      if (isEditMode) {
        await base44.entities.Budget.update(editingBudget.id, pendingBudgetData);
      } else {
        await base44.entities.Budget.create(pendingBudgetData);
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
                                        const cat = categories.find(c => c.id === value);
                                        if (!cat) return null;
                                        return <span className="truncate">{cat.name}</span>;
                                      }}
              >
                <ClickThroughSelectItem value="__add_new__" className="text-blue-600 font-medium" isAction>
                  + Add new category
                </ClickThroughSelectItem>
                {availableCategories.map(cat => (
                                        <ClickThroughSelectItem key={cat.id} value={cat.id} data-display={cat.name}>
                                          {cat.name}
                                        </ClickThroughSelectItem>
                                      ))}
                {availableCategories.length === 0 && selectedGroupId && (
                  <div className="px-2 py-2 text-xs text-slate-400 text-center">
                    No available categories
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

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowRollover"
                  checked={allowRollover}
                  onCheckedChange={setAllowRollover}
                />
                <Label htmlFor="allowRollover" className="text-sm font-normal cursor-pointer">
                  Allow rollover
                </Label>
              </div>
              {allowRollover && (
                <p className="text-xs text-slate-500 ml-6">
                  Unused budget or overspending will roll over to the next period.
                </p>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isSubAccount"
                  checked={isSubAccount}
                  onCheckedChange={(checked) => {
                    setIsSubAccount(checked);
                    if (!checked) setParentBudgetId('');
                  }}
                />
                <Label htmlFor="isSubAccount" className="text-sm font-normal cursor-pointer">
                  Add as sub-account
                </Label>
              </div>
              {isSubAccount && (
                <div>
                  <Label htmlFor="parentBudget">Parent Budget Item*</Label>
                  <ClickThroughSelect
                    value={parentBudgetId}
                    onValueChange={setParentBudgetId}
                    placeholder="Select parent"
                    triggerClassName="hover:bg-slate-50"
                  >
                    {bankAccounts.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Bank Accounts</div>
                        {bankAccounts.map(account => (
                          <ClickThroughSelectItem key={`bank-${account.id}`} value={account.id}>
                            {account.account_name}
                          </ClickThroughSelectItem>
                        ))}
                      </>
                    )}
                    {assets.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Assets</div>
                        {assets.map(account => (
                          <ClickThroughSelectItem key={`asset-${account.id}`} value={account.id}>
                            {account.name}
                          </ClickThroughSelectItem>
                        ))}
                      </>
                    )}
                    {liabilities.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Liabilities</div>
                        {liabilities.map(account => (
                          <ClickThroughSelectItem key={`liability-${account.id}`} value={account.id}>
                            {account.name}
                          </ClickThroughSelectItem>
                        ))}
                      </>
                    )}
                    {categories.filter(c => c.type === 'income').length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Income Accounts</div>
                        {categories.filter(c => c.type === 'income').map(cat => (
                          <ClickThroughSelectItem key={`income-${cat.id}`} value={cat.id}>
                            {cat.name}
                          </ClickThroughSelectItem>
                        ))}
                      </>
                    )}
                    {categories.filter(c => c.type === 'expense').length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">Expense Accounts</div>
                        {categories.filter(c => c.type === 'expense').map(cat => (
                          <ClickThroughSelectItem key={`expense-${cat.id}`} value={cat.id}>
                            {cat.name}
                          </ClickThroughSelectItem>
                        ))}
                      </>
                    )}
                    {bankAccounts.length === 0 && assets.length === 0 && liabilities.length === 0 && categories.length === 0 && (
                      <div className="px-2 py-2 text-xs text-slate-400 text-center">
                        No accounts available
                      </div>
                    )}
                  </ClickThroughSelect>
                </div>
              )}
            </div>

            <SheetFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!selectedCategoryId || !selectedGroupId || !limitAmount || (isSubAccount && !parentBudgetId) || createBudgetMutation.isPending || updateBudgetMutation.isPending}
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

      <AddFinancialAccountSheet
        open={addCategorySheetOpen}
        onOpenChange={setAddCategorySheetOpen}
        mode="category"
        hideLinkAccount={true}
        onAccountCreated={(newCategory) => {
          queryClient.invalidateQueries({ queryKey: ['categories'] });
          // Auto-select the newly created category
          if (newCategory?.account?.id) {
            setSelectedCategoryId(newCategory.account.id);
          }
        }}
      />

      <BudgetConflictDialog
        open={conflictDialogOpen}
        onOpenChange={(open) => {
          setConflictDialogOpen(open);
          if (!open) setPendingBudgetData(null);
        }}
        conflictBudget={pendingBudgetData ? { name: pendingBudgetData.name, limit_amount: pendingBudgetData.limit_amount } : null}
        requestedAmount={pendingBudgetData?.limit_amount || 0}
        totalIncome={totalIncome}
        allBudgets={existingBudgets}
        groups={groups}
        onSave={handleConflictSave}
      />
    </>
  );
}