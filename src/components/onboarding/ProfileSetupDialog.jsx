import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';

export default function ProfileSetupDialog({ open, onClose, currentFullName = '', currentDisplayName = 'Personal' }) {
  const [fullName, setFullName] = useState(currentFullName);
  const [displayName, setDisplayName] = useState(currentDisplayName === 'Personal' ? '' : currentDisplayName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = (await firstsavvy.auth.getUser()).data.user?.id;

      if (!userId) {
        throw new Error('Not authenticated');
      }

      if (fullName && fullName !== currentFullName) {
        await firstsavvy
          .from('user_profiles')
          .update({ full_name: fullName })
          .eq('id', userId);
      }

      if (displayName && displayName !== currentDisplayName) {
        const { data: membership } = await firstsavvy
          .from('profile_memberships')
          .select('profile_id')
          .eq('user_id', userId)
          .eq('role', 'owner')
          .single();

        if (membership?.profile_id) {
          await firstsavvy
            .from('profiles')
            .update({ display_name: displayName })
            .eq('id', membership.profile_id);
        }
      }

      toast.success('Profile updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-4 mx-auto">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl">Complete Your Profile</DialogTitle>
          <DialogDescription className="text-center">
            Help us personalize your experience. You can always update this later in Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name (optional)</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-slate-500">
              Your name will be used throughout the app
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Profile Display Name (optional)</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Personal"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-slate-500">
              This name appears in your profile tabs
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={saving}
            className="flex-1"
          >
            Skip for now
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
