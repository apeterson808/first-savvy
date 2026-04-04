import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsAPI } from '@/api/rewards';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Gift, Star, Trophy, IceCream, Gamepad, Tv, Book,
  Pizza, Cake, Music, Film, PartyPopper, Heart,
  Sparkles, Crown, Award, Smile, Candy
} from 'lucide-react';

const REWARD_ICONS = {
  Gift, Star, Trophy, IceCream, Gamepad, Tv, Book,
  Pizza, Cake, Music, Film, PartyPopper, Heart,
  Sparkles, Crown, Award, Smile
};

const REWARD_ICON_NAMES = Object.keys(REWARD_ICONS);

const REWARD_COLORS = [
  { name: 'Gold', hex: '#EFCE7B' },
  { name: 'Orange', hex: '#EF6F3C' },
  { name: 'Pink', hex: '#FF7BAC' },
  { name: 'Purple', hex: '#C8B6E2' },
  { name: 'Blue', hex: '#52A5CE' },
  { name: 'Green', hex: '#4DB8A8' },
  { name: 'Coral', hex: '#FF9B82' },
  { name: 'Teal', hex: '#4DB8A8' }
];

export function RewardDialog({ isOpen, onClose, profileId, childId, onSuccess }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    star_cost: 10,
    icon: 'Gift',
    color: '#EFCE7B'
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

      setFormData({
        title: '',
        description: '',
        star_cost: 10,
        icon: 'Gift',
        color: '#EFCE7B'
      });
      setErrors({});

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      console.error('Error creating reward:', error);
      toast.error('Failed to create reward');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      star_cost: 10,
      icon: 'Gift',
      color: '#EFCE7B'
    });
    setErrors({});
    onClose();
  };

  const SelectedIcon = REWARD_ICONS[formData.icon] || Gift;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Reward</DialogTitle>
          <DialogDescription>
            Add a new reward that your child can redeem with stars.
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
                  {REWARD_ICON_NAMES.map((iconName) => {
                    const IconComponent = REWARD_ICONS[iconName];
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
                  {REWARD_COLORS.map((color) => (
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
              {loading ? 'Creating...' : 'Create Reward'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
