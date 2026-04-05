import { useState, useEffect } from 'react';
import { tasksAPI } from '@/api/tasks';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle, Clock, XCircle, Star } from 'lucide-react';
import { toast } from 'sonner';
import { TaskDialog } from './TaskDialog';

const STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export function TasksTab({ childId, profileId, onUpdate }) {
  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isBeginnerProfile, setIsBeginnerProfile] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [childId]);

  const loadTasks = async () => {
    try {
      setLoading(true);

      const { data: childProfile } = await firstsavvy
        .from('child_profiles')
        .select('current_permission_level')
        .eq('id', childId)
        .single();

      const isBeginner = childProfile?.current_permission_level === 1;
      setIsBeginnerProfile(isBeginner);

      const data = await tasksAPI.getTasksByChild(childId);
      setTasks(data);

      if (isBeginner) {
        const completionsData = await taskCompletionsAPI.getCompletions(childId);
        setCompletions(completionsData);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (taskId, completionId = null) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const starsAwarded = task?.star_reward || task?.points_value || 0;

      if (isBeginnerProfile && completionId) {
        await taskCompletionsAPI.approveCompletion(completionId);
      } else {
        await tasksAPI.approveTask(taskId, null, null);
      }

      toast.success('Task approved!', {
        description: starsAwarded > 0 ? `+${starsAwarded} stars earned!` : undefined,
        icon: '⭐',
      });

      loadTasks();
      onUpdate();
    } catch (error) {
      console.error('Error approving task:', error);
      toast.error('Failed to approve task');
    }
  };

  const handleReject = async (taskId) => {
    try {
      await tasksAPI.rejectTask(taskId, null, 'Did not meet requirements');
      toast.success('Task rejected');
      loadTasks();
    } catch (error) {
      console.error('Error rejecting task:', error);
      toast.error('Failed to reject task');
    }
  };

  const handleMarkComplete = async (taskId) => {
    try {
      await tasksAPI.markTaskComplete(taskId);
      toast.success('Task marked complete! Ready for approval.');
      loadTasks();
      onUpdate();
    } catch (error) {
      console.error('Error marking task complete:', error);
      toast.error('Failed to mark task complete');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

  const handleTaskSuccess = () => {
    loadTasks();
    if (onUpdate) {
      onUpdate();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tasks</h3>
        <Button size="sm" onClick={() => setIsTaskDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-slate-600">No tasks yet</p>
              <Button className="mt-4" size="sm" onClick={() => setIsTaskDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Task
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const completion = isBeginnerProfile
              ? completions.find(c => c.task_id === task.id && c.status === 'pending')
              : null;

            const displayStatus = completion ? 'completed' : task.status;

            return (
              <Card
                key={task.id}
                className={displayStatus === 'in_progress' ? 'cursor-pointer hover:shadow-md hover:border-blue-400 transition-all' : ''}
                onClick={() => {
                  if (displayStatus === 'in_progress') {
                    handleMarkComplete(task.id);
                  }
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{task.title}</CardTitle>
                      {task.description && (
                        <p className="text-sm text-slate-600">{task.description}</p>
                      )}
                    </div>
                    <Badge className={STATUS_COLORS[displayStatus]}>
                      {displayStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm">
                      {task.star_reward ? (
                        <span className="font-semibold text-yellow-600 flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-500" />
                          {task.star_reward} {task.star_reward === 1 ? 'star' : 'stars'}
                        </span>
                      ) : task.points_reward ? (
                        <span className="font-semibold text-yellow-600 flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-500" />
                          {task.points_reward} {task.points_reward === 1 ? 'star' : 'stars'}
                        </span>
                      ) : (
                        <span className="font-semibold text-green-600">
                          {task.points_value} points
                        </span>
                      )}
                      {task.frequency && task.frequency !== 'one_time' && (
                        <Badge variant="outline" className="text-xs">
                          {task.frequency}
                        </Badge>
                      )}
                      {task.due_date && (
                        <span className="text-slate-600">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {displayStatus === 'in_progress' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkComplete(task.id);
                        }}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Complete
                      </Button>
                    )}
                    {displayStatus === 'completed' && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(task.id);
                          }}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(task.id, completion?.id);
                          }}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TaskDialog
        isOpen={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        childId={childId}
        profileId={profileId}
        onSuccess={handleTaskSuccess}
      />
    </div>
  );
}
