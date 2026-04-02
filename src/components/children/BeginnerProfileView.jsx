import React, { useState, useEffect } from 'react';
import { Star, Sparkles, Trophy, LogOut } from 'lucide-react';
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
import { toast } from 'sonner';

export function BeginnerProfileView({ childProfile, isParentViewing = false }) {
  const [starBalance, setStarBalance] = useState(0);
  const [starsPending, setStarsPending] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celebrationStars, setCelebrationStars] = useState(0);
  const { exitChildView } = useProfile();

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

  const availableTasks = tasks.filter(t => t.status === 'assigned');
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
          <div className="flex items-center gap-4">
            <ChildAvatar child={childProfile} size="lg" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Hi, {childProfile.child_name}!
              </h1>
              <p className="text-slate-600">Ready to earn some stars?</p>
            </div>
          </div>
          {!isParentViewing && (
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          )}
        </div>

        <Card className="bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white rounded-full p-4 shadow-md">
                  <Star className="w-12 h-12 text-yellow-500 fill-yellow-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/90">Your Stars</p>
                  <p className="text-5xl font-bold text-white">{starBalance}</p>
                </div>
              </div>
              {starsPending > 0 && (
                <div className="text-right">
                  <p className="text-sm font-medium text-white/90">Pending Approval</p>
                  <div className="flex items-center gap-2 justify-end">
                    <Sparkles className="w-6 h-6 text-white animate-pulse" />
                    <p className="text-3xl font-bold text-white">{starsPending}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-blue-500" />
                Your Tasks
              </h2>
              <Badge variant="secondary" className="text-lg">
                {availableTasks.length} available
              </Badge>
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
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-500" />
                Rewards
              </h2>
              <Badge variant="secondary" className="text-lg">
                {availableRewards.length} available
              </Badge>
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
    </div>
  );
}
