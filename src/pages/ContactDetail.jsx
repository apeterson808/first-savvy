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
import { Separator } from '@/components/ui/separator';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { Mail, Phone, MapPin, Tag, FileText, TrendingUp, DollarSign, Hash, Calendar, Edit2, Save, X, Trash2, ArrowLeft, ChevronDown, Building2, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import AccountDetectionField from '@/components/contacts/AccountDetectionField';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/utils/formatters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TransactionTimeline from '@/components/contacts/TransactionTimeline';
import CategoryBreakdown from '@/components/contacts/CategoryBreakdown';
import TransactionVolume from '@/components/contacts/TransactionVolume';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts, getDisplayName } from '@/api/chartOfAccounts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { user } = useAuth();
  const { activeProfile } = useProfile();

  const { data: contact, isLoading: contactLoading, error: contactError } = useQuery({
    queryKey: ['contact', id, activeProfile?.id],
    queryFn: () => firstsavvy.entities.Contact.get(id),
    enabled: !!id && !!activeProfile
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'contact', id, activeProfile?.id],
    queryFn: async () => {
      if (!id) return [];
      const allTransactions = await firstsavvy.entities.Transaction.list('date', 'desc');
      return allTransactions.filter(t => t.contact_id === id);
    },
    enabled: !!id && !!activeProfile
  });

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts.filter(a => a.level === 3);
    },
    enabled: !!activeProfile
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

      await firstsavvy.entities.Contact.update(contact.id, {
        invitation_id: invitation.id,
        connection_status: 'invited'
      });

      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Invitation sent to ${value}!`);
      return invitation;
    } catch (error) {
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

  if (contactError) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4">
            <div className="text-red-600">Failed to load contact</div>
            <div className="text-sm text-slate-500">{contactError.message}</div>
            <Button onClick={() => navigate('/contacts')} variant="outline">
              Back to Contacts
            </Button>
          </div>
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
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/contacts')}
              className="gap-2 hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <span>More</span>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditMode(false);
                      setPhoneValue(contact.phone || '');
                      setEmailValue(contact.email || '');
                      setDetectedUser(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      const form = document.getElementById('contact-form');
                      if (form) {
                        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                      }
                    }}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-slate-50/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-slate-600" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900">{contact.name}</h1>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="capitalize font-normal">
                          {contact.type}
                        </Badge>
                        {contact.status && (
                          <Badge
                            className={
                              contact.status.toLowerCase() === 'active'
                                ? 'bg-soft-green/30 text-forest-green font-normal'
                                : 'bg-gray-100 text-gray-800 font-normal'
                            }
                          >
                            {contact.status}
                          </Badge>
                        )}
                        {contact.connection_status === 'connected' && (
                          <Badge className="bg-light-blue/20 text-sky-blue font-normal">
                            Connected
                          </Badge>
                        )}
                        {contact.connection_status === 'invited' && (
                          <Badge className="bg-yellow-100 text-yellow-800 font-normal">
                            Invited
                          </Badge>
                        )}
                        {contact.connection_status === 'platform_user' && (
                          <Badge className="bg-purple-100 text-purple-800 font-normal">
                            On Platform
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isEditMode ? (
                  <form id="contact-form" onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name" className="text-sm font-medium">Display name *</Label>
                        <Input
                          id="name"
                          name="name"
                          defaultValue={contact.name}
                          placeholder="Contact name"
                          required
                          className="mt-1.5"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="type" className="text-sm font-medium">Type *</Label>
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
                          <Label htmlFor="status" className="text-sm font-medium">Status *</Label>
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

                      <Separator />

                      <div>
                        <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                          placeholder="contact@example.com"
                          className="mt-1.5"
                        />
                        <p className="text-xs text-slate-500 mt-1.5">
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
                        <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={phoneValue}
                          onChange={handlePhoneChange}
                          placeholder="(555) 123-4567"
                          maxLength={14}
                          className="mt-1.5"
                        />
                        <p className="text-xs text-slate-500 mt-1.5">
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
                        <Label htmlFor="address" className="text-sm font-medium">Address</Label>
                        <Textarea
                          id="address"
                          name="address"
                          defaultValue={contact.address}
                          placeholder="Street address, city, state, zip"
                          rows={2}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                        <Textarea
                          id="notes"
                          name="notes"
                          defaultValue={contact.notes}
                          placeholder="Additional notes"
                          rows={3}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Contact Information</p>
                      <div className="space-y-3">
                        {contact.email && (
                          <div className="flex items-start gap-3">
                            <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-slate-500">Email</p>
                              <p className="text-sm text-slate-900 mt-0.5">{contact.email}</p>
                            </div>
                          </div>
                        )}

                        {contact.phone && (
                          <div className="flex items-start gap-3">
                            <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-slate-500">Phone</p>
                              <p className="text-sm text-slate-900 mt-0.5">{contact.phone}</p>
                            </div>
                          </div>
                        )}

                        {contact.address && (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-slate-500">Address</p>
                              <p className="text-sm text-slate-900 mt-0.5">{contact.address}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {contact.notes && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Notes</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{contact.notes}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="border-b bg-slate-50/50">
                <h2 className="text-lg font-semibold text-slate-900">Transaction History</h2>
                <p className="text-sm text-slate-600 mt-1">Recent activity and transaction details</p>
              </CardHeader>
              <CardContent className="p-6">
                {transactionsLoading ? (
                  <p className="text-center text-slate-500 py-8">Loading transactions...</p>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium mb-1">No transactions yet</p>
                    <p className="text-sm text-slate-500">Transactions with this contact will appear here</p>
                  </div>
                ) : (
                  <>
                    <Tabs defaultValue="list" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 mb-6">
                        <TabsTrigger value="list">List</TabsTrigger>
                        <TabsTrigger value="timeline">Timeline</TabsTrigger>
                        <TabsTrigger value="categories">Categories</TabsTrigger>
                        <TabsTrigger value="volume">Volume</TabsTrigger>
                      </TabsList>

                      <TabsContent value="list" className="mt-0">
                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50">
                                <TableHead className="font-semibold">Date</TableHead>
                                <TableHead className="font-semibold">Description</TableHead>
                                <TableHead className="font-semibold">Category</TableHead>
                                <TableHead className="font-semibold">Type</TableHead>
                                <TableHead className="text-right font-semibold">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {transactions.slice(0, 10).map((transaction) => (
                                <TableRow key={transaction.id} className="hover:bg-slate-50">
                                  <TableCell className="text-sm">{format(new Date(transaction.date), 'MMM d, yyyy')}</TableCell>
                                  <TableCell className="font-medium text-sm">{transaction.description}</TableCell>
                                  <TableCell className="text-sm">
                                    {chartAccounts.find(c => c.id === transaction.category_account_id) ? getDisplayName(chartAccounts.find(c => c.id === transaction.category_account_id)) : '-'}
                                  </TableCell>
                                  <TableCell className="capitalize">
                                    <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'} className="font-normal">
                                      {transaction.type === 'income' && transaction.original_type === 'expense' ? 'refund' : transaction.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-sm">
                                    {formatCurrency(transaction.amount)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {transactions.length > 10 && (
                          <p className="text-sm text-slate-500 text-center mt-4">
                            Showing 10 of {transactions.length} transactions
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="timeline" className="mt-0">
                        <TransactionTimeline transactions={transactions} />
                      </TabsContent>

                      <TabsContent value="categories" className="mt-0">
                        <CategoryBreakdown transactions={transactions} categories={chartAccounts} />
                      </TabsContent>

                      <TabsContent value="volume" className="mt-0">
                        <TransactionVolume transactions={transactions} />
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-slate-50/50">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Overview</h3>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <Hash className="w-4 h-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Total Transactions</p>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{analytics.transactionCount}</p>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 text-burgundy mb-2">
                      <DollarSign className="w-4 h-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Total Spent</p>
                    </div>
                    <p className="text-2xl font-bold text-burgundy">{formatCurrency(analytics.totalSpent)}</p>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 text-forest-green mb-2">
                      <TrendingUp className="w-4 h-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Total Income</p>
                    </div>
                    <p className="text-2xl font-bold text-forest-green">{formatCurrency(analytics.totalIncome)}</p>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 text-sky-blue mb-2">
                      <Calendar className="w-4 h-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Avg Transaction</p>
                    </div>
                    <p className="text-2xl font-bold text-sky-blue">{formatCurrency(analytics.avgTransaction)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {analytics.firstTransaction && (
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Activity Period</h3>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">First Transaction</p>
                      <p className="text-sm font-semibold text-slate-900">{format(new Date(analytics.firstTransaction), 'MMM d, yyyy')}</p>
                    </div>
                    {analytics.lastTransaction && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Last Transaction</p>
                        <p className="text-sm font-semibold text-slate-900">{format(new Date(analytics.lastTransaction), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
