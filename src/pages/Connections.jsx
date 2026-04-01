import { useState, useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Briefcase, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';
import { ProfileCard } from '@/components/profiles/ProfileCard';
import { CreateProfileDialog } from '@/components/profiles/CreateProfileDialog';
import { CreateChildProfileSheet } from '@/components/profiles/CreateChildProfileSheet';
import { EditProfileDialog } from '@/components/profiles/EditProfileDialog';
import { EditChildProfileSheet } from '@/components/profiles/EditChildProfileSheet';
import { DeleteConfirmationDialog } from '@/components/profiles/DeleteConfirmationDialog';

export default function Connections() {
  const { switchProfile } = useProfile();
  const [familyProfiles, setFamilyProfiles] = useState([]);
  const [businessProfiles, setBusinessProfiles] = useState([]);
  const [childProfilesMap, setChildProfilesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [showDeleteProfile, setShowDeleteProfile] = useState(false);
  const [showDeleteChild, setShowDeleteChild] = useState(false);

  useEffect(() => {
    loadAllProfiles();
  }, []);

  const loadAllProfiles = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const family = profiles.filter(p => p.profile_type === 'household');
      const business = profiles.filter(p => p.profile_type === 'business');

      setFamilyProfiles(family);
      setBusinessProfiles(business);

      const childrenMap = {};
      for (const profile of family) {
        try {
          const children = await childProfilesAPI.getChildProfiles(profile.id);
          childrenMap[profile.id] = children || [];
        } catch (error) {
          console.error(`Error loading children for profile ${profile.id}:`, error);
          childrenMap[profile.id] = [];
        }
      }
      setChildProfilesMap(childrenMap);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProfile = async (profile) => {
    try {
      await switchProfile(profile);
      toast.success(`Switched to ${profile.display_name}`);
    } catch (error) {
      console.error('Error switching profile:', error);
      toast.error('Failed to switch profile');
    }
  };

  const handleEditProfile = (profile) => {
    setSelectedProfile(profile);
    setShowEditProfile(true);
  };

  const handleDeleteProfile = (profile) => {
    setSelectedProfile(profile);
    setShowDeleteProfile(true);
  };

  const handleConfirmDeleteProfile = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_deleted: true })
        .eq('id', selectedProfile.id);

      if (error) throw error;

      toast.success('Profile deleted successfully');
      await loadAllProfiles();
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast.error('Failed to delete profile');
    }
  };

  const handleAddChild = (profile) => {
    setSelectedProfile(profile);
    setShowCreateChild(true);
  };

  const handleEditChild = (child) => {
    setSelectedChild(child);
    setShowEditChild(true);
  };

  const handleDeleteChild = (child) => {
    setSelectedChild(child);
    setShowDeleteChild(true);
  };

  const handleConfirmDeleteChild = async () => {
    try {
      await childProfilesAPI.deleteChildProfile(selectedChild.id);
      toast.success('Child profile deleted successfully');
      await loadAllProfiles();
    } catch (error) {
      console.error('Error deleting child profile:', error);
      toast.error('Failed to delete child profile');
    }
  };

  const filterProfiles = (profiles) => {
    if (!searchQuery) return profiles;
    return profiles.filter(profile =>
      profile.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading profiles...</p>
        </div>
      </div>
    );
  }

  const filteredFamily = filterProfiles(familyProfiles);
  const filteredBusiness = filterProfiles(businessProfiles);
  const totalProfiles = familyProfiles.length + businessProfiles.length;
  const totalChildren = Object.values(childProfilesMap).reduce((sum, children) => sum + children.length, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Connections</h1>
          <p className="text-slate-600 mt-1">
            Manage your Family and Business profiles
          </p>
        </div>
        <Button onClick={() => setShowCreateProfile(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Profiles</p>
                <p className="text-2xl font-bold mt-1">{totalProfiles}</p>
              </div>
              <Users className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Family Profiles</p>
                <p className="text-2xl font-bold mt-1">{familyProfiles.length}</p>
              </div>
              <Users className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Business Profiles</p>
                <p className="text-2xl font-bold mt-1">{businessProfiles.length}</p>
              </div>
              <Briefcase className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search profiles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            Family Profiles ({familyProfiles.length})
          </h2>
          {filteredFamily.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-4 text-lg font-semibold">No family profiles</h3>
                  <p className="mt-2 text-slate-600">
                    {searchQuery
                      ? 'No profiles match your search'
                      : 'Create a family profile to manage household finances and child profiles'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setShowCreateProfile(true)} className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Family Profile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredFamily.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  children={childProfilesMap[profile.id] || []}
                  onOpen={handleOpenProfile}
                  onEdit={handleEditProfile}
                  onDelete={handleDeleteProfile}
                  onAddChild={handleAddChild}
                  onEditChild={handleEditChild}
                  onDeleteChild={handleDeleteChild}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-orange-600" />
            Business Profiles ({businessProfiles.length})
          </h2>
          {filteredBusiness.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Briefcase className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-4 text-lg font-semibold">No business profiles</h3>
                  <p className="mt-2 text-slate-600">
                    {searchQuery
                      ? 'No profiles match your search'
                      : 'Create a business profile to manage business finances'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setShowCreateProfile(true)} className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Business Profile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredBusiness.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  children={[]}
                  onOpen={handleOpenProfile}
                  onEdit={handleEditProfile}
                  onDelete={handleDeleteProfile}
                  onAddChild={() => {}}
                  onEditChild={() => {}}
                  onDeleteChild={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateProfileDialog
        open={showCreateProfile}
        onOpenChange={setShowCreateProfile}
        onProfileCreated={() => {
          loadAllProfiles();
        }}
      />

      <CreateChildProfileSheet
        open={showCreateChild}
        onOpenChange={setShowCreateChild}
        onChildCreated={() => {
          loadAllProfiles();
        }}
        profileId={selectedProfile?.id}
      />

      <EditProfileDialog
        open={showEditProfile}
        onOpenChange={setShowEditProfile}
        profile={selectedProfile}
        onProfileUpdated={() => {
          loadAllProfiles();
        }}
      />

      <EditChildProfileSheet
        open={showEditChild}
        onOpenChange={setShowEditChild}
        child={selectedChild}
        onChildUpdated={() => {
          loadAllProfiles();
        }}
      />

      <DeleteConfirmationDialog
        open={showDeleteProfile}
        onOpenChange={setShowDeleteProfile}
        onConfirm={handleConfirmDeleteProfile}
        title="Delete Profile"
        description="This will permanently delete this profile and all associated data."
        confirmText="DELETE"
        warningMessage={
          selectedProfile?.profile_type === 'household' && childProfilesMap[selectedProfile?.id]?.length > 0
            ? `This family profile has ${childProfilesMap[selectedProfile.id].length} child profile(s). Deleting this profile will also delete all child profiles.`
            : 'This action cannot be undone.'
        }
        itemName={selectedProfile?.display_name}
      />

      <DeleteConfirmationDialog
        open={showDeleteChild}
        onOpenChange={setShowDeleteChild}
        onConfirm={handleConfirmDeleteChild}
        title="Delete Child Profile"
        description="This will permanently delete this child profile and all associated data."
        confirmText="DELETE"
        warningMessage="This action cannot be undone. All chores, rewards, and financial data will be lost."
        itemName={selectedChild?.child_name}
      />
    </div>
  );
}
