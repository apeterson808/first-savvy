import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Settings,
  DollarSign,
  Gift,
  CheckCircle,
  ArrowUpDown,
  Star,
  Zap,
  Trophy,
  Calendar,
  Edit,
  Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/pages/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { BeginnerProfileView } from '@/components/children/BeginnerProfileView';

export default function ParentViewOfChildDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeProfile } = useProfile();

  const childProfileId = activeProfile?.child_profile_id;

  const { data: childProfile } = useQuery({
    queryKey: ['child-profile', childProfileId],
    queryFn: async () => {
      const { data } = await firstsavvy
        .from('child_profiles')
        .select('*')
        .eq('id', childProfileId)
        .single();
      return data;
    },
    enabled: !!childProfileId
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', childProfileId],
    queryFn: async () => {
      const { data } = await firstsavvy
        .from('task_assignments')
        .select('tasks!inner(*)')
        .eq('child_profile_id', childProfileId)
        .eq('is_active', true)
        .eq('tasks.is_active', true);
      return (data || []).map(row => row.tasks).filter(Boolean);
    },
    enabled: !!childProfileId
  });

  const { data: taskCompletions = [] } = useQuery({
    queryKey: ['task-completions', childProfileId],
    queryFn: async () => {
      const { data } = await firstsavvy
        .from('task_completions')
        .select('*')
        .eq('child_profile_id', childProfileId)
        .order('submitted_at', { ascending: false });
      return data || [];
    },
    enabled: !!childProfileId
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['rewards', childProfileId],
    queryFn: async () => {
      const { data } = await firstsavvy
        .from('rewards')
        .select('*')
        .eq('profile_id', activeProfile?.profile_id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!childProfileId && !!activeProfile?.profile_id
  });

  const assignedTasks = tasks.filter(c => c.status === 'in_progress');
  const completedTasks = tasks.filter(c => c.status === 'completed');
  const approvedTasks = tasks.filter(c => c.status === 'approved');

  const getLatestCompletion = (taskId) => {
    return taskCompletions.find(tc => tc.task_id === taskId);
  };

  const markTaskComplete = useMutation({
    mutationFn: async (taskId) => {
      const { error } = await firstsavvy
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', childProfileId]);
      toast.success('Task marked complete! Ready for approval.');
    },
    onError: () => {
      toast.error('Failed to mark task complete');
    }
  });

  const approveTask = useMutation({
    mutationFn: async (choreId) => {
      const chore = tasks.find(c => c.id === choreId);
      if (!chore) throw new Error('Task not found');

      const { error: updateError } = await firstsavvy
        .from('tasks')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', choreId);

      if (updateError) throw updateError;

      let newPointsBalance = childProfile.points_balance || 0;
      let newCashBalance = parseFloat(childProfile.cash_balance || 0);

      if (chore.points_reward) {
        newPointsBalance += chore.points_reward;
      }
      if (chore.cash_reward) {
        newCashBalance += parseFloat(chore.cash_reward);
      }

      const { error: profileError } = await firstsavvy
        .from('child_profiles')
        .update({
          points_balance: newPointsBalance,
          cash_balance: newCashBalance
        })
        .eq('id', childProfileId);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', childProfileId]);
      queryClient.invalidateQueries(['child-profile', childProfileId]);
      toast.success('Task approved and rewards granted!');
    },
    onError: () => {
      toast.error('Failed to approve chore');
    }
  });

  if (childProfile && childProfile.current_permission_level === 1) {
    return <BeginnerProfileView childProfile={childProfile} isParentView={false} />;
  }

  return (
    <div className="p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{activeProfile?.display_name}'s Profile</h1>
          <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Parent View - Manage permissions, tasks, and rewards
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(createPageUrl('Children') + `/${childProfileId}`)}
        >
          <Settings className="w-4 h-4 mr-2" />
          Full Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Cash</p>
                <p className="text-2xl font-black text-green-900">${(childProfile?.cash_balance || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                <Star className="w-5 h-5 text-white fill-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Points</p>
                <p className="text-2xl font-black text-amber-900">{childProfile?.points_balance || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-sky-50 to-blue-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-sky-700 uppercase tracking-wide">Tasks</p>
                <p className="text-2xl font-black text-sky-900">{approvedTasks.length + completedTasks.length}/{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 pt-5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">Task Management</CardTitle>
                <Button size="sm" onClick={() => navigate(createPageUrl('Children') + `/${childProfileId}`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg">
                  <Zap className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-medium">No tasks yet</p>
                  <p className="text-xs text-slate-400 mt-1">Add tasks to help {activeProfile?.display_name} learn responsibility</p>
                  <Button size="sm" className="mt-4" onClick={() => navigate(createPageUrl('Children') + `/${childProfileId}`)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Task
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((chore) => {
                    const completion = getLatestCompletion(chore.id);
                    return (
                      <div
                        key={chore.id}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          chore.status === 'approved'
                            ? 'border-green-200 bg-green-50'
                            : chore.status === 'completed'
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-md cursor-pointer'
                        }`}
                        onClick={() => {
                          if (chore.status === 'in_progress') {
                            markTaskComplete.mutate(chore.id);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            {chore.status === 'approved' ? (
                              <CheckCircle className="w-5 h-5 text-green-600 fill-green-600 shrink-0 mt-0.5" />
                            ) : chore.status === 'completed' ? (
                              <CheckCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-blue-500 shrink-0 mt-0.5 hover:bg-blue-100" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">{chore.title}</p>
                              {chore.description && (
                                <p className="text-xs text-slate-600 mt-1">{chore.description}</p>
                              )}
                              {completion?.submission_notes && chore.status === 'completed' && (
                                <div className="mt-2 p-2 bg-blue-100 rounded text-sm border border-blue-200">
                                  <p className="font-medium text-blue-900 text-xs">Notes from {activeProfile?.display_name}:</p>
                                  <p className="text-blue-800 text-xs mt-0.5">{completion.submission_notes}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-3 mt-2">
                                {chore.due_date && (
                                  <div className="flex items-center gap-1 text-xs text-slate-500">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(chore.due_date), 'MMM d')}
                                  </div>
                                )}
                                {(chore.points_reward > 0 || chore.cash_reward > 0) && (
                                  <div className="flex items-center gap-2">
                                    {chore.points_reward > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        <Star className="w-3 h-3 mr-1 text-amber-500 fill-amber-500" />
                                        {chore.points_reward}
                                      </Badge>
                                    )}
                                    {chore.cash_reward > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        <DollarSign className="w-3 h-3 mr-1 text-green-600" />
                                        {chore.cash_reward.toFixed(2)}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {chore.status === 'completed' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                approveTask.mutate(chore.id);
                              }}
                              disabled={approveTask.isPending}
                            >
                              Approve
                            </Button>
                          )}
                          {chore.status === 'approved' && (
                            <Badge className="bg-green-100 text-green-700">Approved</Badge>
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

        <div className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-bold">Profile Type</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    Beginner
                  </Badge>
                  <Shield className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Basic profile with access to tasks, rewards, and allowance tracking.
                </p>
              </div>
            </CardContent>
          </Card>


          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Transfer Money
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate(createPageUrl('Children') + `/${childProfileId}`)}>
                  <Gift className="w-4 h-4 mr-2" />
                  Manage Rewards
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate(createPageUrl('Children') + `/${childProfileId}`)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Profile Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
