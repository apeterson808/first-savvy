import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import { CheckCircle, Circle, Star, DollarSign, Target, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function ChildDashboard() {
  const { activeProfile } = useProfile();
  const permissionLevel = activeProfile?.permission_level || 1;
  const childProfileId = activeProfile?.child_profile_id;

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

  const pendingChores = chores.filter(c => c.status === 'pending');
  const completedChores = chores.filter(c => c.status === 'completed');

  const affordableRewards = rewards.filter(r =>
    r.reward_type === 'points' && r.points_cost <= pointsBalance
  );

  const getPermissionLevelName = (level) => {
    const levels = {
      1: 'Supervised',
      2: 'Monitored',
      3: 'Semi-Independent',
      4: 'Independent',
      5: 'Full Control'
    };
    return levels[level] || 'Unknown';
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome, {activeProfile?.display_name}!
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Permission Level: {getPermissionLevelName(permissionLevel)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-3 px-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Points Balance</p>
            <CardTitle className="text-3xl font-bold flex items-center">
              <Star className="w-6 h-6 mr-2 text-yellow-500 fill-yellow-500" />
              {pointsBalance}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-xs text-slate-600">
              {affordableRewards.length} rewards available
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-3 px-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Cash Balance</p>
            <CardTitle className="text-3xl font-bold flex items-center">
              <DollarSign className="w-6 h-6 mr-2 text-green-600" />
              {cashBalance.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {permissionLevel < 3 ? (
              <div className="flex items-center text-xs text-amber-600">
                <Lock className="w-3 h-3 mr-1" />
                Access restricted at your level
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                {childProfile?.monthly_spending_limit
                  ? `Limit: $${parseFloat(childProfile.monthly_spending_limit).toFixed(2)}/month`
                  : 'No spending limit set'
                }
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-3 px-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Chores</p>
            <CardTitle className="text-3xl font-bold">
              {completedChores.length}/{chores.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-xs text-slate-600">
              {pendingChores.length} pending completion
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-sky-blue" />
              My Chores
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {chores.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Circle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No chores assigned yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chores.slice(0, 5).map((chore) => (
                  <div
                    key={chore.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-sky-blue transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {chore.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                      ) : chore.status === 'approved' ? (
                        <CheckCircle className="w-5 h-5 text-sky-blue shrink-0 fill-sky-blue" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {chore.title}
                        </p>
                        {chore.due_date && (
                          <p className="text-xs text-slate-500">
                            Due: {format(new Date(chore.due_date), 'MMM d')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {chore.points_reward > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1 text-yellow-500" />
                          {chore.points_reward}
                        </Badge>
                      )}
                      {chore.status === 'pending' && permissionLevel >= 1 && (
                        <Badge variant="outline" className="text-xs">
                          Pending
                        </Badge>
                      )}
                      {chore.status === 'completed' && (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          Awaiting Approval
                        </Badge>
                      )}
                      {chore.status === 'approved' && (
                        <Badge variant="outline" className="text-xs text-green-600">
                          Approved
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center">
              <Target className="w-4 h-4 mr-2 text-purple-600" />
              Available Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {rewards.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Target className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No rewards available yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rewards.slice(0, 5).map((reward) => {
                  const canAfford = reward.reward_type === 'points'
                    ? reward.points_cost <= pointsBalance
                    : reward.reward_type === 'cash'
                    ? reward.cash_cost <= cashBalance
                    : true;

                  return (
                    <div
                      key={reward.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        canAfford
                          ? 'border-green-200 bg-green-50/30 hover:border-green-400'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {reward.title}
                        </p>
                        {reward.description && (
                          <p className="text-xs text-slate-500 truncate">
                            {reward.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {reward.reward_type === 'points' && (
                          <Badge
                            variant={canAfford ? "default" : "secondary"}
                            className="text-xs"
                          >
                            <Star className="w-3 h-3 mr-1 text-yellow-500" />
                            {reward.points_cost}
                          </Badge>
                        )}
                        {reward.reward_type === 'cash' && (
                          <Badge
                            variant={canAfford ? "default" : "secondary"}
                            className="text-xs"
                          >
                            <DollarSign className="w-3 h-3 mr-1" />
                            {parseFloat(reward.cash_cost).toFixed(2)}
                          </Badge>
                        )}
                        {permissionLevel < 2 && (
                          <Lock className="w-4 h-4 text-slate-400" />
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
        <Card className="mt-4 shadow-sm border-amber-200 bg-amber-50/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Supervised Mode
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  You're currently at the Supervised permission level. As you demonstrate responsibility,
                  your parent may increase your permission level to unlock more features like cash access,
                  budgeting tools, and independent reward redemption.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
