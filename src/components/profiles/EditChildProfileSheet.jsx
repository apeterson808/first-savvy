import { useState, useEffect } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import AvatarSelector from '../children/AvatarSelector';
import { differenceInYears } from 'date-fns';

export function EditChildProfileSheet({ open, onOpenChange, child, onChildUpdated }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    sex: '',
    avatar: null,
    current_permission_level: 1,
    daily_spending_limit: '',
    weekly_spending_limit: '',
    monthly_spending_limit: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [age, setAge] = useState(null);

  useEffect(() => {
    if (child) {
      setFormData({
        first_name: child.first_name || '',
        last_name: child.last_name || '',
        date_of_birth: child.date_of_birth || '',
        sex: child.sex || '',
        avatar: child.avatar || null,
        current_permission_level: child.current_permission_level || 1,
        daily_spending_limit: child.daily_spending_limit || '',
        weekly_spending_limit: child.weekly_spending_limit || '',
        monthly_spending_limit: child.monthly_spending_limit || '',
        notes: child.notes || '',
      });
    }
  }, [child]);

  useEffect(() => {
    if (formData.date_of_birth) {
      const birthDate = new Date(formData.date_of_birth);
      const calculatedAge = differenceInYears(new Date(), birthDate);
      setAge(calculatedAge);
    } else {
      setAge(null);
    }
  }, [formData.date_of_birth]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.first_name.trim()) {
      toast.error('Please enter first name');
      return;
    }

    if (!formData.last_name.trim()) {
      toast.error('Please enter last name');
      return;
    }

    if (formData.first_name.length < 2 || formData.first_name.length > 50) {
      toast.error('First name must be between 2 and 50 characters');
      return;
    }

    if (formData.last_name.length < 2 || formData.last_name.length > 50) {
      toast.error('Last name must be between 2 and 50 characters');
      return;
    }

    try {
      setLoading(true);
      await childProfilesAPI.updateChildProfile(child.id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        child_name: `${formData.first_name} ${formData.last_name}`,
        date_of_birth: formData.date_of_birth || null,
        sex: formData.sex || null,
        avatar: formData.avatar,
        current_permission_level: formData.current_permission_level,
        daily_spending_limit: formData.daily_spending_limit ? parseFloat(formData.daily_spending_limit) : null,
        weekly_spending_limit: formData.weekly_spending_limit ? parseFloat(formData.weekly_spending_limit) : null,
        monthly_spending_limit: formData.monthly_spending_limit ? parseFloat(formData.monthly_spending_limit) : null,
        notes: formData.notes || null,
      });

      toast.success('Child profile updated successfully');
      onOpenChange(false);
      if (onChildUpdated) {
        onChildUpdated();
      }
    } catch (error) {
      console.error('Error updating child profile:', error);
      toast.error(error.message || 'Failed to update child profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Child Profile</SheetTitle>
          <SheetDescription>
            Update child profile information
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Avatar</Label>
              <AvatarSelector
                value={formData.avatar}
                onChange={(avatar) => setFormData({ ...formData, avatar })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first-name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Enter first name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last-name">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last-name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Enter last name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-of-birth">Date of Birth</Label>
                <Input
                  id="date-of-birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
                {age !== null && (
                  <p className="text-sm text-slate-500">Age: {age} years old</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select
                  value={formData.sex}
                  onValueChange={(value) => setFormData({ ...formData, sex: value })}
                >
                  <SelectTrigger id="sex">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Permission Tier</h3>
              <div className="space-y-2">
                <Select
                  value={String(formData.current_permission_level)}
                  onValueChange={(value) => setFormData({ ...formData, current_permission_level: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tier 1 - Basic Access</SelectItem>
                    <SelectItem value="2">Tier 2 - Rewards</SelectItem>
                    <SelectItem value="3">Tier 3 - Money</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-slate-500">
                  {formData.current_permission_level === 1 && 'Basic access to view chores and points'}
                  {formData.current_permission_level === 2 && 'Can earn and redeem rewards'}
                  {formData.current_permission_level === 3 && 'Full access including money management'}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Spending Limits (Optional)</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="daily-limit">Daily Limit</Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.daily_spending_limit}
                    onChange={(e) => setFormData({ ...formData, daily_spending_limit: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekly-limit">Weekly Limit</Label>
                  <Input
                    id="weekly-limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weekly_spending_limit}
                    onChange={(e) => setFormData({ ...formData, weekly_spending_limit: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly-limit">Monthly Limit</Label>
                  <Input
                    id="monthly-limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monthly_spending_limit}
                    onChange={(e) => setFormData({ ...formData, monthly_spending_limit: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this child's profile..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Updating...' : 'Update Profile'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
