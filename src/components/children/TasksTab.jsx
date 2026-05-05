import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksAPI } from '@/api/tasks';
import { taskCompletionsAPI } from '@/api/taskCompletions';
import { childProfilesAPI } from '@/api/childProfiles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Sparkles, Users, ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import { AwardStarsDialog } from './AwardStarsDialog';
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
import ChildAvatar from './ChildAvatar';

export function TasksTab({ childId, profileId, childName = '', onUpdate }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
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
        <h3 className="text-lg font-semibold">Tasks</h3>
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
          <Button size="sm" variant="outline" onClick={() => navigate('/Tasks')}>
            <ListTodo className="mr-2 h-4 w-4" />
            Manage Tasks
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <ListTodo className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No tasks yet</p>
              <p className="text-slate-400 text-sm mt-1">Create tasks from the Tasks page</p>
              <Button className="mt-4" size="sm" variant="outline" onClick={() => navigate('/Tasks')}>
                <ListTodo className="mr-2 h-4 w-4" />
                Manage Tasks
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
                    {childId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-yellow-600 hover:bg-yellow-50 flex-shrink-0"
                        onClick={() => setAwardingTask(task)}
                      >
                        <Star className="w-3 h-3 mr-1 fill-yellow-500" />
                        Award
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
    </div>
  );
}
