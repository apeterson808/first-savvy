import { useState } from 'react';
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
import { Users, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';

export function CreateProfileDialog({ open, onOpenChange, onProfileCreated }) {
  const [profileName, setProfileName] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!profileName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }
    if (!selectedType) {
      toast.error('Please select a profile type');
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          profile_type: selectedType,
          display_name: profileName,
          is_deleted: false,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`${selectedType === 'family' ? 'Family' : 'Business'} profile created`);
      setProfileName('');
      setSelectedType(null);
      onOpenChange(false);
      if (onProfileCreated) {
        onProfileCreated(data);
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setProfileName('');
      setSelectedType(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Profile</DialogTitle>
          <DialogDescription>
            Create a Family or Business profile to manage your finances.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Profile Type</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedType('family')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedType === 'family'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Users className={`h-8 w-8 mx-auto mb-2 ${
                  selectedType === 'family' ? 'text-green-600' : 'text-slate-400'
                }`} />
                <div className="text-sm font-medium">Family</div>
                <div className="text-xs text-slate-500 mt-1">Household finances</div>
              </button>
              <button
                onClick={() => setSelectedType('business')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedType === 'business'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Briefcase className={`h-8 w-8 mx-auto mb-2 ${
                  selectedType === 'business' ? 'text-orange-600' : 'text-slate-400'
                }`} />
                <div className="text-sm font-medium">Business</div>
                <div className="text-xs text-slate-500 mt-1">Business management</div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name">Profile Name</Label>
            <Input
              id="profile-name"
              placeholder={selectedType === 'family' ? 'e.g., Smith Family' : 'e.g., My Business'}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              disabled={isCreating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !profileName.trim() || !selectedType}>
            {isCreating ? 'Creating...' : 'Create Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
