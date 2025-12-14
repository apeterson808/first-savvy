import React, { useState, useEffect } from 'react';
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

const GROUP_COLORS = {
  income: '#22c55e',
  expense: '#3b82f6'
};

export default function EditBudgetGroupSheet({ open, onOpenChange, group, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');

  useEffect(() => {
    if (group && open) {
      setName(group.name || '');
      setType(group.type || 'expense');
    }
  }, [group, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      type
    });
    onOpenChange(false);
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
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!name.trim()}
            >
              Save
            </Button>
          </SheetFooter>
          
          {onDelete && (
            <div className="pt-4 mt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
                onClick={() => {
                  onDelete(group.id);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Budget Group
              </Button>
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}