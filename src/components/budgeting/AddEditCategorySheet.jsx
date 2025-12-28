import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import AppearancePicker from '@/components/common/AppearancePicker';
import { suggestIconForName } from '@/components/utils/iconMapper';

export default function AddEditCategorySheet({
  open,
  onOpenChange,
  editingCategory,
  accountType,
  onCategoryCreated
}) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: accountType || 'expense',
    icon: 'Circle',
    color: '#52A5CE',
  });

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.display_name || editingCategory.account_detail || '',
        type: editingCategory.class || 'expense',
        icon: editingCategory.icon || 'Circle',
        color: editingCategory.color || '#52A5CE',
      });
    } else {
      setFormData({
        name: '',
        type: accountType || 'expense',
        icon: 'Circle',
        color: '#52A5CE',
      });
    }
  }, [editingCategory, open, accountType]);

  const handleNameChange = (name) => {
    setFormData(prev => ({
      ...prev,
      name,
      icon: name ? suggestIconForName(name) : prev.icon,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingCategory) {
        await firstsavvy.entities.ChartAccount.update(editingCategory.id, {
          display_name: formData.name.trim(),
          icon: formData.icon,
          color: formData.color,
        });

        await firstsavvy.supabase.from('budgets')
          .update({
            icon: formData.icon,
            color: formData.color,
          })
          .eq('chart_account_id', editingCategory.id);

        toast.success('Category updated successfully');
      } else {
        const accountTypePrefix = formData.type === 'income' ? 4 : 5;
        const { data: existingAccounts } = await firstsavvy.supabase
          .from('user_chart_of_accounts')
          .select('account_number')
          .gte('account_number', accountTypePrefix * 1000)
          .lt('account_number', (accountTypePrefix + 1) * 1000)
          .order('account_number', { ascending: false })
          .limit(1);

        const nextAccountNumber = existingAccounts && existingAccounts.length > 0
          ? existingAccounts[0].account_number + 1
          : accountTypePrefix * 1000 + 100;

        const newCategory = await firstsavvy.entities.ChartAccount.create({
          account_number: nextAccountNumber,
          display_name: formData.name.trim(),
          class: formData.type,
          icon: formData.icon,
          color: formData.color,
          is_user_created: true,
          is_active: true,
        });

        if (onCategoryCreated) {
          onCategoryCreated(newCategory);
        }

        toast.success('Category created successfully');
      }

      queryClient.invalidateQueries({ queryKey: ['chart-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['user-chart-accounts-income-expense'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error(editingCategory ? 'Failed to update category' : 'Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</SheetTitle>
          <SheetDescription>
            {editingCategory
              ? 'Update the category name, icon, and color. Changes will apply to all associated budgets.'
              : 'Create a new category for organizing your transactions and budgets.'
            }
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Groceries, Salary, Utilities"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              disabled={!!editingCategory}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            {editingCategory && (
              <p className="text-xs text-slate-500">
                Category type cannot be changed after creation
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Appearance</Label>
            <AppearancePicker
              color={formData.color}
              icon={formData.icon}
              onColorChange={(color) => setFormData(prev => ({ ...prev, color }))}
              onIconChange={(icon) => setFormData(prev => ({ ...prev, icon }))}
              inline={true}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingCategory ? 'Update Category' : 'Create Category'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
