import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/contexts/ProfileContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Mail, Clock, CheckCircle, Users, RefreshCw, Trash2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

const ADULT_FAMILY_ROLES = ['spouse_partner', 'parent', 'sibling', 'grandparent', 'other'];

const ROLE_LABELS = {
  spouse_partner: 'Spouse / Partner',
  parent: 'Parent',
  sibling: 'Sibling',
  grandparent: 'Grandparent',
  other: 'Family Member',
};

const AVATAR_COLORS = [
  { id: 'slate', bg: 'bg-slate-500', text: 'text-white' },
];

export function AdultFamilyMemberView({ child, onUpdate, onDelete }) {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const { data: invitation, refetch: refetchInvitation } = useQuery({
    queryKey: ['invitation', child.id],
    queryFn: () => profileInvitationsAPI.getActiveInvitation(child.id),
    enabled: !!child.id,
  });

  const getInitials = () => {
    if (child.first_name && child.last_name && child.first_name !== 'Invited') {
      return `${child.first_name[0]}${child.last_name[0]}`.toUpperCase();
    }
    const email = child.email || child.child_name || '';
    return email.slice(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    if (child.first_name && child.first_name !== 'Invited' && child.last_name) {
      return `${child.first_name} ${child.last_name}`;
    }
    return child.email || child.child_name || 'Family Member';
  };

  const roleLabel = ROLE_LABELS[child.family_role] || 'Family Member';
  const isPending = !child.user_id;
  const inviteEmail = child.email || child.child_name;

  const handleResendInvitation = async () => {
    if (!invitation) return;
    try {
      setResending(true);
      await profileInvitationsAPI.resendInvitation(invitation.id, activeProfile?.id);
      await refetchInvitation();
      toast.success('Invitation resent successfully');
    } catch (error) {
      toast.error('Failed to resend invitation');
    } finally {
      setResending(false);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!invitation) return;
    try {
      setRevoking(true);
      await profileInvitationsAPI.revokeInvitation(invitation.id);
      await refetchInvitation();
      toast.success('Invitation revoked');
    } catch (error) {
      toast.error('Failed to revoke invitation');
    } finally {
      setRevoking(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await childProfilesAPI.deleteChildProfile(child.id);
      toast.success('Profile removed');
      navigate('/Contacts');
    } catch (error) {
      toast.error('Failed to remove profile');
      setDeleting(false);
    }
  };

  return (
    <div className="h-full flex flex-col pb-6 p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/Contacts')}
          className="gap-2 text-slate-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="h-20 w-20 rounded-full bg-slate-500 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-bold text-white">{getInitials()}</span>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold text-slate-900">{getDisplayName()}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-teal-100 text-teal-700 border-0 font-normal">{roleLabel}</Badge>
            {isPending ? (
              <Badge className="bg-amber-100 text-amber-700 border-0 font-normal gap-1">
                <Clock className="w-3 h-3" />
                Invitation Pending
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 border-0 font-normal gap-1">
                <CheckCircle className="w-3 h-3" />
                Connected
              </Badge>
            )}
          </div>
        </div>
      </div>

      {isPending && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <Mail className="w-4 h-4" />
              Invitation Sent
            </CardTitle>
            <CardDescription className="text-amber-700">
              An invitation was sent to <strong>{inviteEmail}</strong>. Once they accept and create their account, your profiles will be linked with full shared access.
            </CardDescription>
          </CardHeader>
          {invitation && (
            <CardContent className="pt-0 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={handleResendInvitation}
                disabled={resending}
              >
                <RefreshCw className={cn('w-3 h-3 mr-1.5', resending && 'animate-spin')} />
                {resending ? 'Resending...' : 'Resend Invitation'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-500 hover:text-red-600"
                onClick={handleRevokeInvitation}
                disabled={revoking}
              >
                {revoking ? 'Revoking...' : 'Revoke'}
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {!isPending && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-800">
              <UserCheck className="w-4 h-4" />
              Shared Access Active
            </CardTitle>
            <CardDescription className="text-green-700">
              {getDisplayName()} has accepted the invitation and is connected to your account with full shared access.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            About Shared Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
            <span>Once accepted, both of you can view and manage the same financial data.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
            <span>Accounts, budgets, and transactions are fully visible to both parties.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
            <span>Each person maintains their own login and profile.</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-auto pt-4 border-t border-slate-200">
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Remove {roleLabel}
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this family member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{getDisplayName()}</strong> from your family connections. Any pending invitation will also be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
