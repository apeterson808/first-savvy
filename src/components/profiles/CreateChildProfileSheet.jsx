import { useState, useEffect } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { differenceInYears } from 'date-fns';
import { Pencil, Check, X, Loader2 as LoaderIcon } from 'lucide-react';

const CUSTOM_COLOR_PALETTE = [
  { name: 'Tea Green', hex: '#AACC96' },
  { name: 'Forest', hex: '#25533F' },
  { name: 'Peach Frost', hex: '#F4BEAE' },
  { name: 'Blueberry', hex: '#52A5CE' },
  { name: 'Bubblegum', hex: '#FF7BAC' },
  { name: 'Dry Earth', hex: '#876029' },
  { name: 'Grape Juice', hex: '#6D1F42' },
  { name: 'Lilacs', hex: '#D3B6D3' },
  { name: 'Butter Yellow', hex: '#EFCE7B' },
  { name: 'Iced Blue', hex: '#B8CEE8' },
  { name: 'Blood Orange', hex: '#EF6F3C' },
  { name: 'Olive Green', hex: '#AFAB23' },
  { name: 'Coral', hex: '#FF9B82' },
  { name: 'Teal', hex: '#4DB8A8' },
  { name: 'Soft Lavender', hex: '#C8B6E2' },
  { name: 'Terracotta', hex: '#D67F5E' },
  { name: 'Sage', hex: '#88B69D' },
  { name: 'Dusty Rose', hex: '#D4A5A5' }
];

export function CreateChildProfileSheet({ open, onOpenChange, onChildCreated, profileId }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    date_of_birth: '',
    sex: '',
    avatar: { icon: 'Circle', color: '#52A5CE' },
    notes: '',
    username: '',
    email: '',
    pin: '',
  });
  const [loading, setLoading] = useState(false);
  const [age, setAge] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('color');
  const [uploading, setUploading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const getInitials = () => {
    const first = formData.first_name?.trim() || '';
    const last = formData.last_name?.trim() || '';
    if (!first && !last) return '';
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${profileId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { supabase } = await import('@/api/supabaseClient');

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData({
        ...formData,
        avatar: { ...formData.avatar, imageUrl: publicUrl }
      });

      toast.success('Image uploaded successfully');
      setPopoverOpen(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (formData.date_of_birth) {
      const birthDate = new Date(formData.date_of_birth);
      const calculatedAge = differenceInYears(new Date(), birthDate);
      setAge(calculatedAge);
    } else {
      setAge(null);
    }
  }, [formData.date_of_birth]);

  useEffect(() => {
    if (!formData.username || formData.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const checkUsername = async () => {
      setCheckingUsername(true);
      try {
        const result = await childProfilesAPI.checkUsernameAvailability(formData.username);
        setUsernameAvailable(result.available);
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.username]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.first_name.trim()) {
      toast.error('Please enter first name');
      return;
    }

    if (!formData.last_name.trim()) {
      toast.error('Please enter last name');
      return;
    }

    if (formData.first_name.length < 2 || formData.first_name.length > 50) {
      toast.error('First name must be between 2 and 50 characters');
      return;
    }

    if (formData.last_name.length < 2 || formData.last_name.length > 50) {
      toast.error('Last name must be between 2 and 50 characters');
      return;
    }

    if (!formData.username || formData.username.length < 3) {
      toast.error('Username is required and must be at least 3 characters');
      return;
    }

    if (!usernameAvailable) {
      toast.error('Username is not available');
      return;
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('Please enter a valid email address');
        return;
      }
    }

    if (!formData.pin || formData.pin.length !== 4 || !/^\d{4}$/.test(formData.pin)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    try {
      setLoading(true);
      const childProfile = await childProfilesAPI.createChildProfile(profileId, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        child_name: `${formData.first_name} ${formData.last_name}`,
        display_name: formData.display_name || null,
        date_of_birth: formData.date_of_birth || null,
        sex: formData.sex || null,
        avatar: formData.avatar,
        notes: formData.notes || null,
        username: formData.username,
        email: formData.email,
        login_enabled: true,
      });

      await childProfilesAPI.setChildPin(childProfile.id, formData.pin);

      setFormData({
        first_name: '',
        last_name: '',
        display_name: '',
        date_of_birth: '',
        sex: '',
        avatar: { icon: 'Circle', color: '#52A5CE' },
        notes: '',
        username: '',
        email: '',
        pin: '',
      });

      toast.success('Child profile and login account created successfully');
      onOpenChange(false);
      if (onChildCreated) {
        onChildCreated();
      }
    } catch (error) {
      console.error('Error creating child profile:', error);
      toast.error(error.message || 'Failed to create child profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Child Profile</SheetTitle>
          <SheetDescription>
            Create a child profile to teach financial responsibility
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
                  style={{ backgroundColor: formData.avatar?.color || '#52A5CE' }}
                >
                  {formData.avatar?.imageUrl ? (
                    <img
                      src={formData.avatar.imageUrl}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials()
                  )}
                </div>

                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="absolute bottom-0 right-0 w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4" align="start">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="w-full grid grid-cols-2">
                        <TabsTrigger value="color">Color</TabsTrigger>
                        <TabsTrigger value="image">Image</TabsTrigger>
                      </TabsList>

                      <TabsContent value="color" className="mt-4">
                        <div className="space-y-3">
                          <p className="text-sm text-slate-600">Choose a background color</p>
                          <div className="grid grid-cols-6 gap-2">
                            {CUSTOM_COLOR_PALETTE.map((colorOption) => (
                              <button
                                key={colorOption.hex}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, avatar: { ...formData.avatar, color: colorOption.hex } });
                                }}
                                className={`w-10 h-10 rounded-full border-2 transition-all ${
                                  formData.avatar?.color === colorOption.hex
                                    ? 'border-slate-800 scale-110'
                                    : 'border-slate-300 hover:scale-105 hover:border-slate-400'
                                }`}
                                style={{ backgroundColor: colorOption.hex }}
                              />
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="image" className="mt-4">
                        <div className="space-y-3">
                          {formData.avatar?.imageUrl && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                              <img
                                src={formData.avatar.imageUrl}
                                alt="Current avatar"
                                className="w-12 h-12 rounded-full object-cover"
                              />
                              <div className="flex-1 text-sm text-slate-600">
                                Current image
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setFormData({ ...formData, avatar: { ...formData.avatar, imageUrl: null } });
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          )}

                          <label htmlFor="avatar-upload">
                            <input
                              id="avatar-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                              disabled={uploading}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById('avatar-upload')?.click()}
                              disabled={uploading}
                              className="w-full"
                            >
                              {uploading ? 'Uploading...' : formData.avatar?.imageUrl ? 'Change Image' : 'Upload Image'}
                            </Button>
                          </label>
                          <p className="text-xs text-slate-500 text-center">
                            JPG, PNG or GIF (max 5MB)
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="first-name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Enter first name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last-name">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="last-name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Enter last name"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder={`${formData.first_name} ${formData.last_name}`.trim() || 'Display name'}
              />
              <p className="text-xs text-slate-500">
                Leave blank to use first and last name
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-of-birth">Date of Birth</Label>
                <Input
                  id="date-of-birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
                {age !== null && (
                  <p className="text-sm text-slate-500">Age: {age} years old</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select
                  value={formData.sex}
                  onValueChange={(value) => setFormData({ ...formData, sex: value })}
                >
                  <SelectTrigger id="sex">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Login Credentials</h3>
              <p className="text-sm text-slate-500 mt-1">
                Set up a username and PIN for your child to log in directly
              </p>
            </div>

            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      placeholder="username"
                      className="font-mono"
                      maxLength={20}
                      required
                    />
                    {formData.username.length >= 3 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checkingUsername ? (
                          <LoaderIcon className="h-4 w-4 animate-spin text-slate-400" />
                        ) : usernameAvailable ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                  {formData.username.length > 0 && formData.username.length < 3 && (
                    <p className="text-xs text-slate-500">Must be at least 3 characters</p>
                  )}
                  {formData.username.length >= 3 && usernameAvailable === false && (
                    <p className="text-xs text-red-600">Username is already taken</p>
                  )}
                  {formData.username.length >= 3 && usernameAvailable === true && (
                    <p className="text-xs text-green-600">Username is available</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pin">
                    PIN (4 digits) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pin"
                    type="text"
                    inputMode="numeric"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="1234"
                    maxLength={4}
                    className="text-center text-lg tracking-widest font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="child@example.com"
                />
                <p className="text-xs text-slate-500">Can be used as an alternative login method</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this child's profile..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creating...' : 'Create Profile'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
