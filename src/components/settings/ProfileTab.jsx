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
import { Camera, Loader2 } from 'lucide-react';

export default function ProfileTab() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
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
            full_name: profile.full_name || '',
            phone: profile.phone || '',
            bio: profile.bio || '',
            avatar_url: profile.avatar_url || ''
          });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
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

      await upsertUserProfile(user.id, {
        ...formData,
        email: user.email,
        avatar_url: avatarUrl
      });

      setFormData(prev => ({
        ...prev,
        avatar_url: avatarUrl
      }));

      toast.success('Profile photo updated');
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload profile photo');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    if (!formData.full_name.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }

    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsSaving(true);
    try {
      await upsertUserProfile(user.id, {
        ...formData,
        full_name: formData.full_name.trim(),
        email: user.email
      });

      toast.success('Profile updated successfully');
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = () => {
    if (!formData.full_name) return user?.email?.charAt(0).toUpperCase() || '?';
    const names = formData.full_name.split(' ');
    if (names.length >= 2) {
      return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
    }
    return formData.full_name.substring(0, 2).toUpperCase();
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
                <AvatarImage src={formData.avatar_url} alt={formData.full_name} />
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
              <h3 className="font-semibold text-lg">{formData.full_name || 'Set your name'}</h3>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <p className="text-xs text-slate-400 mt-1">
                Click the camera icon to upload a profile photo (max 5MB)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                disabled={isLoading}
              />
            </div>

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
