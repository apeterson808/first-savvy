import { useState, useEffect } from 'react';
import { tasksAPI } from '@/api/tasks';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Star, Edit, Trash2, Sparkles, Clock, MoreVertical } from 'lucide-react';
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

export function TasksTab({ childId, profileId, childName = '', onUpdate, onGoToActivity }) {
  const [tasks, setTasks] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
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

      const data = await tasksAPI.getTasksByChild(childId);
      setTasks(data);

      const { data: pendingCompletions } = await supabase
        .from('task_completions')
        .select('task_id')
        .eq('child_profile_id', childId)
        .eq('status', 'pending');

      const counts = {};
      for (const c of pendingCompletions || []) {
        counts[c.task_id] = (counts[c.task_id] || 0) + 1;
      }
      setPendingCounts(counts);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
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

  const handleTaskSuccess = () => {
    loadTasks();
    if (onUpdate) onUpdate();
  };

  const totalPending = Object.values(pendingCounts).reduce((s, n) => s + n, 0);

  if (loading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

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

      {/* Pending review banner */}
      {totalPending > 0 && (
        <button
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-left hover:bg-amber-100 transition-colors"
          onClick={() => onGoToActivity?.()}
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold shrink-0">
            {totalPending}
          </div>
          <p className="text-sm text-amber-800 font-medium flex-1">
            {totalPending} task {totalPending === 1 ? 'request' : 'requests'} waiting for your review
          </p>
          <span className="text-xs text-amber-600 underline">Go to Activity</span>
        </button>
      )}

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
          {[...tasks]
            .sort((a, b) => (pendingCounts[b.id] || 0) - (pendingCounts[a.id] || 0))
            .map((task) => {
              const pendingCount = pendingCounts[task.id] || 0;
              const IconComp = PICKER_ICON_MAP[task.icon] || Star;
              const stars = task.star_reward || 1;

              return (
                <Card key={task.id} className={pendingCount > 0 ? 'border-amber-300 bg-amber-50/30' : ''}>
                  <CardContent className="px-4 py-3">
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
                      {pendingCount > 0 && (
                        <button
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors"
                          onClick={() => onGoToActivity?.()}
                          title="Review in Activity tab"
                        >
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span className="text-xs font-semibold text-amber-800">{pendingCount} pending</span>
                        </button>
                      )}
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
