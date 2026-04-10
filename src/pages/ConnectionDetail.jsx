import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfile } from '@/contexts/ProfileContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { tasksAPI } from '@/api/tasks';
import { rewardsAPI } from '@/api/rewards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/PageTabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, TrendingUp, Award, CheckCircle, Clock } from 'lucide-react';
import { SimpleProfileHeader } from '@/components/children/SimpleProfileHeader';
import { TasksTab } from '@/components/children/TasksTab';
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
  const { activeProfile, refreshProfiles } = useProfile();
  const [child, setChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || 'tasks';
  });
  const [stats, setStats] = useState({
    completedTasks: 0,
    pendingTasks: 0,
    totalRedemptions: 0,
    achievementsEarned: 0,
  });

  useEffect(() => {
    if (id) {
      loadChildData();
    }
  }, [id]);

  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const newTab = urlParams.get('tab') || 'tasks';
      setActiveTab(newTab);
    };

    window.addEventListener('popstate', handlePopState);

    const interval = setInterval(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const currentTab = urlParams.get('tab') || 'tasks';
      if (currentTab !== activeTab) {
        setActiveTab(currentTab);
      }
    }, 100);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, [activeTab]);

  const loadChildData = async () => {
    try {
      setLoading(true);
      const childData = await childProfilesAPI.getChildProfileById(id);
      setChild(childData);

      const tasks = await tasksAPI.getTasksByChild(id);
      const redemptions = await rewardsAPI.getRedemptions(id);
      const achievements = await childProfilesAPI.getChildAchievements(id);

      setStats({
        completedTasks: tasks.filter(c => c.status === 'approved').length,
        pendingTasks: tasks.filter(c => c.status === 'completed').length,
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

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await childProfilesAPI.deleteChildProfile(child.id);
      await refreshProfiles();
      toast.success('Profile deleted successfully');
      navigate('/Contacts');
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast.error('Failed to delete profile');
      setDeleting(false);
    }
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
        <Button onClick={() => navigate('/Contacts')} className="mt-4">
          Back to Contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pb-6 p-4 md:p-6">
      <SimpleProfileHeader child={child} />

      <PageTabs tabs={['tasks', 'rewards', 'activity', 'settings']} defaultTab="tasks" />

      <Tabs value={activeTab} className="flex-1 flex flex-col">
        <TabsContent value="tasks" className="flex-1 mt-0 pb-6">
          <TasksTab childId={child.id} profileId={child.parent_profile_id} onUpdate={loadChildData} />
        </TabsContent>

        <TabsContent value="rewards" className="flex-1 mt-0 pb-6">
          <RewardsTab childId={child.id} child={child} profileId={child.parent_profile_id} onUpdate={loadChildData} />
        </TabsContent>

        <TabsContent value="activity" className="flex-1 mt-0 pb-6">
          <ActivityTab childId={child.id} />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 mt-0 pb-6">
          <SettingsTab
            child={child}
            currentProfileId={activeProfile?.id}
            onUpdate={loadChildData}
            onDelete={() => setShowDeleteDialog(true)}
          />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
