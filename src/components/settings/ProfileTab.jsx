import { useState, useRef } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { toast } from 'sonner';
import { updateUserProfile, uploadAvatar, deleteAvatar, upsertUserProfile } from '../../api/userSettings';

export default function ProfileTab({ user, profile, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    email: profile?.email || user?.email || '',
    phone: profile?.phone || '',
    bio: profile?.bio || '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image');
      return;
    }

    setUploading(true);
    try {
      if (profile?.avatar_url) {
        await deleteAvatar(profile.avatar_url);
      }

      const avatarUrl = await uploadAvatar(user.id, file);

      const updatedProfile = await upsertUserProfile(user.id, {
        ...formData,
        avatar_url: avatarUrl
      });

      onUpdate(updatedProfile);
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url) return;

    setUploading(true);
    try {
      await deleteAvatar(profile.avatar_url);

      const updatedProfile = await updateUserProfile(user.id, {
        avatar_url: null
      });

      onUpdate(updatedProfile);
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      toast.success('Avatar removed successfully');
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Failed to remove avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (user.id === 'demo') {
      toast.info('Demo mode: Changes are not saved');
      onUpdate({ ...profile, ...formData });
      return;
    }

    setLoading(true);

    try {
      const updatedProfile = await upsertUserProfile(user.id, formData);
      onUpdate(updatedProfile);
      window.dispatchEvent(new CustomEvent('profileUpdated'));
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your personal information and profile picture
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile?.avatar_url} alt={formData.full_name} />
                <AvatarFallback>{getInitials(formData.full_name)}</AvatarFallback>
              </Avatar>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAvatarClick}
                disabled={uploading}
              >
                <Camera className="h-4 w-4 mr-2" />
                Change Avatar
              </Button>
              {profile?.avatar_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Avatar
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Email changes must be done through the Security tab
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Enter your phone number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Tell us about yourself"
              rows={4}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
