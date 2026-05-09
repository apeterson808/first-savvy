import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check, X, Home, Briefcase } from 'lucide-react';
import AddContactSheet from '@/components/contacts/AddContactSheet';
import { useProfile } from '@/contexts/ProfileContext';
import { supabase } from '@/api/supabaseClient';
import { differenceInYears } from 'date-fns';
import { toast } from "sonner";
import ChildAvatar from '@/components/children/ChildAvatar';

const ROWS_PER_PAGE = 10;

function ContactsTable({ contacts, isLoading, onContactClick, currentPage, setCurrentPage, groupName }) {
  const filteredContacts = contacts;
  const totalPages = Math.ceil(filteredContacts.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="h-7">
              <TableHead className="h-7 w-[300px]">Name</TableHead>
              <TableHead className="h-7 w-[250px]">Email</TableHead>
              <TableHead className="h-7 w-[200px]">Phone</TableHead>
              <TableHead className="h-7 w-[150px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="h-8">
                <TableCell colSpan={4} className="text-center text-slate-500 h-8 py-1">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredContacts.length === 0 ? (
              <TableRow className="h-8">
                <TableCell colSpan={4} className="text-center text-slate-500 h-8 py-1">
                  {groupName ? `No contacts in ${groupName}` : 'No contacts found'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="h-8 cursor-pointer hover:bg-slate-50"
                  onClick={() => onContactClick(contact.id)}
                >
                  <TableCell className="font-medium py-1 w-[300px]">
                    {contact.name}
                  </TableCell>
                  <TableCell className="py-1 w-[250px]">{contact.email || '-'}</TableCell>
                  <TableCell className="py-1 w-[200px]">{contact.phone || '-'}</TableCell>
                  <TableCell className="py-1 w-[150px]">
                    {contact.status ? (
                      <span className={`inline-flex items-center px-2 py-0 rounded-full text-xs font-medium capitalize ${
                        contact.status.toLowerCase() === 'active'
                          ? 'bg-soft-green/30 text-forest-green'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {contact.status}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && filteredContacts.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-slate-600">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredContacts.length)} of {filteredContacts.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="h-8"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default function Contacts() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialType, setDialogInitialType] = useState('general');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPages, setCurrentPages] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [childProfiles, setChildProfiles] = useState([]);
  const [businessProfiles, setBusinessProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [pendingCounts, setPendingCounts] = useState({});
  const queryClient = useQueryClient();
  const { activeProfile, refreshProfiles } = useProfile();

  React.useEffect(() => {
    const handleProfileSwitch = () => {
      queryClient.invalidateQueries();
      loadAllProfiles();
    };

    window.addEventListener('profileSwitched', handleProfileSwitch);
    return () => window.removeEventListener('profileSwitched', handleProfileSwitch);
  }, [queryClient]);

  useEffect(() => {
    loadAllProfiles();
  }, [activeProfile?.id]);

  const loadAllProfiles = async () => {
    try {
      setProfilesLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('profile_type', 'personal')
        .eq('is_deleted', false)
        .maybeSingle();

      if (!ownerProfile) return;

      const { data: children } = await supabase
        .from('child_profiles')
        .select('*')
        .eq('parent_profile_id', ownerProfile.id)
        .order('child_name', { ascending: true });

      const { data: businesses } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('profile_type', 'business')
        .eq('is_deleted', false)
        .order('display_name', { ascending: true });

      setChildProfiles(children || []);
      setBusinessProfiles(businesses || []);

      if (children && children.length > 0) {
        const childIds = children.map(c => c.id);
        const { data: pendingRows } = await supabase
          .from('task_completions')
          .select('child_profile_id')
          .in('child_profile_id', childIds)
          .eq('status', 'pending');

        const counts = {};
        (pendingRows || []).forEach(row => {
          counts[row.child_profile_id] = (counts[row.child_profile_id] || 0) + 1;
        });
        setPendingCounts(counts);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setProfilesLoading(false);
    }
  };

  const getAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    return differenceInYears(new Date(), new Date(dateOfBirth));
  };

  const ADULT_FAMILY_ROLES = ['spouse_partner', 'parent', 'sibling', 'grandparent', 'other'];

  const getTierInfo = (level, familyRole) => {
    if (familyRole && ADULT_FAMILY_ROLES.includes(familyRole)) {
      const labels = {
        spouse_partner: 'Shared Access',
        parent: 'Family Access',
        sibling: 'Family Access',
        grandparent: 'Family Access',
        other: 'Family Access',
      };
      return { name: labels[familyRole] || 'Family Access', color: 'bg-teal-100 text-teal-700' };
    }
    const tiers = {
      1: { name: 'Basic Access', color: 'bg-slate-100 text-slate-700' },
      2: { name: 'Rewards', color: 'bg-blue-100 text-blue-700' },
      3: { name: 'Money', color: 'bg-green-100 text-green-700' },
    };
    return tiers[level] || tiers[1];
  };

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Contact.list('name'),
    enabled: !!activeProfile
  });

  const groupedContacts = useMemo(() => {
    const groups = { ungrouped: [] };

    contacts.forEach(contact => {
      const matchesSearch = searchTerm === '' || contact.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return;

      if (contact.group_name) {
        if (!groups[contact.group_name]) {
          groups[contact.group_name] = [];
        }
        groups[contact.group_name].push(contact);
      } else {
        groups.ungrouped.push(contact);
      }
    });

    return groups;
  }, [contacts, searchTerm]);

  const groupNames = useMemo(() => {
    return Object.keys(groupedContacts)
      .filter(name => name !== 'ungrouped')
      .sort();
  }, [groupedContacts]);

  useEffect(() => {
    setCurrentPages({});
  }, [searchTerm]);

  const setPageForGroup = (groupName, page) => {
    setCurrentPages(prev => ({ ...prev, [groupName]: page }));
  };

  const toggleGroupCollapse = (groupName) => {
    setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleStartEdit = (groupName) => {
    setEditingGroup(groupName);
    setEditingValue(groupName);
  };

  const handleCancelEdit = () => {
    setEditingGroup(null);
    setEditingValue('');
  };

  const handleSaveGroupName = async () => {
    const oldName = editingGroup;
    const newName = editingValue.trim();

    if (!newName) {
      toast.error('Group name cannot be empty');
      return;
    }

    if (newName === oldName) {
      handleCancelEdit();
      return;
    }

    try {
      const contactsInGroup = groupedContacts[oldName];

      for (const contact of contactsInGroup) {
        await firstsavvy.entities.Contact.update(contact.id, {
          group_name: newName
        });
      }

      await queryClient.invalidateQueries(['contacts']);
      toast.success(`Group renamed to "${newName}"`);
      handleCancelEdit();
    } catch (error) {
      console.error('Error renaming group:', error);
      toast.error('Failed to rename group');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => { setDialogInitialType('general'); setDialogOpen(true); }}
            className="bg-primary hover:bg-primary/90 h-9"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      <Collapsible open={!collapsedGroups['family']} onOpenChange={() => toggleGroupCollapse('family')}>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4 border-b">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 hover:bg-slate-50 -mx-1 px-1 py-1 rounded flex-1">
                {collapsedGroups['family'] ? (
                  <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
                )}
                <Home className="w-4 h-4 text-blue-600" />
                <CardTitle className="text-base font-semibold">Family</CardTitle>
                <Badge variant="secondary" className="text-xs">{childProfiles.length}</Badge>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4">
              {profilesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900"></div>
                </div>
              ) : childProfiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <Home className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-sm text-slate-500">No family members yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 text-xs"
                    onClick={() => { setDialogInitialType('family'); setDialogOpen(true); }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Family Member
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {childProfiles.map((child) => {
                    const pending = pendingCounts[child.id] || 0;

                    return (
                      <div
                        key={child.id}
                        className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm cursor-pointer transition-all bg-white relative"
                        onClick={() => navigate(`/Contacts/family/${child.id}`)}
                      >
                        <div className="relative">
                          <ChildAvatar child={child} size="default" />
                          {pending > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                              {pending}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate w-full">{child.child_name}</p>
                        {!child.is_active && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500">
                            Inactive
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={!collapsedGroups['business']} onOpenChange={() => toggleGroupCollapse('business')}>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4 border-b">
            <CollapsibleTrigger className="flex items-center gap-2 hover:bg-slate-50 -mx-1 px-1 py-1 rounded w-full">
              {collapsedGroups['business'] ? (
                <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
              )}
              <Briefcase className="w-4 h-4 text-orange-600" />
              <CardTitle className="text-base font-semibold">Business</CardTitle>
              <Badge variant="secondary" className="text-xs">{businessProfiles.length}</Badge>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4">
              {businessProfiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-2">
                    <Briefcase className="w-5 h-5 text-orange-600" />
                  </div>
                  <p className="text-sm text-slate-500">No business profiles yet</p>
                  <p className="text-xs text-slate-400 mt-1">Coming soon</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {businessProfiles.map((biz) => {
                    const initials = (biz.display_name || 'B')
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <div
                        key={biz.id}
                        className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm cursor-pointer transition-all bg-white"
                        onClick={() => navigate(`/Contacts/business/${biz.id}`)}
                      >
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-orange-100 text-orange-600 font-semibold text-base">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="w-full">
                          <p className="font-medium text-sm truncate">{biz.display_name}</p>
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded-full font-medium bg-orange-100 text-orange-700">
                            Business
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={!collapsedGroups['ungrouped']} onOpenChange={() => toggleGroupCollapse('ungrouped')}>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4 border-b">
            <CollapsibleTrigger className="flex items-center w-full hover:bg-slate-50 -mx-4 px-4 py-1 rounded">
              {collapsedGroups['ungrouped'] ? (
                <ChevronDown className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
              )}
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">General Contacts</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {groupedContacts.ungrouped.length}
                </Badge>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4">
              <ContactsTable
                contacts={groupedContacts.ungrouped}
                isLoading={isLoading}
                onContactClick={(id) => navigate(`/contacts/${id}`)}
                currentPage={currentPages['ungrouped'] || 1}
                setCurrentPage={(page) => setPageForGroup('ungrouped', page)}
                groupName={null}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {groupNames.map(groupName => {
        const groupContacts = groupedContacts[groupName];

        return (
          <Collapsible
            key={groupName}
            open={!collapsedGroups[groupName]}
            onOpenChange={() => toggleGroupCollapse(groupName)}
          >
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 pt-4 px-4 border-b">
                <div className="flex items-center gap-2 w-full">
                  <CollapsibleTrigger
                    className="flex items-center hover:bg-slate-50 p-1 rounded"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {collapsedGroups[groupName] ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2 flex-1">
                    {editingGroup === groupName ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="h-7 text-base font-semibold w-auto"
                          style={{ width: `${Math.max(editingValue.length * 8 + 20, 100)}px` }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveGroupName();
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          onBlur={handleSaveGroupName}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-green-50"
                          onClick={handleSaveGroupName}
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-red-50"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CardTitle
                          className="text-base font-semibold cursor-pointer hover:text-slate-600"
                          onClick={() => handleStartEdit(groupName)}
                        >
                          {groupName}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {groupContacts.length}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="p-4">
                  <ContactsTable
                    contacts={groupContacts}
                    isLoading={isLoading}
                    onContactClick={(id) => navigate(`/contacts/${id}`)}
                    currentPage={currentPages[groupName] || 1}
                    setCurrentPage={(page) => setPageForGroup(groupName, page)}
                    groupName={groupName}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      <AddContactSheet
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDialogInitialType('general');
        }}
        initialType={dialogInitialType}
        onChildCreated={async () => {
          await loadAllProfiles();
          await refreshProfiles();
        }}
      />
    </div>
  );
}
