import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { childProfilesAPI } from '@/api/childProfiles';
import { profileSharesAPI } from '@/api/profileShares';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Mail, Crown, X, CheckCircle, Clock, XCircle, Trash2, AlertTriangle } from 'lucide-react';
import { InviteChildDialog } from './InviteChildDialog';
import { ShareProfileDialog } from './ShareProfileDialog';
import AvatarSelector from './AvatarSelector';
import { toast } from 'sonner';

const PERMISSION_LEVELS = {
  view_only: 'View Only',
  editor: 'Editor',
  co_parent: 'Co-Parent'
};

export function SettingsTab({ child, onUpdate, currentProfileId }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    child_name: child.child_name,
    date_of_birth: child.date_of_birth || '',
    daily_spending_limit: child.daily_spending_limit || '',
    weekly_spending_limit: child.weekly_spending_limit || '',
    monthly_spending_limit: child.monthly_spending_limit || '',
    notes: child.notes || '',
  });
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState([]);
  const [invitation, setInvitation] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccessData();
  }, [child.id]);

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

  const handleRevokeShare = async (shareId) => {
    try {
      await profileSharesAPI.revokeShare(shareId);
      toast.success('Access revoked');
      await loadAccessData();
    } catch (error) {
      console.error('Error revoking share:', error);
      toast.error('Failed to revoke access');
    }
  };

  const getInvitationStatusBadge = () => {
    if (child.user_id) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Account Active
        </Badge>
      );
    }

    if (!invitation) {
      return (
        <Badge variant="secondary">
          <Mail className="h-3 w-3 mr-1" />
          Not Invited
        </Badge>
      );
    }

    if (invitation.status === 'pending') {
      const isExpired = new Date(invitation.invitation_expires_at) < new Date();
      if (isExpired) {
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Invitation Expired
          </Badge>
        );
      }
      return (
        <Badge className="bg-amber-100 text-amber-800">
          <Clock className="h-3 w-3 mr-1" />
          Invitation Pending
        </Badge>
      );
    }

    return null;
  };

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
      toast.success('Settings updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Error updating child:', error);
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await childProfilesAPI.deleteChildProfile(child.id);
      toast.success('Profile deleted successfully');
      navigate('/Connections');
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast.error('Failed to delete profile');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Additional Settings</CardTitle>
          <CardDescription>
            Advanced configuration options for this profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600">
            Profile settings can be edited using the Edit button in the profile header above.
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-red-700">
            Permanently delete this child profile. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-red-300 bg-red-100">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Deleting this profile will remove all associated data including chores, rewards, achievements, and financial history. This action is permanent and cannot be reversed.
            </AlertDescription>
          </Alert>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Profile
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{child.child_name}'s</strong> profile and all associated data.
              This action cannot be undone and all data will be lost forever.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Profile'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </div>
  );
}
