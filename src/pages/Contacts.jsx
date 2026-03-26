import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import AddContactSheet from '@/components/contacts/AddContactSheet';
import { useProfile } from '@/contexts/ProfileContext';

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
              <TableHead className="h-7">Name</TableHead>
              <TableHead className="h-7">Email</TableHead>
              <TableHead className="h-7">Phone</TableHead>
              <TableHead className="h-7">Status</TableHead>
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
                  <TableCell className="font-medium py-1">
                    {contact.name}
                  </TableCell>
                  <TableCell className="py-1">{contact.email || '-'}</TableCell>
                  <TableCell className="py-1">{contact.phone || '-'}</TableCell>
                  <TableCell className="py-1">
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
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
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

  // Group contacts by their group_name
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

  const handleAddGroup = () => {
    if (newGroupName.trim() && !groupNames.includes(newGroupName.trim())) {
      setNewGroupName('');
      setShowNewGroupInput(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
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
          {!showNewGroupInput ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNewGroupInput(true)}
              className="h-9"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Group
            </Button>
          ) : (
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Group name..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddGroup();
                  } else if (e.key === 'Escape') {
                    setNewGroupName('');
                    setShowNewGroupInput(false);
                  }
                }}
                className="h-9 w-48"
                autoFocus
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddGroup}
                className="h-9"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNewGroupName('');
                  setShowNewGroupInput(false);
                }}
                className="h-9"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
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

      {/* All Contacts Card */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">All Contacts</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {groupedContacts.ungrouped.length + groupNames.reduce((sum, name) => sum + groupedContacts[name].length, 0)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <ContactsTable
            contacts={[...groupedContacts.ungrouped, ...groupNames.flatMap(name => groupedContacts[name])]}
            isLoading={isLoading}
            onContactClick={(id) => navigate(`/contacts/${id}`)}
            currentPage={currentPages['all'] || 1}
            setCurrentPage={(page) => setPageForGroup('all', page)}
            groupName={null}
          />
        </CardContent>
      </Card>

      {/* Group Cards */}
      {groupNames.map(groupName => {
        const groupContacts = groupedContacts[groupName];
        const firstContact = groupContacts[0];
        const groupColor = firstContact?.color || '#6B7280';

        return (
          <Card key={groupName} className="shadow-sm border-slate-200">
            <CardHeader className="pb-2 pt-4 px-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: groupColor }}
                  />
                  <CardTitle className="text-base font-semibold">{groupName}</CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {groupContacts.length}
                </Badge>
              </div>
            </CardHeader>
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
          </Card>
        );
      })}

      <AddContactSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
