import React, { useState, useEffect } from 'react';
import { Star, Sparkles, Trophy, LogOut, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { tasksAPI } from '@/api/tasks';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import { motion, AnimatePresence } from 'framer-motion';
import ChildAvatar from './ChildAvatar';
import { TaskCard } from './TaskCard';
import { RewardCard } from './RewardCard';
import { TaskDialog } from './TaskDialog';
import { RewardDialog } from './RewardDialog';
import { toast } from 'sonner';

export function BeginnerProfileView({ childProfile, isParentViewing = false }) {
  const [starBalance, setStarBalance] = useState(0);
  const [starsPending, setStarsPending] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celebrationStars, setCelebrationStars] = useState(0);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);
  const { exitChildView, currentProfile } = useProfile();

  useEffect(() => {
    if (childProfile?.id) {
      loadData();
    }
  }, [childProfile?.id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [balanceData, tasksData, rewardsData, completionsData] = await Promise.all([
        taskCompletionsAPI.getChildStarBalance(childProfile.id),
        tasksAPI.getTasksByChild(childProfile.id),
        firstsavvy
          .from('rewards')
          .select('*')
          .or(`assigned_to_child_id.eq.${childProfile.id},assigned_to_child_id.is.null`)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        taskCompletionsAPI.getCompletions(childProfile.id),
      ]);

      setStarBalance(balanceData.stars_balance || 0);
      setStarsPending(balanceData.stars_pending || 0);
      setTasks(tasksData || []);
      setRewards(rewardsData.data || []);
      setCompletions(completionsData || []);
    } catch (error) {
      console.error('Error loading beginner profile data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskComplete = async (taskId, notes) => {
    try {
      await taskCompletionsAPI.submitCompletion(taskId, childProfile.id, notes);
      toast.success('Task submitted! Waiting for approval');
      await loadData();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to submit task');
    }
  };

  const handleApproveCompletion = async (completionId, notes) => {
    try {
      const result = await taskCompletionsAPI.approveCompletion(completionId, notes);
      const starsEarned = result.stars_balance - starBalance;

      setCelebrationStars(starsEarned);
      setTimeout(() => setCelebrationStars(0), 3000);

      toast.success(`Approved! +${starsEarned} stars earned`);
      await loadData();
    } catch (error) {
      console.error('Error approving completion:', error);
      toast.error('Failed to approve task');
    }
  };

  const handleRejectCompletion = async (completionId, notes) => {
    try {
      await taskCompletionsAPI.rejectCompletion(completionId, notes);
      toast.info('Task completion rejected');
      await loadData();
    } catch (error) {
      console.error('Error rejecting completion:', error);
      toast.error('Failed to reject task');
    }
  };

  const handleRedeemReward = async (rewardId) => {
    try {
      const result = await taskCompletionsAPI.redeemReward(rewardId, childProfile.id);
      toast.success(`Redeemed: ${result.reward_title}!`, {
        description: `Spent ${result.stars_spent} stars`,
      });
      await loadData();
    } catch (error) {
      console.error('Error redeeming reward:', error);
      toast.error(error.message || 'Failed to redeem reward');
    }
  };

  const handleLogout = async () => {
    await firstsavvy.auth.signOut();
    window.location.href = '/login';
  };

  const availableTasks = tasks.filter(t => t.status === 'in_progress');
  const pendingTasks = completions.filter(c => c.status === 'pending');
  const availableRewards = rewards.filter(r => r.status === 'available');
  const redeemedRewards = rewards.filter(r => r.status === 'redeemed');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Sparkles className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-lg text-slate-600">Loading your adventure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 md:p-8">
      <AnimatePresence>
        {celebrationStars > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1.5, y: -100 }}
            exit={{ opacity: 0, scale: 0, y: -200 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-3 text-6xl font-bold text-yellow-500">
              <Star className="w-20 h-20 fill-yellow-500" />
              <span>+{celebrationStars}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <ChildAvatar child={childProfile} size="lg" />
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                Hi, {childProfile.child_name}!
              </h1>
              <p className="text-lg text-slate-600 mt-1">Ready to earn some stars?</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex items-center gap-4 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 px-8 py-5 rounded-3xl shadow-2xl border-3 border-yellow-300 animate-pulse-subtle">
              <Star className="w-16 h-16 text-amber-500 fill-amber-500 drop-shadow-md" />
              <div>
                <p className="text-sm font-bold text-yellow-100 uppercase tracking-widest drop-shadow-sm">Your Stars</p>
                <p className="text-6xl font-black text-white drop-shadow-lg" style={{ textShadow: '0 3px 15px rgba(0,0,0,0.4)' }}>{starBalance}</p>
              </div>
            </div>
            {!isParentViewing && (
              <Button variant="ghost" size="sm" onClick={handleLogout} className="bg-white/90 hover:bg-white shadow-md">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        </div>

        {starsPending > 0 && (
          <Card className="bg-gradient-to-r from-purple-100 via-blue-100 to-cyan-100 border-2 border-purple-200 shadow-md">
            <CardContent className="py-4 px-6">
              <div className="flex items-center justify-center gap-3">
                <Sparkles className="w-6 h-6 text-purple-600 animate-pulse" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-purple-900">
                    <span className="text-2xl font-black">{starsPending}</span> stars waiting for approval!
                  </p>
                </div>
                <Sparkles className="w-6 h-6 text-purple-600 animate-pulse" />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-xl border-2 border-blue-200">
              <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-3">
                <div className="bg-blue-500 rounded-full p-2">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                Your Tasks
              </h2>
              <div className="flex items-center gap-2">
                {isParentViewing && (
                  <Button size="sm" onClick={() => setIsTaskDialogOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Task
                  </Button>
                )}
                <Badge className="bg-green-500 hover:bg-green-600 text-white text-base px-4 py-1.5 shadow-md">
                  {availableTasks.length} available
                </Badge>
              </div>
            </div>

            {availableTasks.length === 0 && pendingTasks.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-slate-500">No tasks right now. Check back soon!</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {pendingTasks.map((completion) => (
                  <TaskCard
                    key={completion.id}
                    task={completion.tasks}
                    completion={completion}
                    onComplete={handleTaskComplete}
                    onApprove={handleApproveCompletion}
                    onReject={handleRejectCompletion}
                    isParentViewing={isParentViewing}
                  />
                ))}
                {availableTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleTaskComplete}
                    isParentViewing={isParentViewing}
                  />
                ))}
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border-2 border-purple-200">
              <h2 className="text-2xl font-bold text-purple-900 flex items-center gap-3">
                <div className="bg-purple-500 rounded-full p-2">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                Rewards
              </h2>
              <div className="flex items-center gap-2">
                {isParentViewing && (
                  <Button size="sm" onClick={() => setIsRewardDialogOpen(true)} className="bg-purple-500 hover:bg-purple-600 text-white">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Reward
                  </Button>
                )}
                <Badge className="bg-green-500 hover:bg-green-600 text-white text-base px-4 py-1.5 shadow-md">
                  {availableRewards.length} available
                </Badge>
              </div>
            </div>

            {availableRewards.length === 0 && redeemedRewards.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-slate-500">No rewards yet. Ask your parent to add some!</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {availableRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    starBalance={starBalance}
                    onRedeem={handleRedeemReward}
                    isParentViewing={isParentViewing}
                  />
                ))}
                {redeemedRewards.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">
                      Redeemed Rewards
                    </h3>
                    {redeemedRewards.map((reward) => (
                      <RewardCard
                        key={reward.id}
                        reward={reward}
                        starBalance={starBalance}
                        isRedeemed
                        isParentViewing={isParentViewing}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {isParentViewing && (
        <>
          <TaskDialog
            isOpen={isTaskDialogOpen}
            onClose={() => setIsTaskDialogOpen(false)}
            childId={childProfile.id}
            profileId={childProfile.parent_profile_id}
            onSuccess={loadData}
          />
          <RewardDialog
            isOpen={isRewardDialogOpen}
            onClose={() => setIsRewardDialogOpen(false)}
            profileId={childProfile.parent_profile_id}
            childId={childProfile.id}
            onSuccess={loadData}
          />
        </>
      )}
    </div>
  );
}
