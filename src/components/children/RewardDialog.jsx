import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsAPI } from '@/api/rewards';
import { supabase } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import AppearancePicker, { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
import { Star, ImagePlus, X } from 'lucide-react';

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

  const stepStars = (delta) => {
    setFormData(prev => ({ ...prev, star_cost: Math.max(1, (parseInt(prev.star_cost) || 1) + delta) }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    else if (formData.title.length > 100) newErrors.title = 'Title must be 100 characters or less';
    if (!formData.star_cost || parseInt(formData.star_cost) < 1) newErrors.star_cost = 'Must be at least 1';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
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
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
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

  const IconComp = PICKER_ICON_MAP[formData.icon] || PICKER_ICON_MAP['Gift'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Reward' : 'New Reward'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto flex-1 px-1 pb-1">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Extra screen time"
              maxLength={100}
              autoFocus={!isEditing}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add details about the reward..."
              rows={2}
            />
          </div>

          {!imagePreview && (
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
          )}

          <div className="space-y-1.5">
            <Label>Star Cost</Label>
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
                  value={formData.star_cost}
                  onChange={(e) => setFormData({ ...formData, star_cost: e.target.value })}
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
            {errors.star_cost && <p className="text-xs text-destructive">{errors.star_cost}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Image <span className="text-slate-400 font-normal">(optional)</span></Label>
            <p className="text-xs text-muted-foreground">Upload an image to replace the icon. Max 5MB.</p>
            {imagePreview ? (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                <img src={imagePreview} alt="Reward preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                <span className="text-xs">Upload</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
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
