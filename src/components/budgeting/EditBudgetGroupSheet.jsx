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
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditBudgetGroupSheet({ open, onOpenChange, group }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');

  useEffect(() => {
    if (group && open) {
      setName(group.name || '');
      setType(group.type || 'expense');
    }
  }, [group, open]);

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }) => firstsavvy.entities.BudgetGroup.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
      toast.success('Budget group updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating budget group:', error);
      toast.error('Failed to update budget group');
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id) => {
      const { data: budgets } = await firstsavvy.supabase
        .from('budgets')
        .delete()
        .eq('group_id', id);

      await firstsavvy.entities.BudgetGroup.delete(id);
      return { id, budgets };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetGroups'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget group and associated items deleted successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error deleting budget group:', error);
      toast.error('Failed to delete budget group');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Group name is required');
      return;
    }

    updateGroupMutation.mutate({
      id: group.id,
      data: {
        name: name.trim(),
        type
      }
    });
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this budget group? All budget items in this group will also be deleted.')) {
      deleteGroupMutation.mutate(group.id);
    }
  };

  const resetForm = () => {
    setName('');
    setType('expense');
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Budget Group</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="name">Group Name*</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Monthly Expenses"
            />
          </div>

          <div>
            <Label>Type*</Label>
            <ClickThroughSelect
              value={type}
              onValueChange={setType}
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
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90"
              disabled={!name.trim() || updateGroupMutation.isPending}
            >
              Update
            </Button>
          </SheetFooter>

          <div className="pt-4 mt-4 border-t">
            <Button
              type="button"
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
              onClick={handleDelete}
              disabled={deleteGroupMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Budget Group
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
