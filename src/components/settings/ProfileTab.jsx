import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, upsertUserProfile, uploadAvatar, deleteAvatar } from '@/api/userSettings';
import { toast } from 'sonner';
import { Camera, Loader2, RefreshCw } from 'lucide-react';

export default function ProfileTab() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    phone: '',
    bio: '',
    avatar_url: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const profile = await getUserProfile(user.id);
        if (profile) {
          setFormData({
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            display_name: profile.display_name || '',
            phone: profile.phone || '',
            bio: profile.bio || '',
            avatar_url: profile.avatar_url || ''
          });
        }
      } catch (error) {
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user?.id]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAutoFillDisplayName = () => {
    const autoFilled = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
    if (!autoFilled) {
      toast.error('Please enter your first name first');
      return;
    }
    setFormData(prev => ({
      ...prev,
      display_name: autoFilled
    }));
    toast.success('Display name auto-filled');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      if (formData.avatar_url) {
        await deleteAvatar(formData.avatar_url);
      }

      const avatarUrl = await uploadAvatar(user.id, file);
      const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
      const displayName = formData.display_name.trim() || fullName;

      await upsertUserProfile(user.id, {
        ...formData,
        email: user.email,
        avatar_url: avatarUrl,
        display_name: displayName,
        full_name: fullName
      });

      setFormData(prev => ({
        ...prev,
        avatar_url: avatarUrl
      }));

      toast.success('Profile photo updated');
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error) {
      toast.error('Failed to upload profile photo');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    if (!formData.first_name.trim()) {
      toast.error('First name cannot be empty');
      return;
    }

    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsSaving(true);
    try {
      const fullName = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim();
      const displayName = formData.display_name.trim() || fullName;

      await upsertUserProfile(user.id, {
        ...formData,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        display_name: displayName,
        full_name: fullName,
        email: user.email
      });

      toast.success('Profile updated successfully');
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = () => {
    if (!formData.first_name) return user?.email?.charAt(0).toUpperCase() || '?';

    const firstInitial = formData.first_name.charAt(0).toUpperCase();
    const lastInitial = formData.last_name ? formData.last_name.charAt(0).toUpperCase() : '';

    return lastInitial ? `${firstInitial}${lastInitial}` : firstInitial;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Manage your personal information and profile settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={formData.avatar_url}
                  alt={formData.display_name || `${formData.first_name} ${formData.last_name}`.trim() || 'Profile'}
                />
                <AvatarFallback className="text-2xl bg-blue-100 text-blue-700">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar || isLoading}
                className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-colors"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">
                {formData.display_name ||
                  (formData.first_name || formData.last_name
                    ? `${formData.first_name} ${formData.last_name}`.trim()
                    : 'Set your name')}
              </h3>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <p className="text-xs text-slate-400 mt-1">
                Click the camera icon to upload a profile photo (max 5MB)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="John"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="displayName"
                placeholder="How you want to appear in the app"
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAutoFillDisplayName}
                disabled={isLoading}
                className="shrink-0"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Auto-fill
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              This is how your name appears throughout the app. Leave blank to use your full name.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-slate-50"
              />
              <p className="text-xs text-slate-500">
                Email cannot be changed here. Contact support to update.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500">
                Used for two-factor authentication and account recovery
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us a little about yourself..."
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              disabled={isLoading}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-slate-500 text-right">
              {formData.bio.length}/500 characters
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="min-w-32"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
          <CardDescription>
            Help us personalize your experience (coming soon)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" disabled placeholder="MM/DD/YYYY" />
            </div>

            <div className="space-y-2">
              <Label>Occupation</Label>
              <Input disabled placeholder="e.g., Software Engineer" />
            </div>

            <div className="space-y-2">
              <Label>Annual Income Range</Label>
              <Input disabled placeholder="e.g., $50,000 - $75,000" />
            </div>

            <div className="space-y-2">
              <Label>Primary Financial Goal</Label>
              <Input disabled placeholder="e.g., Save for retirement" />
            </div>
          </div>
          <p className="text-sm text-slate-500">
            These fields will be available in a future update to help with financial planning and budgeting recommendations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
