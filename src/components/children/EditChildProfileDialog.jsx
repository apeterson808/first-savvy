import { useState, useEffect } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import { supabase } from '@/api/supabaseClient';
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
import { Textarea } from '@/components/ui/textarea';
import AvatarSelector from './AvatarSelector';
import { toast } from 'sonner';

export function EditChildProfileDialog({ open, onOpenChange, child, currentProfileId, onUpdate }) {
  const [formData, setFormData] = useState({
    child_name: '',
    date_of_birth: '',
    daily_spending_limit: '',
    weekly_spending_limit: '',
    monthly_spending_limit: '',
    notes: '',
  });
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (child) {
      setFormData({
        child_name: child.child_name,
        date_of_birth: child.date_of_birth || '',
        daily_spending_limit: child.daily_spending_limit || '',
        weekly_spending_limit: child.weekly_spending_limit || '',
        monthly_spending_limit: child.monthly_spending_limit || '',
        notes: child.notes || '',
      });
      setAvatar(null);
    }
  }, [child]);

  const handleSave = async () => {
    try {
      setLoading(true);

      const updates = {
        child_name: formData.child_name,
        date_of_birth: formData.date_of_birth || null,
        daily_spending_limit: formData.daily_spending_limit ? parseFloat(formData.daily_spending_limit) : null,
        weekly_spending_limit: formData.weekly_spending_limit ? parseFloat(formData.weekly_spending_limit) : null,
        monthly_spending_limit: formData.monthly_spending_limit ? parseFloat(formData.monthly_spending_limit) : null,
        notes: formData.notes,
      };

      if (avatar) {
        let avatarUrl = null;
        if (avatar.type === 'upload' && avatar.file) {
          const fileExt = avatar.file.name.split('.').pop();
          const fileName = `${currentProfileId}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatar.file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Avatar upload error:', uploadError);
            toast.error('Failed to upload avatar');
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);
            avatarUrl = publicUrl;
          }
        } else if (avatar.type === 'preset') {
          avatarUrl = `preset:${avatar.value}`;
        }

        if (avatarUrl) {
          updates.avatar_url = avatarUrl;
        }
      }

      await childProfilesAPI.updateChildProfile(child.id, updates);
      toast.success('Profile updated successfully');
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating child:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update child's profile information and settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <AvatarSelector
            value={avatar}
            onChange={setAvatar}
            firstName={formData.child_name.split(' ')[0]}
            lastName={formData.child_name.split(' ')[1] || ''}
          />

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

          <div className="space-y-3">
            <Label className="text-base">Spending Limits (Tier 3)</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
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

              <div className="space-y-2">
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

              <div className="space-y-2">
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
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
