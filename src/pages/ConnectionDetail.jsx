import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfile } from '@/contexts/ProfileContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { choresAPI } from '@/api/chores';
import { rewardsAPI } from '@/api/rewards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, TrendingUp, Award, CheckCircle, Clock, Settings } from 'lucide-react';
import { LevelTransitionDialog } from '@/components/children/LevelTransitionDialog';
import { ChoresTab } from '@/components/children/ChoresTab';
import { RewardsTab } from '@/components/children/RewardsTab';
import { ActivityTab } from '@/components/children/ActivityTab';
import { SettingsTab } from '@/components/children/SettingsTab';
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

export default function ConnectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const [child, setChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLevelTransition, setShowLevelTransition] = useState(false);
  const [stats, setStats] = useState({
    completedChores: 0,
    pendingChores: 0,
    totalRedemptions: 0,
    achievementsEarned: 0,
  });

  useEffect(() => {
    if (id) {
      loadChildData();
    }
  }, [id]);

  const loadChildData = async () => {
    try {
      setLoading(true);
      const childData = await childProfilesAPI.getChildProfileById(id);
      setChild(childData);

      const chores = await choresAPI.getChoresByChild(id);
      const redemptions = await rewardsAPI.getRedemptions(id);
      const achievements = await childProfilesAPI.getChildAchievements(id);

      setStats({
        completedChores: chores.filter(c => c.status === 'approved').length,
        pendingChores: chores.filter(c => c.status === 'completed').length,
        totalRedemptions: redemptions.length,
        achievementsEarned: achievements.length,
      });
    } catch (error) {
      console.error('Error loading child data:', error);
      toast.error('Failed to load child data');
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = async () => {
    setShowLevelTransition(false);
    await loadChildData();
    toast.success('Permission tier updated successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading child data...</p>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Child not found</p>
        <Button onClick={() => navigate('/Connections')} className="mt-4">
          Back to Connections
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/Connections')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={child.avatar_url} />
              <AvatarFallback className="text-xl">
                {child.child_name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold mb-2">{child.child_name}</h1>
              <div className="flex items-center gap-3">
                <Badge className={TIER_COLORS[child.current_permission_level]}>
                  Tier {child.current_permission_level}: {TIER_NAMES[child.current_permission_level]}
                </Badge>
                {child.date_of_birth && (
                  <span className="text-sm text-slate-600">
                    Age {Math.floor((new Date() - new Date(child.date_of_birth)) / 31557600000)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowLevelTransition(true)}>
          Manage Tier
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2">Points Balance</p>
                <p className="text-3xl font-bold">{child.points_balance.toLocaleString()}</p>
              </div>
              <Award className="h-10 w-10 text-slate-300" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2">Cash Balance</p>
                <p className="text-3xl font-bold">${parseFloat(child.cash_balance).toFixed(2)}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-slate-300" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2">Completed Chores</p>
                <p className="text-3xl font-bold">{stats.completedChores}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-slate-300" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-2">Pending Approval</p>
                <p className="text-3xl font-bold">{stats.pendingChores}</p>
              </div>
              <Clock className="h-10 w-10 text-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="chores" className="flex-1 flex flex-col">
        <TabsList className="mb-4">
          <TabsTrigger value="chores">Chores</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="chores" className="flex-1 mt-0">
          <ChoresTab childId={child.id} onUpdate={loadChildData} />
        </TabsContent>

        <TabsContent value="rewards" className="flex-1 mt-0">
          <RewardsTab childId={child.id} child={child} onUpdate={loadChildData} />
        </TabsContent>

        <TabsContent value="activity" className="flex-1 mt-0">
          <ActivityTab childId={child.id} />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 mt-0">
          <SettingsTab child={child} onUpdate={loadChildData} currentProfileId={activeProfile?.id} />
        </TabsContent>
      </Tabs>

      <LevelTransitionDialog
        open={showLevelTransition}
        onOpenChange={setShowLevelTransition}
        child={child}
        onLevelChanged={handleTierChange}
      />
    </div>
  );
}
