import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Mail, Phone, MapPin, Tag, FileText, TrendingUp, DollarSign, Hash, Calendar, Edit2, Save, X, Trash2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import AccountDetectionField from '@/components/contacts/AccountDetectionField';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/utils/formatters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TransactionTimeline from '@/components/contacts/TransactionTimeline';
import CategoryBreakdown from '@/components/contacts/CategoryBreakdown';
import TransactionVolume from '@/components/contacts/TransactionVolume';

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

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [detectedUser, setDetectedUser] = useState(null);
  const queryClient = useQueryClient();

  const { data: contact, isLoading: contactLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => firstsavvy.entities.Contact.get(id),
    enabled: !!id
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'contact', id],
    queryFn: async () => {
      if (!id) return [];
      const allTransactions = await firstsavvy.entities.Transaction.list('date', 'desc');
      return allTransactions.filter(t => t.contact_id === id);
    },
    enabled: !!id
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => firstsavvy.entities.Category.list('name')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => firstsavvy.entities.Contact.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsEditMode(false);
      toast.success('Contact updated successfully');
    },
    onError: (error) => {
      console.error('Update failed:', error);
      toast.error(`Failed to update contact: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => firstsavvy.entities.Contact.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted');
      navigate('/contacts');
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

      queryClient.invalidateQueries({ queryKey: ['contact', id] });
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

      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Invitation sent to ${value}!`);
      return invitation;
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation');
    }
  };

  useEffect(() => {
    if (contact) {
      setPhoneValue(contact.phone || '');
      setEmailValue(contact.email || '');
      setDetectedUser(null);
    }
  }, [contact]);

  const analytics = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        totalSpent: 0,
        totalIncome: 0,
        transactionCount: 0,
        avgTransaction: 0,
        firstTransaction: null,
        lastTransaction: null
      };
    }

    const spent = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const sortedByDate = [...transactions].sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    return {
      totalSpent: spent,
      totalIncome: income,
      transactionCount: transactions.length,
      avgTransaction: transactions.length > 0 ? (spent + income) / transactions.length : 0,
      firstTransaction: sortedByDate[0]?.date,
      lastTransaction: sortedByDate[sortedByDate.length - 1]?.date
    };
  }, [transactions]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const phoneDigits = phoneValue ? phoneValue.replace(/[^\d]/g, '') : '';

    if (phoneValue && phoneDigits.length > 0 && phoneDigits.length < 10) {
      toast.error('Phone number must include area code (10 digits)');
      return;
    }

    const type = formData.get('type');
    const status = formData.get('status');

    if (!type) {
      toast.error('Type is required');
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

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneValue(formatted);
  };

  if (contactLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-slate-500">Loading contact...</div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-slate-500">Contact not found</div>
          <div className="text-center mt-4">
            <Button onClick={() => navigate('/contacts')} variant="outline">
              Back to Contacts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/contacts')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Contacts
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {!isEditMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  className="gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditMode(false);
                  setPhoneValue(contact.phone || '');
                  setEmailValue(contact.email || '');
                  setDetectedUser(null);
                }}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold">{contact.name}</h1>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="capitalize">
                    {contact.type}
                  </Badge>
                  {contact.status && (
                    <Badge
                      className={
                        contact.status.toLowerCase() === 'active'
                          ? 'bg-soft-green/30 text-forest-green'
                          : 'bg-gray-100 text-gray-800'
                      }
                    >
                      {contact.status}
                    </Badge>
                  )}
                  {contact.connection_status === 'connected' && (
                    <Badge className="bg-light-blue/20 text-sky-blue">
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={contact.name}
                      placeholder="Contact name"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="type">Type *</Label>
                      <ClickThroughSelect
                        name="type"
                        defaultValue={contact.type}
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
                        defaultValue={contact.status}
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

                  <div className="md:col-span-2">
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

                  <div className="md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      defaultValue={contact.notes}
                      placeholder="Additional notes"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button type="submit" className="gap-2 bg-primary hover:bg-primary/90">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {contact.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">Email</p>
                        <p className="text-base">{contact.email}</p>
                      </div>
                    </div>
                  )}

                  {contact.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">Phone</p>
                        <p className="text-base">{contact.phone}</p>
                      </div>
                    </div>
                  )}

                  {contact.address && (
                    <div className="flex items-start gap-3 md:col-span-2">
                      <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">Address</p>
                        <p className="text-base">{contact.address}</p>
                      </div>
                    </div>
                  )}

                  {contact.default_category_id && (
                    <div className="flex items-start gap-3">
                      <Tag className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">Default Category</p>
                        <p className="text-base">
                          {categories.find(c => c.id === contact.default_category_id)?.name || '-'}
                        </p>
                      </div>
                    </div>
                  )}

                  {contact.notes && (
                    <div className="flex items-start gap-3 md:col-span-2">
                      <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">Notes</p>
                        <p className="text-base whitespace-pre-wrap">{contact.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Transaction Analytics</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <Hash className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Transactions</p>
                </div>
                <p className="text-2xl font-bold">{analytics.transactionCount}</p>
              </div>

              <div className="p-4 bg-burgundy/10 rounded-lg">
                <div className="flex items-center gap-2 text-burgundy mb-1">
                  <DollarSign className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Spent</p>
                </div>
                <p className="text-2xl font-bold text-burgundy">{formatCurrency(analytics.totalSpent)}</p>
              </div>

              <div className="p-4 bg-soft-green/20 rounded-lg">
                <div className="flex items-center gap-2 text-forest-green mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <p className="text-sm font-medium">Total Income</p>
                </div>
                <p className="text-2xl font-bold text-forest-green">{formatCurrency(analytics.totalIncome)}</p>
              </div>

              <div className="p-4 bg-light-blue/20 rounded-lg">
                <div className="flex items-center gap-2 text-sky-blue mb-1">
                  <Calendar className="w-4 h-4" />
                  <p className="text-sm font-medium">Avg Transaction</p>
                </div>
                <p className="text-2xl font-bold text-sky-blue">{formatCurrency(analytics.avgTransaction)}</p>
              </div>
            </div>

            {analytics.firstTransaction && (
              <div className="mb-6 pb-6 border-b text-sm text-slate-600">
                <p>
                  First transaction: <span className="font-medium">{format(new Date(analytics.firstTransaction), 'MMM d, yyyy')}</span>
                  {analytics.lastTransaction && (
                    <> • Last transaction: <span className="font-medium">{format(new Date(analytics.lastTransaction), 'MMM d, yyyy')}</span></>
                  )}
                </p>
              </div>
            )}

            <Tabs defaultValue="timeline" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
                <TabsTrigger value="volume">Volume</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="mt-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">Income vs Expenses Over Time</h3>
                  <p className="text-xs text-slate-500">Monthly breakdown of income and expenses</p>
                  <TransactionTimeline transactions={transactions} />
                </div>
              </TabsContent>
              <TabsContent value="categories" className="mt-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">Spending by Category</h3>
                  <p className="text-xs text-slate-500">Distribution of transaction amounts across categories</p>
                  <CategoryBreakdown transactions={transactions} categories={categories} />
                </div>
              </TabsContent>
              <TabsContent value="volume" className="mt-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">Transaction Activity</h3>
                  <p className="text-xs text-slate-500">Monthly transaction counts by type</p>
                  <TransactionVolume transactions={transactions} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Recent Transactions</h2>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <p className="text-center text-slate-500 py-4">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No transactions found for this contact</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 10).map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{format(new Date(transaction.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{transaction.description}</TableCell>
                        <TableCell>
                          {categories.find(c => c.id === transaction.category_id)?.name || '-'}
                        </TableCell>
                        <TableCell className="capitalize">
                          <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'}>
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
