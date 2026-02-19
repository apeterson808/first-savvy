import React, { useState, useEffect } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import AccountDetectionField from './AccountDetectionField';
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

export default function AddContactSheet({
  open,
  onOpenChange,
  initialName = '',
  triggeringTransactionId = null,
  onContactCreated = null
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'vendor',
    status: 'active',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [detectedUser, setDetectedUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && initialName) {
      setFormData(prev => ({ ...prev, name: initialName }));
    }
  }, [open, initialName]);

  const createMutation = useMutation({
    mutationFn: (data) => firstsavvy.entities.Contact.create(data),
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created successfully');
      if (onContactCreated) {
        onContactCreated(newContact, triggeringTransactionId);
      }
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Create failed:', error);
      toast.error(`Failed to create contact: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'vendor',
      status: 'active',
      email: '',
      phone: '',
      address: '',
      notes: '',
    });
    setDetectedUser(null);
  };

  const updateFormField = (field, value) => {
    let normalizedValue = value;
    if (field === 'type' || field === 'status') {
      normalizedValue = value ? value.toLowerCase() : value;
    }
    setFormData(prev => ({ ...prev, [field]: normalizedValue }));
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    updateFormField('phone', formatted);
  };

  const handleConnectionRequest = async (user) => {
    try {
      const currentUser = await firstsavvy.auth.me();
      if (!currentUser) {
        toast.error('You must be logged in to connect with contacts');
        return;
      }

      await firstsavvy.entities.UserRelationship.create({
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
      const currentUser = await firstsavvy.auth.me();
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

      const invitation = await firstsavvy.entities.Invitation.create(invitationData);

      toast.success(`Invitation sent to ${value}!`);
      return invitation;
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    const phoneDigits = formData.phone ? formData.phone.replace(/[^\d]/g, '') : '';
    if (formData.phone && phoneDigits.length > 0 && phoneDigits.length < 10) {
      toast.error('Phone number must include area code (10 digits)');
      return;
    }

    const contactData = {
      name: formData.name.trim(),
      type: (formData.type || 'vendor').toLowerCase(),
      status: (formData.status || 'active').toLowerCase(),
      email: formData.email.trim() || undefined,
      phone: formData.phone || undefined,
      address: formData.address.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      linked_user_id: detectedUser?.id || undefined,
      connection_status: detectedUser ? 'platform_user' : 'not_checked'
    };

    createMutation.mutate(contactData);
  };

  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add Contact</SheetTitle>
            <SheetDescription>
              Add a new vendor or customer to your contacts
            </SheetDescription>
          </SheetHeader>
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateFormField('name', e.target.value)}
              placeholder="e.g., Starbucks, Employer XYZ"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type *</Label>
              <ClickThroughSelect
                value={formData.type}
                onValueChange={(value) => updateFormField('type', value)}
                placeholder="Select type"
              >
                <ClickThroughSelectItem value="vendor">Vendor</ClickThroughSelectItem>
                <ClickThroughSelectItem value="customer">Customer</ClickThroughSelectItem>
              </ClickThroughSelect>
            </div>
            <div>
              <Label htmlFor="status">Status *</Label>
              <ClickThroughSelect
                value={formData.status}
                onValueChange={(value) => updateFormField('status', value)}
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
              type="email"
              value={formData.email}
              onChange={(e) => updateFormField('email', e.target.value)}
              placeholder="contact@example.com"
            />
            <p className="text-xs text-slate-500 mt-1">
              Add email or phone to check if they have an account
            </p>
            <AccountDetectionField
              type="email"
              value={formData.email}
              onConnectionRequest={handleConnectionRequest}
              onInviteSend={handleSendInvitation}
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              maxLength={14}
            />
            <p className="text-xs text-slate-500 mt-1">
              Must include area code. Add to check if they have an account.
            </p>
            <AccountDetectionField
              type="phone"
              value={formData.phone}
              onConnectionRequest={handleConnectionRequest}
              onInviteSend={handleSendInvitation}
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => updateFormField('address', e.target.value)}
              placeholder="Street address, city, state, zip"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormField('notes', e.target.value)}
              placeholder="e.g., Recurring $15.99/month"
              rows={3}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>

  </>
  );
}
