import { useState, useEffect } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import { profileSharesAPI } from '@/api/profileShares';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Crown } from 'lucide-react';
import { InviteChildDialog } from './InviteChildDialog';
import { ShareProfileDialog } from './ShareProfileDialog';
import AvatarSelector from './AvatarSelector';
import { toast } from 'sonner';

const PERMISSION_LEVELS = {
  view_only: 'View Only',
  editor: 'Editor',
  co_parent: 'Co-Parent'
};

export function ProfileHeaderCard({ child, currentProfileId, onUpdate }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    daily_spending_limit: '',
    weekly_spending_limit: '',
    monthly_spending_limit: '',
    notes: '',
  });
  const [originalData, setOriginalData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [shares, setShares] = useState([]);
  const [invitation, setInvitation] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    loadAccessData();
    if (child) {
      const data = {
        first_name: child.first_name || '',
        last_name: child.last_name || '',
        date_of_birth: child.date_of_birth || '',
        gender: child.gender || '',
        daily_spending_limit: child.daily_spending_limit || '',
        weekly_spending_limit: child.weekly_spending_limit || '',
        monthly_spending_limit: child.monthly_spending_limit || '',
        notes: child.notes || '',
      };
      setFormData(data);
      setOriginalData(data);
      setHasChanges(false);
    }
  }, [child]);

  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify(originalData);
    setHasChanges(changed);
  }, [formData, originalData]);

  const loadAccessData = async () => {
    try {
      setLoadingAccess(true);
      const [sharesData, invitationData] = await Promise.all([
        profileSharesAPI.getSharesByChildProfile(child.id),
        profileInvitationsAPI.getActiveInvitation(child.id)
      ]);
      setShares(sharesData || []);
      setInvitation(invitationData);
    } catch (error) {
      console.error('Error loading access data:', error);
    } finally {
      setLoadingAccess(false);
    }
  };

  const getInvitationStatus = () => {
    if (child.user_id) {
      return { text: 'Connected', variant: 'success' };
    }

    if (!invitation) {
      return { text: 'Invite', variant: 'default' };
    }

    if (invitation.status === 'pending') {
      const isExpired = new Date(invitation.invitation_expires_at) < new Date();
      if (isExpired) {
        return { text: 'Invite', variant: 'default' };
      }
      return { text: 'Resend Invite', variant: 'secondary' };
    }

    return { text: 'Invite', variant: 'default' };
  };

  const handleInviteClick = () => {
    if (child.user_id) return;
    setShowInviteDialog(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updates = { ...formData };

      if (updates.daily_spending_limit) {
        updates.daily_spending_limit = parseFloat(updates.daily_spending_limit);
      }
      if (updates.weekly_spending_limit) {
        updates.weekly_spending_limit = parseFloat(updates.weekly_spending_limit);
      }
      if (updates.monthly_spending_limit) {
        updates.monthly_spending_limit = parseFloat(updates.monthly_spending_limit);
      }

      await childProfilesAPI.updateChildProfile(child.id, updates);
      toast.success('Changes saved successfully');
      setOriginalData(formData);
      setHasChanges(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(originalData);
    setHasChanges(false);
  };

  const handleAvatarChange = async (newAvatar) => {
    try {
      let avatarUrl = null;

      if (newAvatar.type === 'upload' && newAvatar.file) {
        const fileExt = newAvatar.file.name.split('.').pop();
        const fileName = `${currentProfileId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, newAvatar.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          toast.error('Failed to upload avatar');
          return;
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      } else if (newAvatar.type === 'preset') {
        avatarUrl = `preset:${newAvatar.value}`;
      }

      if (avatarUrl) {
        await childProfilesAPI.updateChildProfile(child.id, { avatar_url: avatarUrl });
        toast.success('Avatar updated successfully');
        setAvatar(null);
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.error('Failed to update avatar');
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AvatarSelector
                    value={avatar}
                    onChange={handleAvatarChange}
                    firstName={formData.first_name}
                    lastName={formData.last_name}
                    currentAvatar={child.avatar_url}
                    compact={true}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2 group">
                      <Label htmlFor="first_name" className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">First Name</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="text-xl font-bold border-none hover:border hover:border-slate-300 focus:border focus:border-slate-400 bg-transparent hover:bg-slate-50 focus:bg-white transition-all shadow-none hover:shadow-sm focus:shadow-sm"
                      />
                    </div>
                    <div className="space-y-2 group">
                      <Label htmlFor="last_name" className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">Last Name</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="text-xl font-bold border-none hover:border hover:border-slate-300 focus:border focus:border-slate-400 bg-transparent hover:bg-slate-50 focus:bg-white transition-all shadow-none hover:shadow-sm focus:shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-slate-100 text-slate-800">
                  Beginner Profile
                </Badge>
                {child.date_of_birth && (
                  <span className="text-sm text-slate-600">
                    Age {Math.floor((new Date() - new Date(child.date_of_birth)) / 31557600000)}
                  </span>
                )}
                <Badge
                  className={
                    getInvitationStatus().variant === 'success'
                      ? 'bg-green-100 text-green-800'
                      : getInvitationStatus().variant === 'secondary'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200'
                  }
                  onClick={handleInviteClick}
                >
                  {getInvitationStatus().text}
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2 group">
                    <Label htmlFor="date_of_birth" className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="border-none hover:border hover:border-slate-300 focus:border focus:border-slate-400 bg-transparent hover:bg-slate-50 focus:bg-white transition-all shadow-none hover:shadow-sm focus:shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label htmlFor="gender" className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger id="gender" className="border-none hover:border hover:border-slate-300 focus:border focus:border-slate-400 bg-transparent hover:bg-slate-50 focus:bg-white transition-all shadow-none hover:shadow-sm focus:shadow-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Shared Access ({shares.length}/3)
                  </h3>
                  <Button
                    onClick={() => setShowShareDialog(true)}
                    variant="ghost"
                    size="sm"
                    disabled={shares.length >= 3}
                  >
                    <Users className="h-3 w-3 mr-1" />
                    Share
                  </Button>
                </div>
                {shares.length > 0 ? (
                  <div className="space-y-1.5">
                    {shares.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={share.shared_with_profile?.avatar_url} />
                          <AvatarFallback className="text-[10px]">
                            {share.shared_with_profile?.display_name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 font-medium">
                          {share.shared_with_profile?.display_name}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {PERMISSION_LEVELS[share.permission_level]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 text-center py-8 border border-dashed rounded">
                    No shared access yet
                  </div>
                )}
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="notes" className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Add notes about this child profile..."
                  className="border border-slate-200 hover:border-slate-300 focus:border-slate-400 bg-white transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t">
            <div className="flex items-start gap-2 text-xs text-slate-500">
              <Crown className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>You have full access as the profile owner</span>
            </div>
            {hasChanges && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <InviteChildDialog
        open={showInviteDialog}
        onOpenChange={(open) => {
          setShowInviteDialog(open);
          if (!open) loadAccessData();
        }}
        childProfile={child}
        currentProfileId={currentProfileId}
      />

      <ShareProfileDialog
        open={showShareDialog}
        onOpenChange={(open) => {
          setShowShareDialog(open);
          if (!open) loadAccessData();
        }}
        childProfile={child}
        currentProfileId={currentProfileId}
      />
    </>
  );
}
