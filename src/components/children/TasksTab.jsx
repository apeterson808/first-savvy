import { useState, useEffect } from 'react';
import { tasksAPI } from '@/api/tasks';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { childProfilesAPI } from '@/api/childProfiles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Star, Edit, Trash2, Sparkles, MoreVertical, Users } from 'lucide-react';
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
import ChildAvatar from './ChildAvatar';

// When viewing from a specific child's profile, childId and childName are passed in.
// The component always loads ALL tasks for the parent profile so edits propagate everywhere.
export function TasksTab({ childId, profileId, childName = '', onUpdate }) {
  const [tasks, setTasks] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [awardingTask, setAwardingTask] = useState(null);
  const [showOneTimeAward, setShowOneTimeAward] = useState(false);

  useEffect(() => {
    if (profileId) loadData();
  }, [profileId, childId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allTasks, allChildren] = await Promise.all([
        tasksAPI.getAllTasks(profileId),
        childProfilesAPI.getChildProfiles(profileId),
      ]);

      // If viewing from a child's profile, filter to only their tasks
      const filtered = childId
        ? allTasks.filter(t =>
            (t.assignments || []).some(a => a.child_profile_id === childId)
          )
        : allTasks;

      setTasks(filtered);
      setChildren(allChildren || []);
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
      loadData();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleDirectAward = async (stars, note) => {
    if (!childId) return;
    try {
      await taskCompletionsAPI.awardStarsDirectly(childId, stars, note, awardingTask?.id);
      toast.success(`Awarded ${stars} ${stars === 1 ? 'star' : 'stars'} to ${childName || 'child'}!`);
      setAwardingTask(null);
      loadData();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error awarding stars:', error);
      toast.error('Failed to award stars');
    }
  };

  const handleOneTimeAward = async (stars, note) => {
    if (!childId) return;
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
    loadData();
    if (onUpdate) onUpdate();
  };

  const getAssignedChildren = (task) => {
    return (task.assignments || [])
      .map(a => children.find(c => c.id === a.child_profile_id))
      .filter(Boolean);
  };

  if (loading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tasks</h3>
          {!childId && (
            <p className="text-xs text-slate-500 mt-0.5">Changes apply to all assigned family members</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {childId && (
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
              onClick={() => setShowOneTimeAward(true)}
            >
              <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
              Award Stars
            </Button>
          )}
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
          {tasks.map((task) => {
            const IconComp = PICKER_ICON_MAP[task.icon] || Star;
            const stars = task.star_reward || 1;
            const assignedChildren = getAssignedChildren(task);

            return (
              <Card key={task.id}>
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
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-medium text-yellow-600 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-yellow-500" />
                          {stars} {stars === 1 ? 'star' : 'stars'}
                        </span>
                        {assignedChildren.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <div className="flex items-center gap-0.5">
                              {assignedChildren.map(child => (
                                <ChildAvatar key={child.id} child={child} size="sm" className="w-5 h-5 text-[10px] shadow-none" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
                        {childId && (
                          <DropdownMenuItem onClick={() => setAwardingTask(task)}>
                            <Star className="h-4 w-4 mr-2" />
                            Award Stars
                          </DropdownMenuItem>
                        )}
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
        profileId={profileId}
        childProfiles={children}
        defaultChildIds={childId ? [childId] : []}
        onSuccess={handleTaskSuccess}
        task={editingTask}
      />

      {childId && (
        <>
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
        </>
      )}

      <AlertDialog open={!!deletingTask} onOpenChange={(open) => { if (!open) setDeletingTask(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTask?.title}&quot;? This will remove it for all assigned family members and cannot be undone.
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
