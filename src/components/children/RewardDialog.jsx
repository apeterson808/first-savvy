import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsAPI } from '@/api/rewards';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import AppearancePicker, { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';

const DEFAULT_FORM = {
  title: '',
  description: '',
  star_cost: 10,
  icon: 'Gift',
  color: '#EFCE7B'
};

export function RewardDialog({ isOpen, onClose, profileId, childId, onSuccess, reward }) {
  const { user } = useAuth();
  const isEditing = !!reward;
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (reward) {
        setFormData({
          title: reward.title || '',
          description: reward.description || '',
          star_cost: reward.star_cost || 10,
          icon: reward.icon || 'Gift',
          color: reward.color || '#EFCE7B',
        });
      } else {
        setFormData(DEFAULT_FORM);
      }
      setErrors({});
    }
  }, [isOpen, reward]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }

    if (formData.star_cost < 1 || !Number.isInteger(Number(formData.star_cost))) {
      newErrors.star_cost = 'Star cost must be a positive integer';
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
      if (isEditing) {
        await rewardsAPI.updateReward(reward.id, {
          title: formData.title,
          description: formData.description || null,
          star_cost: parseInt(formData.star_cost),
          icon: formData.icon,
          color: formData.color,
        });
        toast.success(`Reward "${formData.title}" updated`);
      } else {
        await rewardsAPI.createReward(profileId, {
          title: formData.title,
          description: formData.description || null,
          star_cost: parseInt(formData.star_cost),
          icon: formData.icon,
          color: formData.color,
          assigned_to_child_id: childId,
          status: 'available',
          created_by_user_id: user.id
        });
        toast.success(`Reward "${formData.title}" created`);
      }

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      console.error('Error saving reward:', error);
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} reward`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Reward' : 'Create Reward'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the details for this reward.'
              : 'Add a new reward that your child can redeem with stars.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Extra screen time"
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
              placeholder="Add details about the reward..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="star_cost">Star Cost</Label>
            <Input
              id="star_cost"
              type="number"
              min="1"
              step="1"
              value={formData.star_cost}
              onChange={(e) => setFormData({ ...formData, star_cost: e.target.value })}
            />
            {errors.star_cost && (
              <p className="text-sm text-destructive">{errors.star_cost}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Icon & Color</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-12 h-12 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity shadow-sm border border-slate-200"
                  style={{ backgroundColor: formData.color }}
                >
                  {(() => {
                    const IconComp = PICKER_ICON_MAP[formData.icon] || PICKER_ICON_MAP['Gift'];
                    return <IconComp className="w-6 h-6 text-white" />;
                  })()}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <AppearancePicker
                  inline
                  useTabs
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
              {loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Reward')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
