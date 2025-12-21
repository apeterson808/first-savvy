import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Mail, Phone, MapPin, Tag, FileText, TrendingUp, DollarSign, Hash, Calendar, Edit2, Save, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
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

export default function ContactDetailSheet({ contact, open, onOpenChange }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [detectedUser, setDetectedUser] = useState(null);
  const queryClient = useQueryClient();
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'contact', contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const allTransactions = await firstsavvy.entities.Transaction.list('date', 'desc');
      return allTransactions.filter(t =>
        t.merchant?.toLowerCase().includes(contact.name.toLowerCase()) ||
        t.description?.toLowerCase().includes(contact.name.toLowerCase())
      );
    },
    enabled: !!contact?.id && open,
  });

  const { data: category } = useQuery({
    queryKey: ['category', contact?.default_category_id],
    queryFn: () => firstsavvy.entities.Category.get(contact.default_category_id),
    enabled: !!contact?.default_category_id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => firstsavvy.entities.Category.list('name')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => firstsavvy.entities.Contact.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsEditMode(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => firstsavvy.entities.Contact.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onOpenChange(false);
    }
  });

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

      await firstsavvy.entities.Contact.update(contact.id, {
        linked_user_id: user.id,
        connection_status: 'connected'
      });

      queryClient.invalidateQueries({ queryKey: ['contacts'] });
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

      try {
        await firstsavvy.functions.sendInvitationNotification({
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

      await firstsavvy.entities.Contact.update(contact.id, {
        invitation_id: invitation.id,
        connection_status: 'invited'
      });

      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Invitation sent to ${value}!`);
      return invitation;
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation');
    }
  };

  useEffect(() => {
    if (open && contact) {
      setIsEditMode(false);
      setPhoneValue(contact.phone || '');
      setEmailValue(contact.email || '');
      setDetectedUser(null);
    }
  }, [open, contact]);

  const analytics = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        totalSpent: 0,
        totalIncome: 0,
        transactionCount: 0,
        averageTransaction: 0,
        lastTransaction: null,
        firstTransaction: null,
      };
    }

    const expenses = transactions.filter(t => t.type === 'expense');
    const income = transactions.filter(t => t.type === 'income');

    const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);
    const totalIncome = income.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const avgTransaction = transactions.length > 0 ? totalSpent / expenses.length : 0;

    const sortedByDate = [...transactions].sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    return {
      totalSpent,
      totalIncome,
      transactionCount: transactions.length,
      averageTransaction: avgTransaction,
      lastTransaction: sortedByDate[0],
      firstTransaction: sortedByDate[sortedByDate.length - 1],
    };
  }, [transactions]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneValue(formatted);
  };

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
      email: emailValue || undefined,
      phone: phoneValue || undefined,
      address: formData.get('address') || undefined,
      notes: formData.get('notes') || undefined,
      default_category_id: formData.get('default_category_id') || undefined,
      status,
      linked_user_id: detectedUser?.id || contact.linked_user_id || undefined,
      connection_status: detectedUser ? 'platform_user' : (contact.connection_status || 'not_checked')
    };

    updateMutation.mutate({ id: contact.id, data });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteMutation.mutate(contact.id);
    }
  };

  if (!contact) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-2xl">
        <SheetHeader className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-2xl">{contact.name}</SheetTitle>
              {!isEditMode && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="capitalize">
                    {contact.type}
                  </Badge>
                  {contact.status && (
                    <Badge
                      className={
                        contact.status.toLowerCase() === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }
                    >
                      {contact.status}
                    </Badge>
                  )}
                  {contact.connection_status === 'connected' && (
                    <Badge className="bg-blue-100 text-blue-800">
                      Connected
                    </Badge>
                  )}
                  {contact.connection_status === 'invited' && (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      Invited
                    </Badge>
                  )}
                  {contact.connection_status === 'platform_user' && (
                    <Badge className="bg-purple-100 text-purple-800">
                      On Platform
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isEditMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditMode(false);
                      setPhoneValue(contact.phone || '');
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    form="edit-contact-form"
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={updateMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditMode ? (
                <form id="edit-contact-form" onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={contact.name}
                      placeholder="e.g., Starbucks, Employer XYZ"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="type">Type *</Label>
                      <ClickThroughSelect
                        name="type"
                        defaultValue={contact.type || 'vendor'}
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
                        defaultValue={contact.status || 'active'}
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
                      disabled={contact?.connection_status === 'connected' || contact?.connection_status === 'invited'}
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
                      disabled={contact?.connection_status === 'connected' || contact?.connection_status === 'invited'}
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      name="address"
                      defaultValue={contact.address}
                      placeholder="Street address, city, state, zip"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="default_category_id">Default Category</Label>
                    <ClickThroughSelect
                      name="default_category_id"
                      defaultValue={contact.default_category_id}
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
                      defaultValue={contact.notes}
                      placeholder="e.g., Recurring $15.99/month"
                      rows={3}
                    />
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  {contact.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 mt-0.5 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Email</p>
                        <p className="text-sm">{contact.email}</p>
                      </div>
                    </div>
                  )}

                  {contact.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 mt-0.5 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Phone</p>
                        <p className="text-sm">{contact.phone}</p>
                      </div>
                    </div>
                  )}

                  {contact.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 mt-0.5 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Address</p>
                        <p className="text-sm whitespace-pre-line">{contact.address}</p>
                      </div>
                    </div>
                  )}

                  {category && (
                    <div className="flex items-start gap-3">
                      <Tag className="w-4 h-4 mt-0.5 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Default Category</p>
                        <div className="flex items-center gap-2 mt-1">
                          {category.icon && (
                            <span className="text-sm">{category.icon}</span>
                          )}
                          <span className="text-sm">{category.name}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {contact.notes && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 mt-0.5 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Notes</p>
                        <p className="text-sm whitespace-pre-line">{contact.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Spending Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <p className="text-sm text-slate-500">Loading analytics...</p>
              ) : analytics.transactionCount === 0 ? (
                <p className="text-sm text-slate-500">No transactions found for this contact</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <DollarSign className="w-4 h-4" />
                      <p className="text-xs uppercase tracking-wide">Total Spent</p>
                    </div>
                    <p className="text-xl font-semibold text-red-600">
                      {formatCurrency(analytics.totalSpent)}
                    </p>
                  </div>

                  {analytics.totalIncome > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-500">
                        <TrendingUp className="w-4 h-4" />
                        <p className="text-xs uppercase tracking-wide">Total Income</p>
                      </div>
                      <p className="text-xl font-semibold text-green-600">
                        {formatCurrency(analytics.totalIncome)}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Hash className="w-4 h-4" />
                      <p className="text-xs uppercase tracking-wide">Transactions</p>
                    </div>
                    <p className="text-xl font-semibold">
                      {analytics.transactionCount}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500">
                      <DollarSign className="w-4 h-4" />
                      <p className="text-xs uppercase tracking-wide">Average</p>
                    </div>
                    <p className="text-xl font-semibold">
                      {formatCurrency(analytics.averageTransaction)}
                    </p>
                  </div>

                  {analytics.lastTransaction && (
                    <div className="space-y-1 col-span-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="w-4 h-4" />
                        <p className="text-xs uppercase tracking-wide">Last Transaction</p>
                      </div>
                      <p className="text-sm">
                        {format(new Date(analytics.lastTransaction.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Recent Transactions ({transactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <p className="text-sm text-slate-500">Loading transactions...</p>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-slate-500">No transactions found</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-9">
                        <TableHead className="h-9">Date</TableHead>
                        <TableHead className="h-9">Description</TableHead>
                        <TableHead className="text-right h-9">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.slice(0, 10).map((transaction) => (
                        <TableRow key={transaction.id} className="h-11">
                          <TableCell className="py-2 text-sm">
                            {format(new Date(transaction.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="py-2">
                            <div>
                              <p className="text-sm font-medium">
                                {transaction.merchant || transaction.description}
                              </p>
                              {transaction.merchant && transaction.merchant !== transaction.description && (
                                <p className="text-xs text-slate-500">{transaction.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`text-sm font-medium ${
                              transaction.type === 'expense'
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}>
                              {transaction.type === 'expense' ? '-' : '+'}
                              {formatCurrency(Math.abs(parseFloat(transaction.amount) || 0))}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {transactions.length > 10 && (
                    <div className="p-3 text-center border-t">
                      <p className="text-xs text-slate-500">
                        Showing 10 of {transactions.length} transactions
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
