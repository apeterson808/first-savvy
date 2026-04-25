import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { tasksAPI } from '@/api/tasks';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import AppearancePicker, { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
import { Star, Plus, ChevronDown } from 'lucide-react';

const SCHEDULE_OPTIONS = [
  { value: 'instant', label: 'Instant reset' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function getInitialScheduleState(task) {
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
        setResetMode(getInitialScheduleState(task));
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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-3xl overflow-y-auto bg-[#0f172a] border-[#1e293b] px-0 pb-0">
        <div className="px-6 pb-10 space-y-5">
          <SheetHeader className="pt-2 pb-0">
            <SheetTitle className="flex items-center gap-2 text-slate-100 text-xl font-bold">
              {task ? (
                <span>Edit Task</span>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-blue-400" />
                  <span>New Task</span>
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Task name"
                maxLength={100}
                autoFocus={!task}
                className="bg-[#0f1e33] border-[#1e3a5f] text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50"
              />
              {errors.title && <p className="text-xs text-red-400">{errors.title}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description (optional)</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
                className="bg-[#0f1e33] border-[#1e3a5f] text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50 resize-none"
              />
            </div>

            {/* Icon & Color picker row */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Icon & Color</label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0f1e33] border border-[#1e3a5f] hover:border-blue-500/40 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: formData.color }}>
                      <IconComp className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-slate-200">{formData.icon}</p>
                      <p className="text-xs text-slate-500">Tap to change</p>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-white/20 flex-shrink-0" style={{ backgroundColor: formData.color }} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(320px,calc(100vw-32px))] p-0" align="start" side="top" avoidCollisions>
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

            {/* Stars stepper */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stars</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => stepStars(-1)}
                  className="w-11 h-11 rounded-xl bg-[#1e293b] border border-[#334155] text-slate-200 text-xl font-bold hover:bg-[#293548] transition-colors flex items-center justify-center flex-shrink-0"
                >
                  −
                </button>
                <div className="flex items-center gap-2 bg-[#0f1e33] border border-amber-500/25 rounded-xl px-4 py-2.5 flex-1 justify-center">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.star_reward}
                    onChange={(e) => setFormData({ ...formData, star_reward: e.target.value })}
                    className="w-12 bg-transparent text-center text-xl font-bold text-amber-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => stepStars(1)}
                  className="w-11 h-11 rounded-xl bg-[#1e293b] border border-[#334155] text-slate-200 text-xl font-bold hover:bg-[#293548] transition-colors flex items-center justify-center flex-shrink-0"
                >
                  +
                </button>
              </div>
              {errors.star_reward && <p className="text-xs text-red-400">{errors.star_reward}</p>}
            </div>

            {/* Schedule dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Schedule</label>
              <Select value={resetMode} onValueChange={setResetMode}>
                <SelectTrigger className="bg-[#0f1e33] border-[#1e3a5f] text-slate-200 focus:ring-blue-500/30 focus:border-blue-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155]">
                  {SCHEDULE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-slate-200 focus:bg-[#293548] focus:text-slate-100">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-base"
              >
                {loading ? (task ? 'Saving...' : 'Adding...') : (task ? 'Save Changes' : 'Add Task')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={loading}
                className="w-full text-slate-400 hover:text-slate-200 hover:bg-white/5"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
