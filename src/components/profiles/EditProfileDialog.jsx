import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';

export function EditProfileDialog({ open, onOpenChange, profile, onProfileUpdated }) {
  const [profileName, setProfileName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (profile) {
      setProfileName(profile.display_name || '');
    }
  }, [profile]);

  const handleUpdate = async () => {
    if (!profileName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profileName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      onOpenChange(false);
      if (onProfileUpdated) {
        onProfileUpdated();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update the profile name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-profile-name">Profile Name</Label>
            <Input
              id="edit-profile-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              disabled={isUpdating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating || !profileName.trim()}>
            {isUpdating ? 'Updating...' : 'Update Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
