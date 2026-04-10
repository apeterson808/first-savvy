import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsAPI } from '@/api/rewards';
import { supabase } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import AppearancePicker, { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
import { ImagePlus, X } from 'lucide-react';

const DEFAULT_FORM = {
  title: '',
  description: '',
  star_cost: 10,
  icon: 'Gift',
  color: '#EFCE7B',
  image_url: null,
};

export function RewardDialog({ isOpen, onClose, profileId, childId, onSuccess, reward }) {
  const { user } = useAuth();
  const isEditing = !!reward;
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (reward) {
        setFormData({
          title: reward.title || '',
          description: reward.description || '',
          star_cost: reward.star_cost || 10,
          icon: reward.icon || 'Gift',
          color: reward.color || '#EFCE7B',
          image_url: reward.image_url || null,
        });
        setImagePreview(reward.image_url || null);
      } else {
        setFormData(DEFAULT_FORM);
        setImagePreview(null);
      }
      setImageFile(null);
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

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image_url: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (file) => {
    const ext = file.name.split('.').pop();
    const path = `rewards/${user.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    return publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      let image_url = formData.image_url;

      if (imageFile) {
        setUploadingImage(true);
        image_url = await uploadImage(imageFile);
        setUploadingImage(false);
      }

      const payload = {
        title: formData.title,
        description: formData.description || null,
        star_cost: parseInt(formData.star_cost),
        icon: formData.icon,
        color: formData.color,
        image_url: image_url || null,
      };

      if (isEditing) {
        await rewardsAPI.updateReward(reward.id, payload);
        toast.success(`Reward "${formData.title}" updated`);
      } else {
        await rewardsAPI.createReward(profileId, {
          ...payload,
          assigned_to_child_id: childId,
          status: 'available',
          created_by_user_id: user.id,
        });
        toast.success(`Reward "${formData.title}" created`);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving reward:', error);
      setUploadingImage(false);
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} reward`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const IconComp = PICKER_ICON_MAP[formData.icon] || PICKER_ICON_MAP['Gift'];

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
            <Label>Image (optional)</Label>
            <p className="text-xs text-slate-500">Upload an image to replace the icon. Max 5MB.</p>

            {imagePreview ? (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                <img
                  src={imagePreview}
                  alt="Reward preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-xs">Upload</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>

          {!imagePreview && (
            <div className="space-y-2">
              <Label>Icon & Color</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-12 h-12 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity shadow-sm border border-slate-200"
                    style={{ backgroundColor: formData.color }}
                  >
                    <IconComp className="w-6 h-6 text-white" />
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
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {uploadingImage ? 'Uploading...' : loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Reward')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
