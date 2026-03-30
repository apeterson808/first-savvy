import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function AddChildSheet({ open, onOpenChange, onChildAdded, profileId }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    child_name: '',
    date_of_birth: '',
    current_permission_level: 1,
    daily_spending_limit: '',
    weekly_spending_limit: '',
    monthly_spending_limit: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.child_name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      setLoading(true);
      await childProfilesAPI.createChildProfile(profileId, {
        ...formData,
        daily_spending_limit: formData.daily_spending_limit ? parseFloat(formData.daily_spending_limit) : null,
        weekly_spending_limit: formData.weekly_spending_limit ? parseFloat(formData.weekly_spending_limit) : null,
        monthly_spending_limit: formData.monthly_spending_limit ? parseFloat(formData.monthly_spending_limit) : null,
      });

      setFormData({
        child_name: '',
        date_of_birth: '',
        current_permission_level: 1,
        daily_spending_limit: '',
        weekly_spending_limit: '',
        monthly_spending_limit: '',
        notes: '',
      });

      onChildAdded();
    } catch (error) {
      console.error('Error creating child:', error);
      toast.error('Failed to create child profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Child Profile</SheetTitle>
          <SheetDescription>
            Create a new child profile to start teaching financial responsibility
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="child_name">Child's Name *</Label>
            <Input
              id="child_name"
              value={formData.child_name}
              onChange={(e) => setFormData({ ...formData, child_name: e.target.value })}
              placeholder="Enter child's name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="current_permission_level">Starting Permission Level</Label>
            <Select
              value={formData.current_permission_level.toString()}
              onValueChange={(value) => setFormData({ ...formData, current_permission_level: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Level 1 - Supervised (Ages 5+)</SelectItem>
                <SelectItem value="2">Level 2 - Monitored (Ages 8+)</SelectItem>
                <SelectItem value="3">Level 3 - Semi-Independent (Ages 12+)</SelectItem>
                <SelectItem value="4">Level 4 - Independent (Ages 15+)</SelectItem>
                <SelectItem value="5">Level 5 - Full Control (Ages 18+)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              You can change this later based on demonstrated responsibility
            </p>
          </div>

          <div className="space-y-4">
            <Label>Spending Limits (Optional)</Label>
            <p className="text-sm text-slate-600">
              Set spending limits for when the child reaches Level 3 (cash access)
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="daily_spending_limit" className="text-xs">Daily</Label>
                <Input
                  id="daily_spending_limit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.daily_spending_limit}
                  onChange={(e) => setFormData({ ...formData, daily_spending_limit: e.target.value })}
                  placeholder="$0.00"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="weekly_spending_limit" className="text-xs">Weekly</Label>
                <Input
                  id="weekly_spending_limit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weekly_spending_limit}
                  onChange={(e) => setFormData({ ...formData, weekly_spending_limit: e.target.value })}
                  placeholder="$0.00"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="monthly_spending_limit" className="text-xs">Monthly</Label>
                <Input
                  id="monthly_spending_limit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthly_spending_limit}
                  onChange={(e) => setFormData({ ...formData, monthly_spending_limit: e.target.value })}
                  placeholder="$0.00"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about your child's financial learning journey..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Child Profile'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
