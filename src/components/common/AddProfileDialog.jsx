import React, { useState } from 'react';
import { User, Users, Briefcase } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';

export function AddProfileDialog({ open, onOpenChange, onProfileCreated }) {
  const [displayName, setDisplayName] = useState('');
  const [profileType, setProfileType] = useState('household');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!displayName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await firstsavvy.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: profile, error: profileError } = await firstsavvy
        .from('profiles')
        .insert({
          user_id: user.id,
          profile_type: profileType,
          display_name: displayName.trim(),
          is_deleted: false,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      const { error: membershipError } = await firstsavvy
        .from('profile_memberships')
        .insert({
          profile_id: profile.id,
          user_id: user.id,
          role: 'owner',
        });

      if (membershipError) throw membershipError;

      toast.success(`Profile "${displayName}" created successfully`);
      setDisplayName('');
      setProfileType('household');
      onOpenChange(false);

      if (onProfileCreated) {
        onProfileCreated(profile);
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setCreating(false);
    }
  };

  const profileTypes = [
    {
      type: 'household',
      icon: Users,
      title: 'Household',
      description: 'Shared household finances',
      color: 'bg-green-500',
    },
    {
      type: 'business',
      icon: Briefcase,
      title: 'Business',
      description: 'Business financial management',
      color: 'bg-orange-500',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Profile</DialogTitle>
          <DialogDescription>
            Create a household or business profile to manage separate finances.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Profile Name</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="e.g., Family Budget, Peterson Household"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={creating}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Profile Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {profileTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = profileType === type.type;

                return (
                  <button
                    key={type.type}
                    onClick={() => setProfileType(type.type)}
                    disabled={creating}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full ${type.color} flex items-center justify-center`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-sm">{type.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {type.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !displayName.trim()}
            className="flex-1"
          >
            {creating ? 'Creating...' : 'Create Profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
