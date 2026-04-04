import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { tasksAPI } from '@/api/tasks';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trophy, Star, Gift, Book, Home, Utensils, Car, Shirt,
  Dumbbell, Scissors, Bike, Music, Gamepad, Apple, Briefcase,
  PiggyBank, Lightbulb, Heart, Smile, GraduationCap, Wrench
} from 'lucide-react';

const TASK_ICONS = {
  Trophy, Star, Gift, Book, Home, Utensils, Car, Shirt,
  Dumbbell, Scissors, Bike, Music, Gamepad, Apple, Briefcase,
  PiggyBank, Lightbulb, Heart, Smile, GraduationCap, Wrench
};

const TASK_ICON_NAMES = Object.keys(TASK_ICONS);

const TASK_COLORS = [
  { name: 'Blue', hex: '#52A5CE' },
  { name: 'Green', hex: '#4DB8A8' },
  { name: 'Orange', hex: '#EF6F3C' },
  { name: 'Purple', hex: '#C8B6E2' },
  { name: 'Red', hex: '#FF7BAC' },
  { name: 'Yellow', hex: '#EFCE7B' },
  { name: 'Teal', hex: '#4DB8A8' },
  { name: 'Coral', hex: '#FF9B82' }
];

export function TaskDialog({ isOpen, onClose, childId, onSuccess }) {
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
  const [activeTab, setActiveTab] = useState('icon');

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
      await tasksAPI.createTask(currentProfile.id, {
        assigned_to_child_id: childId,
        title: formData.title,
        description: formData.description || null,
        star_reward: parseInt(formData.star_reward),
        icon: formData.icon,
        color: formData.color,
        frequency: 'one_time',
        repeatable: false,
        requires_approval: true,
        created_by_user_id: user.id
      });

      toast.success(`Task "${formData.title}" created`);

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
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
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

  const SelectedIcon = TASK_ICONS[formData.icon] || Star;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Add a new task for your child to complete and earn stars.
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
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex items-center justify-center w-12 h-12 rounded-lg"
                style={{ backgroundColor: formData.color }}
              >
                <SelectedIcon className="w-6 h-6 text-white" />
              </div>
              <div className="text-sm text-muted-foreground">
                Preview
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="icon">Icon</TabsTrigger>
                <TabsTrigger value="color">Color</TabsTrigger>
              </TabsList>

              <TabsContent value="icon" className="mt-3">
                <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                  {TASK_ICON_NAMES.map((iconName) => {
                    const IconComponent = TASK_ICONS[iconName];
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: iconName })}
                        className={`p-2 rounded-md border-2 hover:bg-accent transition-colors ${
                          formData.icon === iconName
                            ? 'border-primary bg-accent'
                            : 'border-transparent'
                        }`}
                      >
                        <IconComponent className="w-5 h-5 mx-auto" />
                      </button>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="color" className="mt-3">
                <div className="grid grid-cols-4 gap-2">
                  {TASK_COLORS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.hex })}
                      className={`h-12 rounded-md border-2 transition-all ${
                        formData.color === color.hex
                          ? 'border-primary scale-105'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
