import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckCircle,
  Circle,
  Star,
  DollarSign,
  Target,
  Lock,
  TrendingUp,
  Sparkles,
  Gift,
  Calendar,
  ArrowRight,
  Zap,
  Trophy,
  Flame
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

export default function ChildDashboard() {
  const { activeProfile } = useProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const permissionLevel = activeProfile?.permission_level || 1;
  const childProfileId = activeProfile?.child_profile_id;
  const [selectedChore, setSelectedChore] = useState(null);

  const { data: childProfile } = useQuery({
    queryKey: ['child-profile', childProfileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy
        .from('child_profiles')
        .select('*')
        .eq('id', childProfileId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!childProfileId
  });

  const { data: chores = [] } = useQuery({
    queryKey: ['child-chores', childProfileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy
        .from('chores')
        .select('*')
        .eq('child_profile_id', childProfileId)
        .eq('is_active', true)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!childProfileId
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['child-rewards', childProfileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy
        .from('rewards')
        .select('*')
        .eq('child_profile_id', childProfileId)
        .eq('is_active', true)
        .order('points_cost', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!childProfileId
  });

  const pointsBalance = childProfile?.points_balance || 0;
  const cashBalance = parseFloat(childProfile?.cash_balance || 0);

  const assignedChores = chores.filter(c => c.status === 'assigned');
  const completedChores = chores.filter(c => c.status === 'completed');
  const approvedChores = chores.filter(c => c.status === 'approved');

  const affordableRewards = rewards.filter(r =>
    r.reward_type === 'points' ? r.points_cost <= pointsBalance : r.cash_cost <= cashBalance
  );

  const completionRate = chores.length > 0
    ? Math.round(((completedChores.length + approvedChores.length) / chores.length) * 100)
    : 0;

  const markChoreComplete = useMutation({
    mutationFn: async (choreId) => {
      const { error } = await firstsavvy
        .from('chores')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', choreId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['child-chores', childProfileId]);
      toast.success('Chore marked complete! Awaiting parent approval.');
    },
    onError: () => {
      toast.error('Failed to mark chore complete');
    }
  });

  const redeemReward = useMutation({
    mutationFn: async (reward) => {
      const { error } = await firstsavvy.rpc('redeem_reward', {
        p_reward_id: reward.id,
        p_child_profile_id: childProfileId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['child-profile', childProfileId]);
      queryClient.invalidateQueries(['child-rewards', childProfileId]);
      toast.success('Reward redeemed successfully!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to redeem reward');
    }
  });

  return (
    <div className="p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
              Hey {activeProfile?.display_name}! 👋
            </h1>
            <p className="text-sm text-slate-600 mt-1">Let's see what you've got today</p>
          </div>
          {completionRate > 0 && (
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-semibold text-slate-900">{completionRate}% Complete</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-amber-50 to-yellow-50 hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
                  <Star className="w-6 h-6 text-white fill-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Points</p>
                  <p className="text-3xl font-black text-amber-900">{pointsBalance}</p>
                </div>
              </div>
              <Trophy className="w-8 h-8 text-amber-400 opacity-50" />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-amber-200">
              <p className="text-sm text-amber-700">
                {affordableRewards.length} rewards unlocked
              </p>
              <ArrowRight className="w-4 h-4 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Cash</p>
                  <p className="text-3xl font-black text-green-900">${cashBalance.toFixed(2)}</p>
                </div>
              </div>
              <Sparkles className="w-8 h-8 text-green-400 opacity-50" />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-green-200">
              {permissionLevel < 3 ? (
                <div className="flex items-center text-sm text-amber-700">
                  <Lock className="w-4 h-4 mr-2" />
                  Unlock at Level 3
                </div>
              ) : (
                <p className="text-sm text-green-700">
                  {childProfile?.monthly_spending_limit
                    ? `$${parseFloat(childProfile.monthly_spending_limit).toFixed(2)}/mo limit`
                    : 'Ready to spend'
                  }
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="pb-3 pt-6 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-sky-600" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-900">My Chores</CardTitle>
              </div>
              <Badge variant="secondary" className="text-xs px-3 py-1">
                {assignedChores.length} active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {chores.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <Circle className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium">No chores yet</p>
                <p className="text-xs text-slate-400 mt-1">Check back later for new tasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {chores.slice(0, 6).map((chore) => {
                  const daysUntilDue = chore.due_date ? differenceInDays(new Date(chore.due_date), new Date()) : null;
                  const isUrgent = daysUntilDue !== null && daysUntilDue <= 1;

                  return (
                    <div
                      key={chore.id}
                      className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                        chore.status === 'approved'
                          ? 'border-green-200 bg-green-50'
                          : chore.status === 'completed'
                          ? 'border-amber-200 bg-amber-50'
                          : isUrgent
                          ? 'border-red-200 bg-red-50'
                          : 'border-slate-200 bg-slate-50 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => {
                            if (chore.status === 'assigned') {
                              markChoreComplete.mutate(chore.id);
                            }
                          }}
                          disabled={chore.status !== 'assigned'}
                          className="mt-1"
                        >
                          {chore.status === 'approved' ? (
                            <CheckCircle className="w-6 h-6 text-green-600 fill-green-600" />
                          ) : chore.status === 'completed' ? (
                            <CheckCircle className="w-6 h-6 text-amber-600" />
                          ) : (
                            <Circle className={`w-6 h-6 ${chore.status === 'assigned' ? 'text-sky-600 hover:text-sky-700 cursor-pointer' : 'text-slate-400'}`} />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{chore.title}</p>
                          {chore.description && (
                            <p className="text-xs text-slate-600 mt-1">{chore.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            {chore.due_date && (
                              <div className={`flex items-center gap-1 text-xs ${isUrgent ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                                <Calendar className="w-3 h-3" />
                                {daysUntilDue === 0 ? 'Due today' : daysUntilDue === 1 ? 'Due tomorrow' : format(new Date(chore.due_date), 'MMM d')}
                              </div>
                            )}
                            {(chore.points_reward > 0 || chore.cash_reward > 0) && (
                              <div className="flex items-center gap-2">
                                {chore.points_reward > 0 && (
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 rounded-full">
                                    <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
                                    <span className="text-xs font-semibold text-amber-700">{chore.points_reward}</span>
                                  </div>
                                )}
                                {chore.cash_reward > 0 && (
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded-full">
                                    <DollarSign className="w-3 h-3 text-green-600" />
                                    <span className="text-xs font-semibold text-green-700">{chore.cash_reward.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white">
          <CardHeader className="pb-3 pt-6 px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-purple-600" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-900">Rewards Store</CardTitle>
              </div>
              {affordableRewards.length > 0 && (
                <Badge className="bg-green-100 text-green-700 text-xs px-3 py-1">
                  {affordableRewards.length} available
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {rewards.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <Gift className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium">No rewards yet</p>
                <p className="text-xs text-slate-400 mt-1">Your parent will add rewards soon</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rewards.slice(0, 6).map((reward) => {
                  const canAfford = reward.reward_type === 'points'
                    ? reward.points_cost <= pointsBalance
                    : reward.reward_type === 'cash'
                    ? reward.cash_cost <= cashBalance
                    : true;

                  const isLocked = permissionLevel < 2 || !canAfford;

                  return (
                    <div
                      key={reward.id}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        canAfford && permissionLevel >= 2
                          ? 'border-green-200 bg-green-50 hover:shadow-md hover:border-green-400'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className="text-sm font-semibold text-slate-900 flex-1">{reward.title}</p>
                            {isLocked && <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
                          </div>
                          {reward.description && (
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{reward.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            {reward.reward_type === 'points' && (
                              <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                                canAfford ? 'bg-amber-200' : 'bg-slate-200'
                              }`}>
                                <Star className={`w-4 h-4 ${canAfford ? 'text-amber-700 fill-amber-700' : 'text-slate-500'}`} />
                                <span className={`text-sm font-bold ${canAfford ? 'text-amber-900' : 'text-slate-600'}`}>
                                  {reward.points_cost}
                                </span>
                              </div>
                            )}
                            {reward.reward_type === 'cash' && (
                              <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                                canAfford ? 'bg-green-200' : 'bg-slate-200'
                              }`}>
                                <DollarSign className={`w-4 h-4 ${canAfford ? 'text-green-700' : 'text-slate-500'}`} />
                                <span className={`text-sm font-bold ${canAfford ? 'text-green-900' : 'text-slate-600'}`}>
                                  {parseFloat(reward.cash_cost).toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {canAfford && permissionLevel >= 2 && (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md"
                            onClick={() => redeemReward.mutate(reward)}
                          >
                            Redeem
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {permissionLevel === 1 && (
        <Card className="mt-6 shadow-lg border-0 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-amber-900 mb-2">
                  🌟 Level Up to Unlock More Features!
                </p>
                <p className="text-sm text-amber-800 leading-relaxed">
                  You're at Level 1 (Supervised). Complete your chores and show responsibility
                  to unlock rewards, cash management, and more cool features! Keep up the great work!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
