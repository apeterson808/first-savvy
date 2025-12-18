import { useState, useEffect } from 'react';
import { User, Lock, Settings as SettingsIcon, Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { supabase } from '../api/supabaseClient';
import { getUserProfile } from '../api/userSettings';
import ProfileTab from '../components/settings/ProfileTab';
import SecurityTab from '../components/settings/SecurityTab';
import PreferencesTab from '../components/settings/PreferencesTab';
import NotificationsTab from '../components/settings/NotificationsTab';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        const userProfile = await getUserProfile(authUser.id);
        setProfile(userProfile);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = (updatedProfile) => {
    setProfile(updatedProfile);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab user={user} profile={profile} onUpdate={handleProfileUpdate} />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab user={user} />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab profile={profile} onUpdate={handleProfileUpdate} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab profile={profile} onUpdate={handleProfileUpdate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
