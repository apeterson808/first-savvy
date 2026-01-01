import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const INCOME_TYPES = [
  { value: 'earned_income', label: 'Earned Income' },
  { value: 'passive_income', label: 'Passive Income' },
];

const EXPENSE_TYPES = [
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'food_dining', label: 'Food & Dining' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'kids_family', label: 'Kids & Family' },
  { value: 'education', label: 'Education' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'travel', label: 'Travel' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'pets', label: 'Pets' },
  { value: 'financial', label: 'Financial' },
  { value: 'giving', label: 'Giving' },
  { value: 'taxes', label: 'Taxes' },
];

export default function AddCategoryDialog({
  open,
  onOpenChange,
  transactionType = 'expense',
  onSubmit,
  initialName = ''
}) {
  const [categoryName, setCategoryName] = useState(initialName);
  const [accountDetail, setAccountDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryTypes = transactionType === 'income' ? INCOME_TYPES : EXPENSE_TYPES;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!categoryName.trim() || !accountDetail) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: categoryName.trim(),
        accountDetail: accountDetail
      });

      setCategoryName('');
      setAccountDetail('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating category:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      setCategoryName('');
      setAccountDetail('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New {transactionType === 'income' ? 'Income' : 'Expense'} Category</DialogTitle>
          <DialogDescription>
            Create a custom category for tracking your {transactionType === 'income' ? 'income' : 'expenses'}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g., Freelance Work"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-type">Category Type</Label>
            <Select value={accountDetail} onValueChange={setAccountDetail} required>
              <SelectTrigger id="category-type">
                <SelectValue placeholder={`Select ${transactionType} type`} />
              </SelectTrigger>
              <SelectContent>
                {categoryTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !categoryName.trim() || !accountDetail}>
              {isSubmitting ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
