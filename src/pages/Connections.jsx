import { useState, useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { profileSharesAPI } from '@/api/profileShares';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Search, Crown, UserCheck, Mail, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InviteChildDialog } from '@/components/children/InviteChildDialog';
import { ShareProfileDialog } from '@/components/children/ShareProfileDialog';
import { toast } from 'sonner';

const LEVEL_NAMES = {
  1: 'Supervised',
  2: 'Monitored',
  3: 'Semi-Independent',
  4: 'Independent',
  5: 'Full Control',
};

export default function Connections() {
  const { activeProfile } = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ownedProfiles, setOwnedProfiles] = useState([]);
  const [sharedProfiles, setSharedProfiles] = useState([]);
  const [invitations, setInvitations] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChild, setSelectedChild] = useState(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    if (activeProfile?.id) {
      loadConnections();
    }
  }, [activeProfile]);

  const loadConnections = async () => {
    try {
      setLoading(true);

      const [owned, shared] = await Promise.all([
        childProfilesAPI.getOwnedChildProfiles(activeProfile.id),
        childProfilesAPI.getSharedChildProfiles(activeProfile.id)
      ]);

      setOwnedProfiles(owned || []);
      setSharedProfiles(shared || []);

      const allProfiles = [...(owned || []), ...(shared || [])];
      const invitationsMap = {};

      await Promise.all(
        allProfiles.map(async (profile) => {
          try {
            const invitation = await profileInvitationsAPI.getActiveInvitation(profile.id);
            if (invitation) {
              invitationsMap[profile.id] = invitation;
            }
          } catch (error) {
            console.error(`Error loading invitation for ${profile.id}:`, error);
          }
        })
      );

      setInvitations(invitationsMap);
    } catch (error) {
      console.error('Error loading connections:', error);
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteChild = (child) => {
    setSelectedChild(child);
    setShowInviteDialog(true);
  };

  const handleShareProfile = (child) => {
    setSelectedChild(child);
    setShowShareDialog(true);
  };

  const handleResendInvite = async (child) => {
    try {
      const invitation = invitations[child.id];
      if (invitation) {
        await profileInvitationsAPI.resendInvitation(invitation.id, activeProfile.id);
        toast.success('Invitation resent');
        await loadConnections();
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast.error('Failed to resend invitation');
    }
  };

  const getInvitationStatusBadge = (profile) => {
    if (profile.user_id) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active Account
        </Badge>
      );
    }

    const invitation = invitations[profile.id];
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
            Expired
          </Badge>
        );
      }
      return (
        <Badge className="bg-amber-100 text-amber-800">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }

    return null;
  };

  const filterProfiles = (profiles) => {
    if (!searchQuery) return profiles;
    return profiles.filter(profile =>
      profile.child_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const ProfileCard = ({ profile, isOwned }) => {
    const invitation = invitations[profile.id];
    const canInvite = !profile.user_id && (!invitation || invitation.status !== 'pending');
    const canResend = invitation && invitation.status === 'pending' &&
                      new Date(invitation.invitation_expires_at) < new Date();

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback>
                  {profile.child_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{profile.child_name}</CardTitle>
                  {isOwned && (
                    <Crown className="h-4 w-4 text-amber-500" title="You own this profile" />
                  )}
                </div>
                {profile.date_of_birth && (
                  <p className="text-sm text-slate-600">
                    Age {Math.floor((new Date() - new Date(profile.date_of_birth)) / 31557600000)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline">
                Level {profile.current_permission_level}
              </Badge>
              {getInvitationStatusBadge(profile)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-1">Permission Level</p>
              <p className="font-medium">{LEVEL_NAMES[profile.current_permission_level]}</p>
            </div>

            {!isOwned && profile.share_permission_level && (
              <div>
                <p className="text-sm text-slate-600 mb-1">Your Access Level</p>
                <Badge variant="secondary">
                  {profile.share_permission_level.replace('_', ' ')}
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600">Points</p>
                <p className="text-lg font-bold">{profile.points_balance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Cash</p>
                <p className="text-lg font-bold">${parseFloat(profile.cash_balance).toFixed(2)}</p>
              </div>
            </div>

            {invitation && invitation.status === 'pending' && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                Invitation sent to {invitation.invited_email} on{' '}
                {new Date(invitation.created_at).toLocaleDateString()}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/Children/${profile.id}`)}
              >
                View Profile
              </Button>
              {isOwned && canInvite && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleInviteChild(profile)}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Invite
                </Button>
              )}
              {isOwned && canResend && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleResendInvite(profile)}
                >
                  Resend
                </Button>
              )}
              {isOwned && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShareProfile(profile)}
                >
                  <Users className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading connections...</p>
        </div>
      </div>
    );
  }

  const filteredOwned = filterProfiles(ownedProfiles);
  const filteredShared = filterProfiles(sharedProfiles);
  const totalConnections = ownedProfiles.length + sharedProfiles.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Connections</h1>
          <p className="text-slate-600 mt-1">
            Manage child profiles and access relationships
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 mb-1">Total Connections</p>
                <p className="text-3xl font-bold text-slate-900">{totalConnections}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 mb-1">Profiles You Own</p>
                <p className="text-3xl font-bold text-amber-900">{ownedProfiles.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-1">Shared With You</p>
                <p className="text-3xl font-bold text-blue-900">{sharedProfiles.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search profiles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="owned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="owned">
            Profiles You Own ({ownedProfiles.length})
          </TabsTrigger>
          <TabsTrigger value="shared">
            Shared With You ({sharedProfiles.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Connections ({totalConnections})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owned" className="space-y-4">
          {filteredOwned.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Crown className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-4 text-lg font-semibold">No owned profiles</h3>
                  <p className="mt-2 text-slate-600">
                    {searchQuery
                      ? 'No profiles match your search'
                      : 'Create child profiles from the Children page'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOwned.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} isOwned={true} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shared" className="space-y-4">
          {filteredShared.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <UserCheck className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-4 text-lg font-semibold">No shared profiles</h3>
                  <p className="mt-2 text-slate-600">
                    {searchQuery
                      ? 'No profiles match your search'
                      : 'Other parents can share their children\'s profiles with you'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShared.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} isOwned={false} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {filteredOwned.length === 0 && filteredShared.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-4 text-lg font-semibold">No connections</h3>
                  <p className="mt-2 text-slate-600">
                    {searchQuery
                      ? 'No profiles match your search'
                      : 'Create child profiles to get started'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {filteredOwned.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    Profiles You Own
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredOwned.map((profile) => (
                      <ProfileCard key={profile.id} profile={profile} isOwned={true} />
                    ))}
                  </div>
                </div>
              )}

              {filteredShared.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-blue-500" />
                    Shared With You
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredShared.map((profile) => (
                      <ProfileCard key={profile.id} profile={profile} isOwned={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedChild && (
        <>
          <InviteChildDialog
            open={showInviteDialog}
            onOpenChange={(open) => {
              setShowInviteDialog(open);
              if (!open) {
                setSelectedChild(null);
                loadConnections();
              }
            }}
            childProfile={selectedChild}
            currentProfileId={activeProfile?.id}
          />

          <ShareProfileDialog
            open={showShareDialog}
            onOpenChange={(open) => {
              setShowShareDialog(open);
              if (!open) {
                setSelectedChild(null);
                loadConnections();
              }
            }}
            childProfile={selectedChild}
            currentProfileId={activeProfile?.id}
          />
        </>
      )}
    </div>
  );
}
