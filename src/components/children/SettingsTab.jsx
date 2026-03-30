import { useState } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export function SettingsTab({ child, onUpdate }) {
  const [formData, setFormData] = useState({
    child_name: child.child_name,
    date_of_birth: child.date_of_birth || '',
    daily_spending_limit: child.daily_spending_limit || '',
    weekly_spending_limit: child.weekly_spending_limit || '',
    monthly_spending_limit: child.monthly_spending_limit || '',
    notes: child.notes || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      await childProfilesAPI.updateChildProfile(child.id, {
        child_name: formData.child_name,
        date_of_birth: formData.date_of_birth || null,
        daily_spending_limit: formData.daily_spending_limit ? parseFloat(formData.daily_spending_limit) : null,
        weekly_spending_limit: formData.weekly_spending_limit ? parseFloat(formData.weekly_spending_limit) : null,
        monthly_spending_limit: formData.monthly_spending_limit ? parseFloat(formData.monthly_spending_limit) : null,
        notes: formData.notes,
      });
      toast.success('Settings updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Error updating child:', error);
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Update child's profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="child_name">Name</Label>
            <Input
              id="child_name"
              value={formData.child_name}
              onChange={(e) => setFormData({ ...formData, child_name: e.target.value })}
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
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spending Limits</CardTitle>
          <CardDescription>
            Set spending limits for cash mode (Level 3+)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_spending_limit">Daily Limit</Label>
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

            <div className="space-y-2">
              <Label htmlFor="weekly_spending_limit">Weekly Limit</Label>
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

            <div className="space-y-2">
              <Label htmlFor="monthly_spending_limit">Monthly Limit</Label>
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
