import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import AvatarSelector from './AvatarSelector';
import { differenceInYears } from 'date-fns';

export function AddChildSheet({ open, onOpenChange, onChildAdded, profileId }) {
  const { user } = useAuth();
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
    if (formData.date_of_birth) {
      const birthDate = new Date(formData.date_of_birth);
      const calculatedAge = differenceInYears(new Date(), birthDate);
      setAge(calculatedAge);

      let suggestedLevel = 1;
      if (calculatedAge >= 15) {
        suggestedLevel = 3;
      } else if (calculatedAge >= 11) {
        suggestedLevel = 2;
      }

      if (formData.current_permission_level !== suggestedLevel) {
        setFormData(prev => ({ ...prev, current_permission_level: suggestedLevel }));
      }
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
      await childProfilesAPI.createChildProfile(profileId, {
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

      setFormData({
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
      setAge(null);

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
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Basic Information</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Enter first name"
                  maxLength={50}
                  required
                />
                <p className="text-xs text-slate-500">{formData.first_name.length}/50</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Enter last name"
                  maxLength={50}
                  required
                />
                <p className="text-xs text-slate-500">{formData.last_name.length}/50</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
              />
              {age !== null && (
                <p className="text-xs text-slate-600">Age: {age} years old</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sex">Sex (Optional)</Label>
              <Select
                value={formData.sex}
                onValueChange={(value) => setFormData({ ...formData, sex: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sex" />
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

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Avatar</h3>
            <AvatarSelector
              value={formData.avatar}
              onChange={(avatar) => setFormData({ ...formData, avatar })}
              firstName={formData.first_name}
              lastName={formData.last_name}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="current_permission_level">Permission Tier</Label>
            <Select
              value={formData.current_permission_level.toString()}
              onValueChange={(value) => setFormData({ ...formData, current_permission_level: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Tier 1 - Basic access (Ages 5-10)</SelectItem>
                <SelectItem value="2">Tier 2 - Rewards (Ages 11-14)</SelectItem>
                <SelectItem value="3">Tier 3 - Money (Ages 15+)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-600">
              {formData.current_permission_level === 1 && 'Dashboard and chores only'}
              {formData.current_permission_level === 2 && 'Can view and redeem rewards'}
              {formData.current_permission_level === 3 && 'View accounts and budgets'}
            </p>
            <p className="text-xs text-slate-500">
              You can change this later based on demonstrated responsibility
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Spending Limits (Optional)</h3>
            <p className="text-xs text-slate-600">
              Set spending limits for when the child uses Tier 3 features
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

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Notes (Optional)</h3>
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
