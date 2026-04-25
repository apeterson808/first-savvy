import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsAPI } from '@/api/rewards';
import { supabase } from '@/api/supabaseClient';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import AppearancePicker, { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
import { Gift, Star, ImagePlus, X } from 'lucide-react';

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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-3xl overflow-y-auto bg-[#0f172a] border-[#1e293b] px-0 pb-0">
        <div className="px-6 pb-10 space-y-5">
          <SheetHeader className="pt-2 pb-0">
            <SheetTitle className="flex items-center gap-2 text-slate-100 text-xl font-bold">
              {isEditing ? (
                <span>Edit Reward</span>
              ) : (
                <>
                  <Gift className="w-5 h-5 text-amber-400" />
                  <span>New Reward</span>
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
                placeholder="Reward name"
                maxLength={100}
                autoFocus={!isEditing}
                className="bg-[#0f1e33] border-[#1e3a5f] text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50"
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
                className="bg-[#0f1e33] border-[#1e3a5f] text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 resize-none"
              />
            </div>

            {/* Icon & Color row — only shown when no image uploaded */}
            {!imagePreview && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Icon & Color</label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0f1e33] border border-[#1e3a5f] hover:border-amber-500/40 transition-colors"
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
            )}

            {/* Image upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Image (optional)</label>
              <p className="text-xs text-slate-500">Upload an image to replace the icon. Max 5MB.</p>
              {imagePreview ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#1e3a5f] group">
                  <img src={imagePreview} alt="Reward preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-[#334155] flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                >
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-xs">Upload</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>

            {/* Star cost stepper */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Star Cost</label>
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
                    value={formData.star_cost}
                    onChange={(e) => setFormData({ ...formData, star_cost: e.target.value })}
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
              {errors.star_cost && <p className="text-xs text-red-400">{errors.star_cost}</p>}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-base"
              >
                {uploadingImage ? 'Uploading...' : loading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Reward')}
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
