import { useState, useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { tasksAPI } from '@/api/tasks';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { childProfilesAPI } from '@/api/childProfiles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Star, Edit, Trash2, MoreVertical, Users, ListTodo, ChevronDown
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { TaskDialog } from '@/components/children/TaskDialog';
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
import ChildAvatar from '@/components/children/ChildAvatar';

const SCHEDULE_LABELS = {
  instant: 'Always available',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function Tasks() {
  const { currentProfile } = useProfile();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterChildId, setFilterChildId] = useState(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);

  const profileId = currentProfile?.id;

  useEffect(() => {
    if (profileId) loadData();
  }, [profileId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allTasks, allChildren] = await Promise.all([
        tasksAPI.getAllTasks(profileId),
        childProfilesAPI.getChildProfiles(profileId),
      ]);
      setTasks(allTasks || []);
      setChildren(allChildren || []);
    } catch (err) {
      console.error('Error loading tasks:', err);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTask) return;
    try {
      await tasksAPI.deleteTask(deletingTask.id);
      toast.success(`Task deleted`);
      setDeletingTask(null);
      loadData();
    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error('Failed to delete task');
    }
  };

  const getAssignedChildren = (task) => {
    return (task.assignments || [])
      .map(a => children.find(c => c.id === a.child_profile_id))
      .filter(Boolean);
  };

  const filteredTasks = filterChildId
    ? tasks.filter(t => (t.assignments || []).some(a => a.child_profile_id === filterChildId))
    : tasks;

  const filterChild = filterChildId ? children.find(c => c.id === filterChildId) : null;

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ListTodo className="w-6 h-6 text-slate-700" />
              <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
            </div>
            <p className="text-sm text-slate-500">
              Manage tasks for your family members. Edits apply everywhere instantly.
            </p>
          </div>
          <Button onClick={() => { setEditingTask(null); setIsTaskDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* Filter bar */}
        {children.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterChildId(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !filterChildId
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              All
            </button>
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => setFilterChildId(child.id === filterChildId ? null : child.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterChildId === child.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <ChildAvatar child={child} size="sm" className="w-4 h-4 text-[9px] shadow-none" />
                {child.display_name || child.child_name}
              </button>
            ))}
          </div>
        )}

        {/* Task count */}
        {filteredTasks.length > 0 && (
          <p className="text-xs text-slate-400 -mt-2">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
            {filterChild ? ` assigned to ${filterChild.display_name || filterChild.child_name}` : ' total'}
          </p>
        )}

        {/* Task list */}
        {filteredTasks.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 bg-white">
            <CardContent className="py-16 text-center">
              <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                {filterChildId ? 'No tasks assigned to this family member' : 'No tasks yet'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {filterChildId
                  ? 'Create a task and assign it to them'
                  : 'Create your first task to get started'}
              </p>
              <Button
                className="mt-5"
                onClick={() => { setEditingTask(null); setIsTaskDialogOpen(true); }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => {
              const IconComp = PICKER_ICON_MAP[task.icon] || Star;
              const stars = task.star_reward || 1;
              const assignedChildren = getAssignedChildren(task);
              const scheduleLabel = SCHEDULE_LABELS[task.reset_mode] || task.reset_mode;

              return (
                <Card key={task.id} className="bg-white hover:shadow-sm transition-shadow">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: task.color || '#52A5CE' }}
                      >
                        <IconComp className="w-5 h-5 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900 leading-snug">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-xs font-medium text-amber-600 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {stars} {stars === 1 ? 'star' : 'stars'}
                          </span>
                          <span className="text-xs text-slate-400">{scheduleLabel}</span>
                          {assignedChildren.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-300" />
                              <div className="flex items-center gap-0.5">
                                {assignedChildren.map(child => (
                                  <ChildAvatar
                                    key={child.id}
                                    child={child}
                                    size="sm"
                                    className="w-5 h-5 text-[9px] shadow-none"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0 text-slate-300 hover:text-slate-600"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => { setEditingTask(task); setIsTaskDialogOpen(true); }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
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
      </div>

      {/* Task create/edit dialog */}
      <TaskDialog
        isOpen={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setEditingTask(null);
        }}
        profileId={profileId}
        childProfiles={children}
        defaultChildIds={[]}
        onSuccess={() => { loadData(); }}
        task={editingTask}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingTask}
        onOpenChange={(open) => { if (!open) setDeletingTask(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deletingTask?.title}&quot;? This removes it for all assigned family members and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
