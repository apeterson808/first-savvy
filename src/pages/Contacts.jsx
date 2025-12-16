import React, { useState } from 'react';
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
import { Plus, Search, Pencil, Trash2, Eye } from 'lucide-react';
import ContactDetailSheet from '@/components/contacts/ContactDetailSheet';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [viewingContact, setViewingContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
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
    },
    onError: (error) => {
      console.error('Create failed:', error);
      alert(`Failed to create contact: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contact.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDialogOpen(false);
      setEditingContact(null);
    },
    onError: (error) => {
      console.error('Update failed:', error);
      alert(`Failed to update contact: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contact.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const phone = formData.get('phone');
    const phoneDigits = phone ? phone.replace(/[^\d]/g, '') : '';

    if (phone && phoneDigits.length > 0 && phoneDigits.length < 10) {
      alert('Phone number must include area code (10 digits)');
      return;
    }

    const type = formData.get('type');
    const status = formData.get('status');

    if (!type) {
      alert('Type is required');
      return;
    }

    if (!status) {
      alert('Status is required');
      return;
    }

    const data = {
      name: formData.get('name'),
      type,
      email: formData.get('email') || undefined,
      phone: phone || undefined,
      address: formData.get('address') || undefined,
      notes: formData.get('notes') || undefined,
      default_category_id: formData.get('default_category_id') || undefined,
      status
    };

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
                setDialogOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 h-9"
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
                  <TableHead className="text-right h-9">Actions</TableHead>
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
                    <TableRow key={contact.id} className="h-11">
                      <TableCell className="font-medium py-2">
                        <button
                          onClick={() => {
                            setViewingContact(contact);
                            setDetailOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 hover:underline text-left"
                        >
                          {contact.name}
                        </button>
                      </TableCell>
                      <TableCell className="py-2 capitalize">{contact.type || '-'}</TableCell>
                      <TableCell className="py-2">{contact.email || '-'}</TableCell>
                      <TableCell className="py-2">{contact.phone || '-'}</TableCell>
                      <TableCell className="py-2">
                        {contact.status ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            contact.status.toLowerCase() === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {contact.status}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setViewingContact(contact);
                            setDetailOpen(true);
                          }}
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingContact(contact);
                            setPhoneValue(contact.phone || '');
                            setDialogOpen(true);
                          }}
                          title="Edit contact"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this contact?')) {
                              deleteMutation.mutate(contact.id);
                            }
                          }}
                          title="Delete contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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
                defaultValue={editingContact?.email}
                placeholder="contact@example.com"
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
              <p className="text-xs text-slate-500 mt-1">Must include area code</p>
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
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingContact ? 'Update' : 'Create'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ContactDetailSheet
        contact={viewingContact}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}