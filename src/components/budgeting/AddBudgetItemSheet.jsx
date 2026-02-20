import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import AppearancePicker from '@/components/common/AppearancePicker';
import AccountCreationWizard from '@/components/banking/AccountCreationWizard';
import { Plus, Pencil } from 'lucide-react';
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
  const [editingCategory, setEditingCategory] = useState(null);
  const [parentBudgetInfo, setParentBudgetInfo] = useState(null);
  const [hasParentCategory, setHasParentCategory] = useState(false);
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState('');
  const [parentCategories, setParentCategories] = useState([]);

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

  useEffect(() => {
    if (selectedCategoryId) {
      const selectedCategory = availableCategories.find(c => c.id === selectedCategoryId);
      if (selectedCategory?.parent_account_id) {
        setHasParentCategory(true);
        setSelectedParentCategoryId(selectedCategory.parent_account_id);
      } else {
        setHasParentCategory(false);
        setSelectedParentCategoryId('');
      }
    }
  }, [selectedCategoryId, availableCategories]);

  useEffect(() => {
    const fetchParentCategories = async () => {
      if (!open || !selectedCategoryId) {
        setParentCategories([]);
        return;
      }

      const selectedCategory = availableCategories.find(c => c.id === selectedCategoryId);
      const categoryType = selectedCategory?.class || 'expense';

      try {
        const { data, error } = await firstsavvy.supabase
          .from('user_chart_of_accounts')
          .select('id, display_name, account_detail')
          .eq('class', categoryType)
          .is('parent_account_id', null)
          .eq('is_active', true)
          .neq('id', selectedCategoryId)
          .order('display_name');

        if (error) throw error;
        setParentCategories(data || []);
      } catch (error) {
        console.error('Error fetching parent categories:', error);
        setParentCategories([]);
      }
    };

    fetchParentCategories();
  }, [open, selectedCategoryId, availableCategories]);

  useEffect(() => {
    const fetchParentBudgetInfo = async () => {
      if (!selectedCategoryId || !activeProfile?.id) {
        setParentBudgetInfo(null);
        return;
      }

      const selectedCategory = availableCategories.find(c => c.id === selectedCategoryId);
      const parentAccountId = selectedCategory?.parent_account_id;

      if (!parentAccountId) {
        setParentBudgetInfo(null);
        return;
      }

      try {
        const existingBudgets = queryClient.getQueryData(['budgets', activeProfile.id]) || [];
        const parentBudget = existingBudgets.find(b => b.chart_account_id === parentAccountId);

        if (!parentBudget) {
          const parentCategory = availableCategories.find(c => c.id === parentAccountId) ||
            queryClient.getQueryData(['user-chart-accounts-income-expense', activeProfile.id])?.find(c => c.id === parentAccountId);

          setParentBudgetInfo({
            hasParentBudget: false,
            parentName: parentCategory?.display_name || 'Parent Category'
          });
          return;
        }

        const { data: validationData } = await firstsavvy.supabase.rpc(
          'validate_child_budget_allocation',
          {
            p_child_account_id: selectedCategoryId,
            p_proposed_amount: parseFloat(parseCurrency(limitAmount)) || 0,
            p_profile_id: activeProfile.id,
            p_budget_id: isEditMode ? editingBudget?.id : null
          }
        );

        if (validationData && validationData.length > 0) {
          const validation = validationData[0];
          setParentBudgetInfo({
            hasParentBudget: true,
            parentName: parentBudget.chartAccount?.display_name || 'Parent Category',
            parentBudget: validation.parent_budget,
            allocatedToChildren: validation.allocated_to_children,
            availableBudget: validation.available_budget
          });
        }
      } catch (error) {
        console.error('Error fetching parent budget info:', error);
        setParentBudgetInfo(null);
      }
    };

    fetchParentBudgetInfo();
  }, [selectedCategoryId, limitAmount, availableCategories, activeProfile, queryClient, isEditMode, editingBudget]);

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
    onError: async (error) => {
      console.error('Error updating budget:', error);

      // Check if this is a budget validation error from the database trigger
      // Supabase errors can be in different places
      const errorMessage = error?.message || error?.error?.message || error?.details || JSON.stringify(error);
      console.log('Error message:', errorMessage);

      if (errorMessage.includes('Budget exceeds parent') || errorMessage.includes('Cannot create budget for child category')) {
        // Try to open the adjustment dialog even though the error already occurred
        const selectedAccount = availableCategories.find(a => a.id === selectedCategoryId);
        const parentAccountId = selectedAccount?.parent_account_id;

        if (parentAccountId) {
          try {
            // Re-fetch validation data to populate the dialog
            const { data: validationData } = await firstsavvy.supabase.rpc(
              'validate_child_budget_allocation',
              {
                p_child_account_id: selectedCategoryId,
                p_proposed_amount: parseFloat(parseCurrency(limitAmount)) || 0,
                p_profile_id: activeProfile.id,
                p_budget_id: editingBudget?.id || null
              }
            );

            if (validationData && validationData.length > 0) {
              const validation = validationData[0];
              const parentCategory = availableCategories.find(c => c.id === parentAccountId) ||
                queryClient.getQueryData(['user-chart-accounts-income-expense', activeProfile.id])?.find(c => c.id === parentAccountId);

              const existingBudgets = queryClient.getQueryData(['budgets', activeProfile.id]) || [];
              const siblingBudgets = existingBudgets
                .filter(b => {
                  const budgetCategory = availableCategories.find(c => c.id === b.chart_account_id);
                  return budgetCategory?.parent_account_id === parentAccountId &&
                         b.chart_account_id !== selectedCategoryId;
                })
                .map(b => ({
                  name: b.chartAccount?.display_name || b.chartAccount?.account_detail || 'Unknown',
                  amount: b.allocated_amount || 0
                }));

              setParentBudgetDialogData({
                parentCategory,
                childCategory: selectedAccount,
                requestedAmount: parseFloat(parseCurrency(limitAmount)) || 0,
                validationInfo: {
                  parent_budget: validation.parent_budget,
                  allocated_to_children: validation.allocated_to_children,
                  available_budget: validation.available_budget,
                  sibling_budgets: siblingBudgets
                }
              });
              setShowParentBudgetDialog(true);
              return;
            }
          } catch (validationError) {
            console.error('Error fetching validation data:', validationError);
          }
        }
      }

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
    setHasParentCategory(false);
    setSelectedParentCategoryId('');
    setParentCategories([]);
  };

  const handleCategoryCreated = (newCategory) => {
    if (newCategory?.id) {
      setSelectedCategoryId(newCategory.id);
      setSearchTerm('');
      setEditingCategory(null);
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts-income-expense'] });
    }
  };

  const handleCategorySheetClose = (isOpen) => {
    setShowAddCategorySheet(isOpen);
    if (!isOpen) {
      setEditingCategory(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCategoryId || !limitAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (hasParentCategory && !selectedParentCategoryId) {
      toast.error('Please select a parent category');
      return;
    }

    const selectedAccount = availableCategories.find(a => a.id === selectedCategoryId);
    const newAmount = parseFloat(parseCurrency(limitAmount)) || 0;

    if (newAmount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    // Check if this category has a parent account
    const parentAccountId = selectedAccount?.parent_account_id;

    if (parentAccountId) {
      // Run synchronous validation check before attempting database insert
      try {
        console.log('Running validation for child budget:', {
          selectedCategoryId,
          newAmount,
          parentAccountId,
          profileId: activeProfile.id
        });

        const { data: validationData, error: validationError } = await firstsavvy.supabase.rpc(
          'validate_child_budget_allocation',
          {
            p_child_account_id: selectedCategoryId,
            p_proposed_amount: newAmount,
            p_profile_id: activeProfile.id,
            p_budget_id: isEditMode ? editingBudget?.id : null
          }
        );

        console.log('Validation result:', { validationData, validationError });

        if (validationError) {
          console.error('Validation error:', validationError);
          toast.error('Failed to validate budget allocation');
          return;
        }

        if (validationData && validationData.length > 0) {
          const validation = validationData[0];
          console.log('Validation object:', validation);

          // If validation failed, open the adjustment dialog
          if (!validation.is_valid) {
            console.log('Validation failed, opening dialog');
            const parentCategory = availableCategories.find(c => c.id === parentAccountId) ||
              queryClient.getQueryData(['user-chart-accounts-income-expense', activeProfile.id])?.find(c => c.id === parentAccountId);

            const existingBudgets = queryClient.getQueryData(['budgets', activeProfile.id]) || [];
            const siblingBudgets = existingBudgets
              .filter(b => {
                const budgetCategory = availableCategories.find(c => c.id === b.chart_account_id);
                return budgetCategory?.parent_account_id === parentAccountId &&
                       b.chart_account_id !== selectedCategoryId;
              })
              .map(b => ({
                name: b.chartAccount?.display_name || b.chartAccount?.account_detail || 'Unknown',
                amount: b.allocated_amount || 0
              }));

            setParentBudgetDialogData({
              parentCategory,
              childCategory: selectedAccount,
              requestedAmount: newAmount,
              validationInfo: {
                parent_budget: validation.parent_budget,
                allocated_to_children: validation.allocated_to_children,
                available_budget: validation.available_budget,
                sibling_budgets: siblingBudgets
              }
            });
            setShowParentBudgetDialog(true);
            return;
          }
        }
      } catch (error) {
        console.error('Error validating budget:', error);
        toast.error('Failed to validate budget allocation');
        return;
      }
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

    const newParentId = hasParentCategory ? selectedParentCategoryId : null;
    if (newParentId !== selectedAccount?.parent_account_id) {
      updates.parent_account_id = newParentId;
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
            <div className="flex gap-2">
              <div className="flex-1">
                <ClickThroughSelect
                  value={selectedCategoryId}
                  onValueChange={(val) => {
                    if (val === '__add_new_category__') {
                      setEditingCategory(null);
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
                    {searchTerm ? `Add New: "${searchTerm}"` : 'Add New Category'}
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
              {selectedCategoryId && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => {
                    const category = availableCategories.find(c => c.id === selectedCategoryId);
                    if (category) {
                      setEditingCategory(category);
                      setShowAddCategorySheet(true);
                    }
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {selectedCategoryId && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasParent"
                  checked={hasParentCategory}
                  onCheckedChange={(checked) => {
                    setHasParentCategory(checked);
                    if (!checked) {
                      setSelectedParentCategoryId('');
                    }
                  }}
                />
                <Label htmlFor="hasParent" className="text-sm font-normal cursor-pointer">
                  This is a sub-category
                </Label>
              </div>

              {hasParentCategory && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="parentCategory">Parent Category*</Label>
                  <Select
                    value={selectedParentCategoryId}
                    onValueChange={setSelectedParentCategoryId}
                  >
                    <SelectTrigger id="parentCategory" className="h-10">
                      <SelectValue placeholder="Select parent category" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.display_name || cat.account_detail}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

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
            {parentBudgetInfo && parentBudgetInfo.hasParentBudget && (() => {
              const requestedAmount = parseFloat(parseCurrency(limitAmount)) || 0;
              const exceedsAvailable = requestedAmount > 0 && requestedAmount > parentBudgetInfo.availableBudget;
              const shortfall = requestedAmount - parentBudgetInfo.availableBudget;

              return (
                <div className={`mt-2 p-3 rounded-md text-sm border ${
                  exceedsAvailable
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <p className="font-medium text-slate-900">Parent Budget: {parentBudgetInfo.parentName}</p>
                  <div className="mt-1 space-y-0.5 text-slate-600">
                    <p>Total Budget: ${parentBudgetInfo.parentBudget?.toFixed(2) || '0.00'}</p>
                    <p>Allocated to Children: ${parentBudgetInfo.allocatedToChildren?.toFixed(2) || '0.00'}</p>
                    <p className="font-medium text-slate-900">Available: ${parentBudgetInfo.availableBudget?.toFixed(2) || '0.00'}</p>
                  </div>
                  {exceedsAvailable && (
                    <div className="mt-2 pt-2 border-t border-amber-300">
                      <p className="text-amber-900 font-medium flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Exceeds available budget by ${shortfall.toFixed(2)}
                      </p>
                      <p className="text-amber-700 text-xs mt-1">
                        You'll be able to increase the parent budget when you submit
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
            {parentBudgetInfo && !parentBudgetInfo.hasParentBudget && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                <p className="text-amber-900 font-medium">
                  Parent category "{parentBudgetInfo.parentName}" has no budget
                </p>
                <p className="text-amber-700 mt-1">
                  Create a budget for the parent first
                </p>
              </div>
            )}
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

    <AccountCreationWizard
      open={showAddCategorySheet}
      onOpenChange={handleCategorySheetClose}
      initialAccountType="budget"
      initialClass={editingCategory ? editingCategory.class : "expense"}
      initialCategoryName={searchTerm}
      editingCategory={editingCategory}
      onAccountCreated={(result) => {
        if (result?.account) {
          handleCategoryCreated(result.account);
        }
      }}
    />
  </>
  );
}
