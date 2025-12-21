import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery } from '@tanstack/react-query';
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
import { Plus, Search } from 'lucide-react';
import AddContactSheet from '@/components/contacts/AddContactSheet';

export default function Contacts() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => firstsavvy.entities.Contact.list('name')
  });

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-3 rounded-sm">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Contacts</p>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 h-9"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-9">
                  <TableHead className="h-9">Name</TableHead>
                  <TableHead className="h-9">Type</TableHead>
                  <TableHead className="h-9">Email</TableHead>
                  <TableHead className="h-9">Phone</TableHead>
                  <TableHead className="h-9">Status</TableHead>
                  <TableHead className="h-9">Connection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="h-12">
                    <TableCell colSpan={6} className="text-center text-slate-500 h-12">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow className="h-12">
                    <TableCell colSpan={6} className="text-center text-slate-500 h-12">
                      No contacts found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="h-11 cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <TableCell className="font-medium py-2">
                        {contact.name}
                      </TableCell>
                      <TableCell className="py-2 capitalize">{contact.type || '-'}</TableCell>
                      <TableCell className="py-2">{contact.email || '-'}</TableCell>
                      <TableCell className="py-2">{contact.phone || '-'}</TableCell>
                      <TableCell className="py-2">
                        {contact.status ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
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
                      <TableCell className="py-2">
                        {contact.connection_status === 'connected' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-light-blue/20 text-sky-blue">
                            Connected
                          </span>
                        ) : contact.connection_status === 'invited' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Invited
                          </span>
                        ) : contact.connection_status === 'platform_user' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-lavender/20 text-burgundy">
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
        </CardContent>
      </Card>

      <AddContactSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
