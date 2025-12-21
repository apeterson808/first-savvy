import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Plus, Search } from 'lucide-react';
import AccountDetectionField from '@/components/contacts/AccountDetectionField';
import { toast } from 'sonner';

function formatPhoneNumber(value) {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
}

export default function Contacts() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [detectedUser, setDetectedUser] = useState(null);
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list('name')
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDialogOpen(false);
      setEditingContact(null);
      toast.success('Contact created successfully');
    },
    onError: (error) => {
      console.error('Create failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast.error(`Failed to create contact: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contact.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDialogOpen(false);
      setEditingContact(null);
      toast.success('Contact updated successfully');
    },
    onError: (error) => {
      console.error('Update failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast.error(`Failed to update contact: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contact.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    }
  });

  const handleConnectionRequest = async (user) => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) {
        toast.error('You must be logged in to connect with contacts');
        return;
      }

      await base44.entities.UserRelationship.create({
        user_id: currentUser.id,
        related_user_id: user.id,
        relationship_type: 'friend',
        status: 'pending',
        created_by: currentUser.id,
        permissions: {}
      });

      setDetectedUser(user);
      toast.success('Connection request sent!');
    } catch (error) {
      console.error('Failed to send connection request:', error);
      toast.error('Failed to send connection request');
    }
  };

  const handleSendInvitation = async (value, type) => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) {
        toast.error('You must be logged in to send invitations');
        return;
      }

      const invitationData = {
        inviter_user_id: currentUser.id,
        invitation_type: 'user_connection',
        relationship_metadata: { relationship_type: 'friend' },
        status: 'pending'
      };

      if (type === 'email') {
        invitationData.invitee_email = value;
      } else if (type === 'phone') {
        invitationData.invitee_phone = value.replace(/[^\d]/g, '');
      }

      const invitation = await base44.entities.Invitation.create(invitationData);

      try {
        await base44.functions.sendInvitationNotification({
          invitationId: invitation.id,
          inviterName: currentUser.email || 'A user',
          inviteeEmail: type === 'email' ? value : undefined,
          inviteePhone: type === 'phone' ? value : undefined,
          invitationType: 'user_connection',
          invitationToken: invitation.token
        });
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      toast.success(`Invitation sent to ${value}!`);
      return invitation;
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const phoneDigits = phoneValue ? phoneValue.replace(/[^\d]/g, '') : '';

    if (phoneValue && phoneDigits.length > 0 && phoneDigits.length < 10) {
      toast.error('Phone number must include area code (10 digits)');
      return;
    }

    const type = formData.get('type') || 'vendor';
    const status = formData.get('status') || 'active';

    console.log('Form submission data:', { type, status, name: formData.get('name') });

    if (!type || (type !== 'vendor' && type !== 'customer')) {
      toast.error('Type must be either vendor or customer');
      return;
    }

    if (!status) {
      toast.error('Status is required');
      return;
    }

    const data = {
      name: formData.get('name'),
      type,
      email: emailValue || undefined,
      phone: phoneValue || undefined,
      address: formData.get('address') || undefined,
      notes: formData.get('notes') || undefined,
      default_category_id: formData.get('default_category_id') || undefined,
      status,
      linked_user_id: detectedUser?.id || undefined,
      connection_status: detectedUser ? 'platform_user' : 'not_checked'
    };

    console.log('Submitting contact data:', data);

    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneValue(formatted);
  };

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
              onClick={() => {
                setEditingContact(null);
                setPhoneValue('');
                setEmailValue('');
                setDetectedUser(null);
                setDialogOpen(true);
              }}
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

      {/* Add/Edit Sheet */}
      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</SheetTitle>
          </SheetHeader>
          <form key={editingContact?.id || 'new'} onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editingContact?.name}
                placeholder="e.g., Starbucks, Employer XYZ"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type *</Label>
                <ClickThroughSelect
                  name="type"
                  defaultValue={editingContact?.type || 'vendor'}
                  placeholder="Select type"
                >
                  <ClickThroughSelectItem value="vendor">Vendor</ClickThroughSelectItem>
                  <ClickThroughSelectItem value="customer">Customer</ClickThroughSelectItem>
                </ClickThroughSelect>
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <ClickThroughSelect
                  name="status"
                  defaultValue={editingContact?.status || 'active'}
                  placeholder="Select status"
                >
                  <ClickThroughSelectItem value="active">Active</ClickThroughSelectItem>
                  <ClickThroughSelectItem value="inactive">Inactive</ClickThroughSelectItem>
                </ClickThroughSelect>
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="contact@example.com"
              />
              <p className="text-xs text-slate-500 mt-1">
                Add email or phone to check if they have an account
              </p>
              <AccountDetectionField
                type="email"
                value={emailValue}
                onConnectionRequest={handleConnectionRequest}
                onInviteSend={handleSendInvitation}
                disabled={!!editingContact}
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={phoneValue}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                maxLength={14}
              />
              <p className="text-xs text-slate-500 mt-1">
                Must include area code. Add to check if they have an account.
              </p>
              <AccountDetectionField
                type="phone"
                value={phoneValue}
                onConnectionRequest={handleConnectionRequest}
                onInviteSend={handleSendInvitation}
                disabled={!!editingContact}
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                name="address"
                defaultValue={editingContact?.address}
                placeholder="Street address, city, state, zip"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="default_category_id">Default Category</Label>
              <ClickThroughSelect 
                name="default_category_id" 
                defaultValue={editingContact?.default_category_id}
                placeholder="Select category (optional)"
              >
                {categories.map(cat => (
                  <ClickThroughSelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={editingContact?.notes}
                placeholder="e.g., Recurring $15.99/month"
                rows={3}
              />
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {editingContact ? 'Update' : 'Create'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}