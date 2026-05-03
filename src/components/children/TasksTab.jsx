import { useState, useEffect } from 'react';
import { tasksAPI } from '@/api/tasks';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle, Clock, XCircle, Star, Edit, Trash2, Sparkles, CalendarClock, X, Check, MoreVertical } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { TaskDialog } from './TaskDialog';
import { AwardStarsDialog } from './AwardStarsDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';

const STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export function TasksTab({ childId, profileId, childName = '', onUpdate }) {
  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isBeginnerProfile, setIsBeginnerProfile] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [awardingTask, setAwardingTask] = useState(null);
  const [showOneTimeAward, setShowOneTimeAward] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [childId]);

  const loadTasks = async () => {
    try {
      setLoading(true);

      const { data: childProfile } = await supabase
        .from('child_profiles')
        .select('current_permission_level')
        .eq('id', childId)
        .maybeSingle();

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
      const starsAwarded = task?.star_reward || 0;

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

  const handleReject = async (taskId, completionId = null) => {
    try {
      if (isBeginnerProfile && completionId) {
        await taskCompletionsAPI.rejectCompletion(completionId);
      } else {
        await tasksAPI.rejectTask(taskId, null, 'Did not meet requirements');
      }
      toast.success('Task rejected');
      loadTasks();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error rejecting task:', error);
      toast.error('Failed to reject task');
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTask) return;
    try {
      await tasksAPI.deleteTask(deletingTask.id);
      toast.success(`Task "${deletingTask.title}" deleted`);
      setDeletingTask(null);
      loadTasks();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
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

  const handleDirectAward = async (stars, note) => {
    try {
      await taskCompletionsAPI.awardStarsDirectly(childId, stars, note, awardingTask?.id);
      toast.success(`Awarded ${stars} ${stars === 1 ? 'star' : 'stars'} to ${childName || 'child'}!`);
      setAwardingTask(null);
      loadTasks();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error awarding stars:', error);
      toast.error('Failed to award stars');
    }
  };

  const handleOneTimeAward = async (stars, note) => {
    try {
      await taskCompletionsAPI.awardStarsDirectly(childId, stars, note, null);
      toast.success(`Awarded ${stars} ${stars === 1 ? 'star' : 'stars'} to ${childName || 'child'}!`);
      setShowOneTimeAward(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error awarding stars:', error);
      toast.error('Failed to award stars');
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
            onClick={() => setShowOneTimeAward(true)}
          >
            <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
            Award Stars
          </Button>
          <Button size="sm" onClick={() => setIsTaskDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
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
          {[...tasks].sort((a, b) => {
            const aCompletion = isBeginnerProfile ? completions.find(c => c.task_id === a.id && c.status === 'pending') : null;
            const bCompletion = isBeginnerProfile ? completions.find(c => c.task_id === b.id && c.status === 'pending') : null;
            const aNeedsAttention = aCompletion ? 1 : 0;
            const bNeedsAttention = bCompletion ? 1 : 0;
            return bNeedsAttention - aNeedsAttention;
          }).map((task) => {
            const completion = isBeginnerProfile
              ? completions.find(c => c.task_id === task.id && c.status === 'pending')
              : null;

            const displayStatus = completion ? 'completed' : task.status;

            const IconComp = PICKER_ICON_MAP[task.icon] || Star;
            const stars = task.star_reward || 1;

            return (
              <Card key={task.id} className={displayStatus === 'completed' ? 'border-amber-300 bg-amber-50/40' : ''}>
                <CardContent className="px-4 py-3">
                  {/* Main row: icon + title/stars + three-dot menu */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: task.color || '#52A5CE' }}
                    >
                      <IconComp className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 leading-tight truncate">{task.title}</p>
                      <span className="text-xs font-medium text-yellow-600 flex items-center gap-0.5 mt-0.5">
                        <Star className="w-3 h-3 fill-yellow-500" />
                        {stars} {stars === 1 ? 'star' : 'stars'}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-slate-400 hover:text-slate-600">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingTask(task); setIsTaskDialogOpen(true); }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAwardingTask(task)}>
                          <Star className="h-4 w-4 mr-2" />
                          Award Stars
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeletingTask(task)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Pending approval row */}
                  {displayStatus === 'completed' && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      {(completion?.note || completion?.submission_notes) && (
                        <div className="mb-2 p-2 bg-blue-50 rounded text-xs border border-blue-200">
                          <p className="font-medium text-blue-900">Notes from child:</p>
                          <p className="text-blue-800 mt-0.5">{completion.note || completion.submission_notes}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Waiting for approval
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="h-7 px-3 rounded-full text-xs font-medium text-red-600 bg-white hover:bg-red-50 border border-red-200 transition-colors flex items-center gap-1"
                            onClick={(e) => { e.stopPropagation(); handleReject(task.id, completion?.id); }}
                          >
                            <X className="h-3 w-3" />
                            Reject
                          </button>
                          <button
                            className="h-7 px-3 rounded-full text-xs font-medium text-white bg-green-500 hover:bg-green-600 transition-colors flex items-center gap-1"
                            onClick={(e) => { e.stopPropagation(); handleApprove(task.id, completion?.id); }}
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TaskDialog
        isOpen={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setEditingTask(null);
        }}
        childId={childId}
        profileId={profileId}
        onSuccess={handleTaskSuccess}
        task={editingTask}
      />

      <AwardStarsDialog
        open={!!awardingTask}
        onOpenChange={(val) => { if (!val) setAwardingTask(null); }}
        onAward={handleDirectAward}
        task={awardingTask}
        childName={childName}
      />

      <AwardStarsDialog
        open={showOneTimeAward}
        onOpenChange={setShowOneTimeAward}
        onAward={handleOneTimeAward}
        task={null}
        childName={childName}
      />

      <AlertDialog open={!!deletingTask} onOpenChange={(open) => { if (!open) setDeletingTask(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTask?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteTask}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
