import React, { useState, useEffect } from 'react';
import { Star, Sparkles, Trophy, Gift, Activity, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { tasksAPI } from '@/api/tasks';
import { rewardsAPI } from '@/api/rewards';
import { useProfile } from '@/contexts/ProfileContext';
import { motion, AnimatePresence } from 'framer-motion';
import ChildAvatar from './ChildAvatar';
import { TaskCard } from './TaskCard';
import { RewardCard } from './RewardCard';
import { ActivityTab } from './ActivityTab';
import { toast } from 'sonner';

const TABS = [
  { key: 'tasks', label: 'Tasks', icon: Trophy },
  { key: 'rewards', label: 'Rewards', icon: Gift },
  { key: 'activity', label: 'Activity', icon: Activity },
];

export function BeginnerProfileView({ childProfile, isParentView = false }) {
  const [starBalance, setStarBalance] = useState(0);
  const [starsPending, setStarsPending] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celebrationStars, setCelebrationStars] = useState(0);
  const [activeTab, setActiveTab] = useState('tasks');
  const { viewingChildProfile } = useProfile();

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
        rewardsAPI.getRewardsByChild(childProfile.id),
        taskCompletionsAPI.getCompletions(childProfile.id),
      ]);

      setStarBalance(balanceData.stars_balance || 0);
      const pendingCompletions = (completionsData || []).filter(c => c.status === 'pending');
      const pendingStarsTotal = pendingCompletions.reduce((sum, c) => sum + (c.stars_earned || 0), 0);
      setStarsPending(pendingStarsTotal);
      setTasks(tasksData || []);
      setRewards(rewardsData || []);
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

  // Build tasks with their most recent completion for the "last requested" note
  const tasksWithLastCompletion = tasks.map(task => {
    const taskCompletions = completions.filter(c => c.task_id === task.id);
    // Most recent completion regardless of status
    const lastCompletion = taskCompletions[0] || null;
    return { task, lastCompletion };
  });

  const availableRewards = rewards.filter(r => r.status === 'available');
  const redeemedRewards = rewards.filter(r => r.status === 'redeemed');

  const pendingCount = completions.filter(c => c.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Sparkles className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-lg text-slate-600">Loading your adventure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 p-3 sm:p-4 md:p-8 relative">

      <AnimatePresence>
        {celebrationStars > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1.5, y: -100 }}
            exit={{ opacity: 0, scale: 0, y: -200 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-2 sm:gap-3 text-4xl sm:text-6xl font-bold text-yellow-500">
              <Star className="w-12 h-12 sm:w-20 sm:h-20 fill-yellow-500" />
              <span>+{celebrationStars}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto">
            <ChildAvatar child={childProfile} size="lg" />
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">
                Hi, {childProfile.child_name}!
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-slate-600 mt-1">Ready to earn some stars?</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="relative flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-yellow-300 flex-1 sm:flex-initial">
              <Star className="w-9 h-9 sm:w-10 sm:h-10 text-amber-500 fill-amber-500 drop-shadow-md shrink-0" />
              <div className="flex items-center gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-yellow-100 uppercase tracking-wide drop-shadow-sm">Your Stars</p>
                  <p className="text-3xl sm:text-4xl font-black text-white drop-shadow-lg leading-tight" style={{ textShadow: '0 3px 15px rgba(0,0,0,0.4)' }}>{starBalance}</p>
                </div>
                {starsPending > 0 && (
                  <div className="flex flex-col items-center justify-center bg-white/20 rounded-xl px-2.5 py-1.5 border border-white/30">
                    <p className="text-lg sm:text-xl font-black text-white leading-none">+{starsPending}</p>
                    <p className="text-[10px] sm:text-[11px] text-yellow-100 font-semibold flex items-center gap-0.5 mt-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> pending
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            const showBadge = key === 'activity' && pendingCount > 0;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all relative ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'tasks' && (
          <div className="space-y-3 sm:space-y-4">
            {tasksWithLastCompletion.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-slate-500">No tasks right now. Check back soon!</p>
                </CardContent>
              </Card>
            ) : (
              tasksWithLastCompletion.map(({ task, lastCompletion }) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  lastCompletion={lastCompletion}
                  onComplete={handleTaskComplete}
                  isParentView={isParentView}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'rewards' && (
          <div className="space-y-3 sm:space-y-4">
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
                  />
                ))}
                {redeemedRewards.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-slate-600 mb-3">Redeemed</h3>
                    {redeemedRewards.map((reward) => (
                      <RewardCard
                        key={reward.id}
                        reward={reward}
                        starBalance={starBalance}
                        isRedeemed
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <ActivityTab
            childId={childProfile.id}
            child={{ stars_balance: starBalance }}
            onUpdate={loadData}
            isChildView={true}
          />
        )}
      </div>
    </div>
  );
}
