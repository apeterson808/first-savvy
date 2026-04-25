import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { tasksAPI } from '@/api/tasks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import AppearancePicker, { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
import { Star } from 'lucide-react';

const SCHEDULE_OPTIONS = [
  { value: 'instant', label: 'Instant reset' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function getInitialResetMode(task) {
  if (!task) return 'instant';
  if (['daily', 'weekly', 'monthly'].includes(task.reset_mode)) return task.reset_mode;
  return 'instant';
}

const DEFAULT_FORM = { title: '', description: '', star_reward: 1, icon: 'Star', color: '#52A5CE' };

export function TaskDialog({ isOpen, onClose, childId, profileId, onSuccess, task = null }) {
  const { user } = useAuth();
  const { currentProfile } = useProfile();
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [resetMode, setResetMode] = useState('instant');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setFormData({
          title: task.title || '',
          description: task.description || '',
          star_reward: task.star_reward || 1,
          icon: task.icon || 'Star',
          color: task.color || '#52A5CE',
        });
        setResetMode(getInitialResetMode(task));
      } else {
        setFormData(DEFAULT_FORM);
        setResetMode('instant');
      }
      setErrors({});
    }
  }, [isOpen, task]);

  const stepStars = (delta) => {
    setFormData(prev => ({ ...prev, star_reward: Math.max(1, (parseInt(prev.star_reward) || 1) + delta) }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    else if (formData.title.length > 100) newErrors.title = 'Title must be 100 characters or less';
    if (!formData.star_reward || parseInt(formData.star_reward) < 1) newErrors.star_reward = 'Must be at least 1';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const parentProfileId = profileId || currentProfile?.id;
      if (!parentProfileId) { toast.error('Profile not found'); return; }

      const isInstant = resetMode === 'instant';
      const payload = {
        title: formData.title,
        description: formData.description || null,
        star_reward: parseInt(formData.star_reward),
        icon: formData.icon,
        color: formData.color,
        reset_mode: resetMode,
        repeatable: isInstant,
        frequency: isInstant ? 'always_available' : 'once',
      };

      if (task) {
        await tasksAPI.updateTask(task.id, payload);
        toast.success(`Task "${formData.title}" updated`);
      } else {
        await tasksAPI.createTask(parentProfileId, {
          ...payload,
          assigned_to_child_id: childId,
          requires_approval: true,
          created_by_user_id: user.id,
        });
        toast.success(`Task "${formData.title}" created`);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error(`Error ${task ? 'updating' : 'creating'} task:`, error);
      toast.error(`Failed to ${task ? 'update' : 'create'} task`);
    } finally {
      setLoading(false);
    }
  };

  const IconComp = PICKER_ICON_MAP[formData.icon] || Star;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto flex-1 px-1 pb-1">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Clean your room"
              maxLength={100}
              autoFocus={!task}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add details about the task..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon & Color</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-input bg-background hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: formData.color }}>
                    <IconComp className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{formData.icon}</p>
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </div>
                  <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" style={{ backgroundColor: formData.color }} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(320px,calc(100vw-32px))] p-0" align="start" side="bottom" avoidCollisions>
                <AppearancePicker
                  inline
                  useTabs
                  color={formData.color}
                  icon={formData.icon}
                  onColorChange={(c) => setFormData(prev => ({ ...prev, color: c }))}
                  onIconChange={(i) => setFormData(prev => ({ ...prev, icon: i }))}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Stars</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => stepStars(-1)}
                className="h-9 w-9 flex-shrink-0 text-lg"
              >
                −
              </Button>
              <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2 flex-1 justify-center bg-background">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.star_reward}
                  onChange={(e) => setFormData({ ...formData, star_reward: e.target.value })}
                  className="w-10 bg-transparent text-center text-base font-semibold outline-none text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => stepStars(1)}
                className="h-9 w-9 flex-shrink-0 text-lg"
              >
                +
              </Button>
            </div>
            {errors.star_reward && <p className="text-xs text-destructive">{errors.star_reward}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Schedule</Label>
            <Select value={resetMode} onValueChange={setResetMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (task ? 'Saving...' : 'Creating...') : (task ? 'Save Changes' : 'Create Task')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
