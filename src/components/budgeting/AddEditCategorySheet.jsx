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
import IconPicker from '@/components/common/IconPicker';
import ColorPicker from '@/components/common/ColorPicker';
import { suggestIconForName } from '@/components/utils/iconMapper';

export default function AddEditCategorySheet({ open, onOpenChange, editingCategory }) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense',
    icon: 'Circle',
    color: '#52A5CE',
  });

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name || '',
        type: editingCategory.type || 'expense',
        icon: editingCategory.icon || 'Circle',
        color: editingCategory.color || '#52A5CE',
      });
    } else {
      setFormData({
        name: '',
        type: 'expense',
        icon: 'Circle',
        color: '#52A5CE',
      });
    }
  }, [editingCategory, open]);

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
        await firstsavvy.entities.Category.update(editingCategory.id, {
          name: formData.name.trim(),
          icon: formData.icon,
          color: formData.color,
        });

        await firstsavvy.from('budgets')
          .update({
            icon: formData.icon,
            color: formData.color,
          })
          .eq('chart_account_id', editingCategory.id);

        toast.success('Category updated successfully');
      } else {
        await firstsavvy.entities.Category.create({
          name: formData.name.trim(),
          type: formData.type,
          icon: formData.icon,
          color: formData.color,
          is_system: false,
        });

        toast.success('Category created successfully');
      }

      queryClient.invalidateQueries({ queryKey: ['categories'] });
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
            <Label>Icon</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-2 border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-600">
                {formData.icon}
              </div>
              <IconPicker
                value={formData.icon}
                onValueChange={(icon) => setFormData(prev => ({ ...prev, icon }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-2 border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-600">
                {formData.color}
              </div>
              <ColorPicker
                value={formData.color}
                onChange={(color) => setFormData(prev => ({ ...prev, color }))}
              />
            </div>
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
