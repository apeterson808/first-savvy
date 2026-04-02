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
import { LevelTransitionDialog } from './LevelTransitionDialog';
import AvatarSelector from './AvatarSelector';
import { toast } from 'sonner';

const TIER_COLORS = {
  1: 'bg-slate-100 text-slate-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-green-100 text-green-800',
};

const TIER_NAMES = {
  1: 'Basic Access',
  2: 'Rewards',
  3: 'Money',
};

const PERMISSION_LEVELS = {
  view_only: 'View Only',
  editor: 'Editor',
  co_parent: 'Co-Parent'
};

export function ProfileHeaderCard({ child, currentProfileId, onUpdate }) {
  const [formData, setFormData] = useState({
    child_name: '',
    date_of_birth: '',
    gender: '',
    daily_spending_limit: '',
    weekly_spending_limit: '',
    monthly_spending_limit: '',
    notes: '',
  });
  const [avatar, setAvatar] = useState(null);
  const [shares, setShares] = useState([]);
  const [invitation, setInvitation] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showTierDialog, setShowTierDialog] = useState(false);

  useEffect(() => {
    loadAccessData();
    if (child) {
      setFormData({
        child_name: child.child_name,
        date_of_birth: child.date_of_birth || '',
        gender: child.gender || '',
        daily_spending_limit: child.daily_spending_limit || '',
        weekly_spending_limit: child.weekly_spending_limit || '',
        monthly_spending_limit: child.monthly_spending_limit || '',
        notes: child.notes || '',
      });
    }
  }, [child]);

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

  const handleFieldUpdate = async (field, value) => {
    try {
      const updates = { [field]: value || null };

      if (field.includes('limit') && value) {
        updates[field] = parseFloat(value);
      }

      await childProfilesAPI.updateChildProfile(child.id, updates);
      toast.success('Updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Failed to update');
    }
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
                    firstName={formData.child_name.split(' ')[0]}
                    lastName={formData.child_name.split(' ')[1] || ''}
                    currentAvatar={child.avatar_url}
                    compact={true}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="space-y-2">
                    <Label htmlFor="child_name" className="text-xs text-slate-600">Name</Label>
                    <Input
                      id="child_name"
                      value={formData.child_name}
                      onChange={(e) => setFormData({ ...formData, child_name: e.target.value })}
                      onBlur={(e) => handleFieldUpdate('child_name', e.target.value)}
                      className="text-xl font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  className={`${TIER_COLORS[child.current_permission_level]} cursor-pointer hover:opacity-80`}
                  onClick={() => setShowTierDialog(true)}
                >
                  Tier {child.current_permission_level}: {TIER_NAMES[child.current_permission_level]}
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
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth" className="text-xs text-slate-600">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      onBlur={(e) => handleFieldUpdate('date_of_birth', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender" className="text-xs text-slate-600">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => {
                        setFormData({ ...formData, gender: value });
                        handleFieldUpdate('gender', value);
                      }}
                    >
                      <SelectTrigger id="gender">
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

                {child.current_permission_level === 3 && (
                  <div className="space-y-3">
                    <Label className="text-xs text-slate-600">Spending Limits (Tier 3)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="daily_spending_limit" className="text-[10px] text-slate-500">Daily</Label>
                        <Input
                          id="daily_spending_limit"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.daily_spending_limit}
                          onChange={(e) => setFormData({ ...formData, daily_spending_limit: e.target.value })}
                          onBlur={(e) => handleFieldUpdate('daily_spending_limit', e.target.value)}
                          placeholder="$0.00"
                          className="text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="weekly_spending_limit" className="text-[10px] text-slate-500">Weekly</Label>
                        <Input
                          id="weekly_spending_limit"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.weekly_spending_limit}
                          onChange={(e) => setFormData({ ...formData, weekly_spending_limit: e.target.value })}
                          onBlur={(e) => handleFieldUpdate('weekly_spending_limit', e.target.value)}
                          placeholder="$0.00"
                          className="text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="monthly_spending_limit" className="text-[10px] text-slate-500">Monthly</Label>
                        <Input
                          id="monthly_spending_limit"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.monthly_spending_limit}
                          onChange={(e) => setFormData({ ...formData, monthly_spending_limit: e.target.value })}
                          onBlur={(e) => handleFieldUpdate('monthly_spending_limit', e.target.value)}
                          placeholder="$0.00"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
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

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs text-slate-600">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  onBlur={(e) => handleFieldUpdate('notes', e.target.value)}
                  rows={3}
                  placeholder="Add notes about this child profile..."
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-4 mt-4 text-xs text-slate-500 border-t">
            <Crown className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>You have full access as the profile owner</span>
          </div>
        </CardContent>
      </Card>

      <LevelTransitionDialog
        open={showTierDialog}
        onOpenChange={setShowTierDialog}
        child={child}
        onLevelChanged={() => {
          onUpdate();
          setShowTierDialog(false);
        }}
      />

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
