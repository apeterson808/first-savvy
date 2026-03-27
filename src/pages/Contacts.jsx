import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import AddContactSheet from '@/components/contacts/AddContactSheet';
import { useProfile } from '@/contexts/ProfileContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPages, setCurrentPages] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [editGroupDialog, setEditGroupDialog] = useState({ open: false, groupName: '', newName: '' });
  const queryClient = useQueryClient();
  const { activeProfile } = useProfile();

  React.useEffect(() => {
    const handleProfileSwitch = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener('profileSwitched', handleProfileSwitch);
    return () => window.removeEventListener('profileSwitched', handleProfileSwitch);
  }, [queryClient]);

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

  const handleEditGroup = (groupName) => {
    setEditGroupDialog({ open: true, groupName, newName: groupName });
  };

  const handleSaveGroupName = async () => {
    const { groupName, newName } = editGroupDialog;

    if (!newName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }

    if (newName === groupName) {
      setEditGroupDialog({ open: false, groupName: '', newName: '' });
      return;
    }

    try {
      const contactsInGroup = groupedContacts[groupName];

      for (const contact of contactsInGroup) {
        await firstsavvy.entities.Contact.update(contact.id, {
          group_name: newName
        });
      }

      await queryClient.invalidateQueries(['contacts']);
      toast.success(`Group renamed from "${groupName}" to "${newName}"`);
      setEditGroupDialog({ open: false, groupName: '', newName: '' });
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
            onClick={() => setDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 h-9"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

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
                <div className="flex items-center justify-between w-full">
                  <CollapsibleTrigger className="flex items-center flex-1 hover:bg-slate-50 -mx-4 px-4 py-1 rounded">
                    {collapsedGroups[groupName] ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold">{groupName}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {groupContacts.length}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-slate-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditGroup(groupName);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
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
        onOpenChange={setDialogOpen}
      />

      <Dialog open={editGroupDialog.open} onOpenChange={(open) => setEditGroupDialog({ ...editGroupDialog, open })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Group Name</DialogTitle>
            <DialogDescription>
              Rename "{editGroupDialog.groupName}" group. This will update all contacts in this group.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={editGroupDialog.newName}
                onChange={(e) => setEditGroupDialog({ ...editGroupDialog, newName: e.target.value })}
                placeholder="Enter group name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveGroupName();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupDialog({ open: false, groupName: '', newName: '' })}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroupName}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
