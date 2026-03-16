import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import AddContactSheet from '@/components/contacts/AddContactSheet';
import { useProfile } from '@/contexts/ProfileContext';

const ROWS_PER_PAGE = 10;

export default function Contacts() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredContacts.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  return (
    <div className="p-4 md:p-6">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Contacts</p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 h-9"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-7">
                  <TableHead className="h-7">Name</TableHead>
                  <TableHead className="h-7">Type</TableHead>
                  <TableHead className="h-7">Email</TableHead>
                  <TableHead className="h-7">Phone</TableHead>
                  <TableHead className="h-7">Status</TableHead>
                  <TableHead className="h-7">Connection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="h-8">
                    <TableCell colSpan={6} className="text-center text-slate-500 h-8 py-1">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow className="h-8">
                    <TableCell colSpan={6} className="text-center text-slate-500 h-8 py-1">
                      No contacts found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedContacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="h-8 cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <TableCell className="font-medium py-1">
                        {contact.name}
                      </TableCell>
                      <TableCell className="py-1 capitalize">{contact.type || '-'}</TableCell>
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
                      <TableCell className="py-1">
                        {contact.connection_status === 'connected' ? (
                          <span className="inline-flex items-center px-2 py-0 rounded-full text-xs font-medium bg-light-blue/20 text-sky-blue">
                            Connected
                          </span>
                        ) : contact.connection_status === 'invited' ? (
                          <span className="inline-flex items-center px-2 py-0 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Invited
                          </span>
                        ) : contact.connection_status === 'platform_user' ? (
                          <span className="inline-flex items-center px-2 py-0 rounded-full text-xs font-medium bg-lavender/20 text-burgundy">
                            On Platform
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

          {!isLoading && filteredContacts.length > 0 && (
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
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <div className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddContactSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
