import { useState, useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { choresAPI } from '@/api/chores';
import { rewardsAPI } from '@/api/rewards';
import { profileInvitationsAPI } from '@/api/profileInvitations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Users, TrendingUp, Award, Clock, CheckCircle, Mail, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AddChildSheet } from '@/components/children/AddChildSheet';
import { toast } from 'sonner';

const LEVEL_COLORS = {
  1: 'bg-slate-100 text-slate-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-green-100 text-green-800',
  4: 'bg-purple-100 text-purple-800',
  5: 'bg-amber-100 text-amber-800',
};

const LEVEL_NAMES = {
  1: 'Supervised',
  2: 'Monitored',
  3: 'Semi-Independent',
  4: 'Independent',
  5: 'Full Control',
};

export default function Children() {
  const { selectedProfile, switchProfile, availableChildProfiles } = useProfile();
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [invitations, setInvitations] = useState({});
  const [stats, setStats] = useState({
    totalChildren: 0,
    totalPoints: 0,
    pendingApprovals: 0,
    activeChores: 0,
  });

  useEffect(() => {
    if (selectedProfile?.id) {
      loadChildren();
    }
  }, [selectedProfile]);

  const handleOpenProfile = async (e, child) => {
    e.stopPropagation();
    const childProfile = availableChildProfiles.find(p => p.child_profile_id === child.id);
    if (childProfile) {
      await switchProfile(childProfile);
      navigate('/Dashboard');
      toast.success(`Opened ${child.child_name}'s profile`);
    } else {
      toast.error('Unable to open profile');
    }
  };

  const loadChildren = async () => {
    try {
      setLoading(true);
      const childProfiles = await childProfilesAPI.getChildProfiles(selectedProfile.id);
      setChildren(childProfiles);

      let totalPoints = 0;
      let pendingApprovals = 0;
      let activeChores = 0;

      const invitationsMap = {};

      if (childProfiles.length > 0) {
        const choresPromises = childProfiles.map(child =>
          choresAPI.getChoresByChild(child.id).catch(() => [])
        );

        const invitationPromises = childProfiles.map(child =>
          profileInvitationsAPI.getActiveInvitation(child.id).catch(() => null)
        );

        const [choresResults, invitationResults] = await Promise.all([
          Promise.all(choresPromises),
          Promise.all(invitationPromises)
        ]);

        childProfiles.forEach((child, index) => {
          totalPoints += child.points_balance;
          const chores = choresResults[index] || [];
          const pendingChores = chores.filter(c => c.status === 'completed').length;
          const activeChoresCount = chores.filter(c => c.status === 'pending' || c.status === 'in_progress').length;

          pendingApprovals += pendingChores;
          activeChores += activeChoresCount;

          const invitation = invitationResults[index];
          if (invitation) {
            invitationsMap[child.id] = invitation;
          }
        });
      }

      setInvitations(invitationsMap);

      setStats({
        totalChildren: childProfiles.length,
        totalPoints,
        pendingApprovals,
        activeChores,
      });
    } catch (error) {
      console.error('Error loading children:', error);
      toast.error('Failed to load children');
    } finally {
      setLoading(false);
    }
  };

  const handleChildAdded = () => {
    setShowAddChild(false);
    loadChildren();
    toast.success('Child profile created successfully');
  };

  const getReadinessScore = (child) => {
    if (child.current_permission_level === 5) return 100;

    let score = 50;

    if (child.points_balance > 500) score += 10;
    if (child.cash_balance > 100) score += 10;

    const daysAtLevel = Math.floor((new Date() - new Date(child.updated_at)) / (1000 * 60 * 60 * 24));
    if (daysAtLevel > 30) score += 15;
    if (daysAtLevel > 90) score += 15;

    return Math.min(100, score);
  };

  const getReadinessColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-slate-600';
  };

  const getInvitationStatusBadge = (child) => {
    if (child.user_id) {
      return (
        <Badge className="bg-green-100 text-green-800 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }

    const invitation = invitations[child.id];
    if (!invitation) {
      return null;
    }

    if (invitation.status === 'pending') {
      const isExpired = new Date(invitation.invitation_expires_at) < new Date();
      if (isExpired) {
        return (
          <Badge className="bg-red-100 text-red-800 text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      }
      return (
        <Badge className="bg-amber-100 text-amber-800 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading children...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Children</h1>
          <p className="text-slate-600 mt-1">Manage your children's financial learning journey</p>
        </div>
        <Button onClick={() => setShowAddChild(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Child
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Children</p>
                <p className="text-2xl font-bold mt-1">{stats.totalChildren}</p>
              </div>
              <Users className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Points</p>
                <p className="text-2xl font-bold mt-1">{stats.totalPoints.toLocaleString()}</p>
              </div>
              <Award className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Pending Approvals</p>
                <p className="text-2xl font-bold mt-1">{stats.pendingApprovals}</p>
              </div>
              <Clock className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active Chores</p>
                <p className="text-2xl font-bold mt-1">{stats.activeChores}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-semibold">No children yet</h3>
              <p className="mt-2 text-slate-600">
                Create your first child profile to start teaching financial responsibility
              </p>
              <Button onClick={() => setShowAddChild(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Child
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map((child) => {
            const readinessScore = getReadinessScore(child);
            return (
              <Card
                key={child.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/Children/${child.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={child.avatar_url} />
                        <AvatarFallback>
                          {child.child_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{child.child_name}</CardTitle>
                        {child.date_of_birth && (
                          <p className="text-sm text-slate-600">
                            Age {Math.floor((new Date() - new Date(child.date_of_birth)) / 31557600000)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={LEVEL_COLORS[child.current_permission_level]}>
                        Level {child.current_permission_level}
                      </Badge>
                      {getInvitationStatusBadge(child)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">Permission Level</span>
                        <span className="font-medium">{LEVEL_NAMES[child.current_permission_level]}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Points</p>
                        <p className="text-xl font-bold">{child.points_balance.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Cash</p>
                        <p className="text-xl font-bold">${parseFloat(child.cash_balance).toFixed(2)}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-slate-600">Readiness for Next Level</span>
                        <span className={`font-medium ${getReadinessColor(readinessScore)}`}>
                          {readinessScore}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            readinessScore >= 80 ? 'bg-green-500' :
                            readinessScore >= 50 ? 'bg-amber-500' :
                            'bg-slate-400'
                          }`}
                          style={{ width: `${readinessScore}%` }}
                        />
                      </div>
                    </div>

                    {child.notes && (
                      <p className="text-sm text-slate-600 line-clamp-2">{child.notes}</p>
                    )}

                    <div className="pt-4 border-t">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={(e) => handleOpenProfile(e, child)}
                      >
                        Open Profile
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddChildSheet
        open={showAddChild}
        onOpenChange={setShowAddChild}
        onChildAdded={handleChildAdded}
        profileId={selectedProfile?.id}
      />
    </div>
  );
}
