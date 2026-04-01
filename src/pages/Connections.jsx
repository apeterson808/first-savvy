import { useState, useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search, Plus, Calendar, Briefcase, Home, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';
import { CreateChildProfileSheet } from '@/components/profiles/CreateChildProfileSheet';
import { EditChildProfileSheet } from '@/components/profiles/EditChildProfileSheet';
import { DeleteConfirmationDialog } from '@/components/profiles/DeleteConfirmationDialog';
import { ProfileTypeSelector } from '@/components/profiles/ProfileTypeSelector';
import { CreateProfileDialog } from '@/components/profiles/CreateProfileDialog';
import { formatCurrency } from '@/components/utils/formatters';
import { differenceInYears } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Connections() {
  const { switchProfile, activeProfile } = useProfile();
  const [childProfiles, setChildProfiles] = useState([]);
  const [businessProfiles, setBusinessProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [showProfileTypeSelector, setShowProfileTypeSelector] = useState(false);
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);

  const [showEditChild, setShowEditChild] = useState(false);
  const [showDeleteChild, setShowDeleteChild] = useState(false);

  useEffect(() => {
    loadAllProfiles();
  }, []);

  const loadAllProfiles = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('profile_type', 'personal')
        .eq('is_deleted', false)
        .single();

      if (!ownerProfile) return;

      const { data: children, error: childrenError } = await supabase
        .from('child_profiles')
        .select('*')
        .eq('parent_profile_id', ownerProfile.id)
        .order('child_name', { ascending: true });

      if (childrenError) throw childrenError;

      const { data: businesses, error: businessError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('profile_type', 'business')
        .eq('is_deleted', false)
        .order('display_name', { ascending: true });

      if (businessError) throw businessError;

      setChildProfiles(children || []);
      setBusinessProfiles(businesses || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChild = async (child) => {
    try {
      const { data: virtualProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', child.owned_by_profile_id)
        .single();

      if (virtualProfile) {
        await switchProfile(virtualProfile);
        toast.success(`Switched to ${child.child_name}`);
      }
    } catch (error) {
      console.error('Error switching to child profile:', error);
      toast.error('Failed to switch profile');
    }
  };

  const handleOpenBusiness = async (business) => {
    try {
      await switchProfile(business);
      toast.success(`Switched to ${business.display_name}`);
    } catch (error) {
      console.error('Error switching to business profile:', error);
      toast.error('Failed to switch profile');
    }
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

  const handleSelectProfileType = (type) => {
    if (type === 'child') {
      setShowCreateChild(true);
    } else if (type === 'business') {
      setShowCreateBusiness(true);
    }
  };

  const filterChildren = (children) => {
    if (!searchQuery) return children;
    return children.filter(child =>
      child.child_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filterBusinesses = (businesses) => {
    if (!searchQuery) return businesses;
    return businesses.filter(business =>
      business.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    return differenceInYears(new Date(), new Date(dateOfBirth));
  };

  const getTierInfo = (level) => {
    const tiers = {
      1: { name: 'Basic Access', color: 'bg-slate-100 text-slate-700' },
      2: { name: 'Rewards', color: 'bg-blue-100 text-blue-700' },
      3: { name: 'Money', color: 'bg-green-100 text-green-700' },
    };
    return tiers[level] || tiers[1];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading child profiles...</p>
        </div>
      </div>
    );
  }

  const filteredChildren = filterChildren(childProfiles);
  const filteredBusinesses = filterBusinesses(businessProfiles);
  const activeChildren = childProfiles.filter(c => c.is_active);
  const totalProfiles = childProfiles.length + businessProfiles.length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowProfileTypeSelector(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Profile
        </Button>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Home className="h-5 w-5 text-blue-600" />
            Family ({childProfiles.length})
          </h2>
          {filteredChildren.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="mt-4 text-lg font-semibold">No family profiles</h3>
                  <p className="mt-2 text-slate-600">
                    {searchQuery
                      ? 'No family members match your search'
                      : 'Create profiles for family members to give them access to their own financial dashboard'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setShowProfileTypeSelector(true)} className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Profile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredChildren.map((child) => {
              const age = getAge(child.date_of_birth);
              const initials = child.child_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <Card
                  key={child.id}
                  className="hover:shadow-md transition-shadow cursor-pointer relative group"
                >
                  <CardContent className="pt-4 pb-3 px-3" onClick={() => handleOpenChild(child)}>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleEditChild(child);
                          }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChild(child);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-col items-center text-center gap-2">
                      <Avatar className="w-14 h-14">
                        <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-lg">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="w-full">
                        <h3 className="font-semibold text-sm truncate">{child.child_name}</h3>
                        {age && (
                          <p className="text-xs text-slate-600">
                            Age {age}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          Tier {child.current_permission_level}
                        </p>
                      </div>
                      {!child.is_active && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-orange-600" />
            Business
          </h2>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Briefcase className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-4 text-lg font-semibold">Coming Soon</h3>
                <p className="mt-2 text-slate-600">
                  Business profiles will be available in a future update
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ProfileTypeSelector
        open={showProfileTypeSelector}
        onOpenChange={setShowProfileTypeSelector}
        onSelectType={handleSelectProfileType}
      />

      <CreateChildProfileSheet
        open={showCreateChild}
        onOpenChange={setShowCreateChild}
        onChildCreated={() => {
          loadAllProfiles();
        }}
        profileId={activeProfile?.id}
      />

      <CreateProfileDialog
        open={showCreateBusiness}
        onOpenChange={setShowCreateBusiness}
        onProfileCreated={() => {
          loadAllProfiles();
        }}
        profileType="business"
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
