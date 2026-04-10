import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { tasksAPI } from '@/api/tasks';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import AppearancePicker from '@/components/common/AppearancePicker';
import { Star } from 'lucide-react';
import {
  Trophy, Gift, Book, Home, Utensils, Car, Shirt,
  Dumbbell, Scissors, Bike, Music, Gamepad, Apple, Briefcase,
  PiggyBank, Lightbulb, Heart, Smile, GraduationCap, Wrench
} from 'lucide-react';

const ICON_MAP = {
  Trophy, Star, Gift, Book, Home, Utensils, Car, Shirt,
  Dumbbell, Scissors, Bike, Music, Gamepad, Apple, Briefcase,
  PiggyBank, Lightbulb, Heart, Smile, GraduationCap, Wrench
};

export function TaskDialog({ isOpen, onClose, childId, profileId, onSuccess, task = null }) {
  const { user } = useAuth();
  const { currentProfile } = useProfile();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    star_reward: 1,
    icon: 'Star',
    color: '#52A5CE'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        star_reward: task.star_reward || 1,
        icon: task.icon || 'Star',
        color: task.color || '#52A5CE'
      });
    } else {
      setFormData({
        title: '',
        description: '',
        star_reward: 1,
        icon: 'Star',
        color: '#52A5CE'
      });
    }
  }, [task]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }

    if (formData.star_reward < 1 || !Number.isInteger(Number(formData.star_reward))) {
      newErrors.star_reward = 'Star reward must be a positive integer';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const parentProfileId = profileId || currentProfile?.id;

      if (!parentProfileId) {
        toast.error(`Unable to ${task ? 'update' : 'create'} task: Profile not found`);
        return;
      }

      if (task) {
        await tasksAPI.updateTask(task.id, {
          title: formData.title,
          description: formData.description || null,
          star_reward: parseInt(formData.star_reward),
          icon: formData.icon,
          color: formData.color
        });
        toast.success(`Task "${formData.title}" updated`);
      } else {
        await tasksAPI.createTask(parentProfileId, {
          assigned_to_child_id: childId,
          title: formData.title,
          description: formData.description || null,
          star_reward: parseInt(formData.star_reward),
          icon: formData.icon,
          color: formData.color,
          frequency: 'always_available',
          repeatable: true,
          requires_approval: true,
          created_by_user_id: user.id
        });
        toast.success(`Task "${formData.title}" created`);
      }

      setFormData({
        title: '',
        description: '',
        star_reward: 1,
        icon: 'Star',
        color: '#52A5CE'
      });
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      console.error(`Error ${task ? 'updating' : 'creating'} task:`, error);
      toast.error(`Failed to ${task ? 'update' : 'create'} task`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      star_reward: 1,
      icon: 'Star',
      color: '#52A5CE'
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create Task'}</DialogTitle>
          <DialogDescription>
            {task ? 'Update task details and settings.' : 'Add a new task for your child to complete and earn stars.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Clean your room"
              maxLength={100}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add details about the task..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="star_reward">Star Reward</Label>
            <Input
              id="star_reward"
              type="number"
              min="1"
              step="1"
              value={formData.star_reward}
              onChange={(e) => setFormData({ ...formData, star_reward: e.target.value })}
            />
            {errors.star_reward && (
              <p className="text-sm text-destructive">{errors.star_reward}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Icon & Color</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-12 h-12 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity shadow-sm border border-slate-200"
                  style={{ backgroundColor: formData.color }}
                >
                  {(() => {
                    const IconComp = ICON_MAP[formData.icon] || Star;
                    return <IconComp className="w-6 h-6 text-white" />;
                  })()}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <AppearancePicker
                  inline
                  useTabs
                  showPreview
                  color={formData.color}
                  icon={formData.icon}
                  onColorChange={(c) => setFormData({ ...formData, color: c })}
                  onIconChange={(i) => setFormData({ ...formData, icon: i })}
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (task ? 'Updating...' : 'Creating...') : (task ? 'Update Task' : 'Create Task')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
