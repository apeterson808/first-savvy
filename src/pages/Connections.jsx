import { useState, useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search, Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';
import { CreateChildProfileSheet } from '@/components/profiles/CreateChildProfileSheet';
import { EditChildProfileSheet } from '@/components/profiles/EditChildProfileSheet';
import { DeleteConfirmationDialog } from '@/components/profiles/DeleteConfirmationDialog';
import { formatCurrency } from '@/components/utils/formatters';
import { differenceInYears } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function Connections() {
  const { switchProfile, activeProfile } = useProfile();
  const [childProfiles, setChildProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateChild, setShowCreateChild] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);

  const [showEditChild, setShowEditChild] = useState(false);
  const [showDeleteChild, setShowDeleteChild] = useState(false);

  useEffect(() => {
    loadChildProfiles();
  }, []);

  const loadChildProfiles = async () => {
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

      const { data: children, error } = await supabase
        .from('child_profiles')
        .select(`
          *,
          permission_levels (
            level_number,
            level_name,
            level_description
          )
        `)
        .eq('parent_profile_id', ownerProfile.id)
        .order('child_name', { ascending: true });

      if (error) throw error;

      setChildProfiles(children || []);
    } catch (error) {
      console.error('Error loading child profiles:', error);
      toast.error('Failed to load child profiles');
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
      await loadChildProfiles();
    } catch (error) {
      console.error('Error deleting child profile:', error);
      toast.error('Failed to delete child profile');
    }
  };

  const filterChildren = (children) => {
    if (!searchQuery) return children;
    return children.filter(child =>
      child.child_name.toLowerCase().includes(searchQuery.toLowerCase())
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
  const activeChildren = childProfiles.filter(c => c.is_active);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Connections</h1>
          <p className="text-slate-600 mt-1">
            Manage child profiles and their access
          </p>
        </div>
        <Button onClick={() => setShowCreateChild(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Child
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Children</p>
                <p className="text-2xl font-bold mt-1">{childProfiles.length}</p>
              </div>
              <Users className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active Children</p>
                <p className="text-2xl font-bold mt-1">{activeChildren.length}</p>
              </div>
              <Users className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search children..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div>
        {filteredChildren.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-4 text-lg font-semibold">No child profiles</h3>
                <p className="mt-2 text-slate-600">
                  {searchQuery
                    ? 'No children match your search'
                    : 'Create child profiles to give them access to their own financial dashboard'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowCreateChild(true)} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Child
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChildren.map((child) => {
              const age = getAge(child.date_of_birth);
              const tierInfo = getTierInfo(child.current_permission_level);
              const initials = child.child_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <Card key={child.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-lg">{child.child_name}</h3>
                          {age && (
                            <p className="text-sm text-slate-600 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Age {age}
                            </p>
                          )}
                        </div>
                      </div>
                      {!child.is_active && (
                        <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Permission Level</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${tierInfo.color}`}>
                          Tier {child.current_permission_level} - {tierInfo.name}
                        </span>
                      </div>

                      {child.allowance_amount > 0 && (
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Allowance</p>
                          <p className="text-sm font-medium">
                            {formatCurrency(child.allowance_amount)} / {child.allowance_cadence}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenChild(child)}
                          className="flex-1"
                        >
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditChild(child)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteChild(child)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateChildProfileSheet
        open={showCreateChild}
        onOpenChange={setShowCreateChild}
        onChildCreated={() => {
          loadChildProfiles();
        }}
        profileId={activeProfile?.id}
      />

      <EditChildProfileSheet
        open={showEditChild}
        onOpenChange={setShowEditChild}
        child={selectedChild}
        onChildUpdated={() => {
          loadChildProfiles();
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
