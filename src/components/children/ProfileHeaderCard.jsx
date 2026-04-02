import { useState, useEffect } from 'react';
import { profileSharesAPI } from '@/api/profileShares';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Edit, Users, Mail, CheckCircle, Clock, XCircle, Crown } from 'lucide-react';
import { InviteChildDialog } from './InviteChildDialog';
import { ShareProfileDialog } from './ShareProfileDialog';
import { EditChildProfileDialog } from './EditChildProfileDialog';

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
  const [shares, setShares] = useState([]);
  const [invitation, setInvitation] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

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

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={child.avatar_url} />
                <AvatarFallback className="text-xl">
                  {child.child_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold mb-2">{child.child_name}</h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className={TIER_COLORS[child.current_permission_level]}>
                    Tier {child.current_permission_level}: {TIER_NAMES[child.current_permission_level]}
                  </Badge>
                  {child.date_of_birth && (
                    <span className="text-sm text-slate-600">
                      Age {Math.floor((new Date() - new Date(child.date_of_birth)) / 31557600000)}
                    </span>
                  )}
                  {getInvitationStatusBadge()}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Access Management
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Child Account</span>
                    {getInvitationStatusBadge()}
                  </div>
                  {!child.user_id && (
                    <Button
                      onClick={() => setShowInviteDialog(true)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Mail className="h-3 w-3 mr-2" />
                      {invitation ? 'Resend Invitation' : 'Send Invitation'}
                    </Button>
                  )}
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">
                      Shared Access ({shares.length}/3)
                    </span>
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
                  {shares.length > 0 && (
                    <div className="space-y-1.5">
                      {shares.map((share) => (
                        <div
                          key={share.id}
                          className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded"
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={share.shared_with_profile?.avatar_url} />
                            <AvatarFallback className="text-[10px]">
                              {share.shared_with_profile?.profile_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 font-medium">
                            {share.shared_with_profile?.profile_name}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {PERMISSION_LEVELS[share.permission_level]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Additional Information</h3>
              <div className="space-y-2 text-sm">
                {child.notes && (
                  <div>
                    <span className="text-slate-600">Notes: </span>
                    <span className="text-slate-900">{child.notes}</span>
                  </div>
                )}
                {(child.daily_spending_limit || child.weekly_spending_limit || child.monthly_spending_limit) && (
                  <div>
                    <span className="text-slate-600 block mb-1">Spending Limits:</span>
                    <div className="space-y-0.5 text-xs pl-2">
                      {child.daily_spending_limit && (
                        <div>Daily: ${parseFloat(child.daily_spending_limit).toFixed(2)}</div>
                      )}
                      {child.weekly_spending_limit && (
                        <div>Weekly: ${parseFloat(child.weekly_spending_limit).toFixed(2)}</div>
                      )}
                      {child.monthly_spending_limit && (
                        <div>Monthly: ${parseFloat(child.monthly_spending_limit).toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 pt-2 text-xs text-slate-500">
                  <Crown className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>
                    You have full access as the profile owner
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditChildProfileDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        child={child}
        currentProfileId={currentProfileId}
        onUpdate={() => {
          onUpdate();
          loadAccessData();
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
