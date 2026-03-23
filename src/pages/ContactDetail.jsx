import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, Phone, MapPin, FileText, TrendingUp, TrendingDown, Hash, Calendar, Edit2, ArrowLeft, ChevronDown, Trash2, Send, X, Check, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/utils/formatters';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts, getDisplayName } from '@/api/chartOfAccounts';
import { updateJournalEntryWithLines, getJournalEntryWithLines, getJournalLinesByContact, updateJournalEntryLine } from '@/api/journalEntries';
import CategoryDropdown from '@/components/common/CategoryDropdown';
import ContactDropdown from '@/components/common/ContactDropdown';

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

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    status: 'active'
  });
  const [expandedLineId, setExpandedLineId] = useState(null);
  const [editingLine, setEditingLine] = useState(null);
  const [isSavingLine, setIsSavingLine] = useState(false);
  const queryClient = useQueryClient();
  const { activeProfile } = useProfile();

  const { data: contact, isLoading: contactLoading, error: contactError } = useQuery({
    queryKey: ['contact', id, activeProfile?.id],
    queryFn: () => firstsavvy.entities.Contact.get(id),
    enabled: !!id && !!activeProfile
  });

  const { data: journalLines = [], isLoading: journalLinesLoading } = useQuery({
    queryKey: ['journal-lines', 'contact', id, activeProfile?.id],
    queryFn: async () => {
      if (!id || !activeProfile) return [];
      return await getJournalLinesByContact(activeProfile.id, id);
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


  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        address: contact.address || '',
        notes: contact.notes || '',
        status: contact.status || 'active'
      });
    }
  }, [contact]);

  const analytics = useMemo(() => {
    if (!journalLines || journalLines.length === 0) {
      return {
        moneyOut: 0,
        moneyIn: 0,
        netBalance: 0,
        transactionCount: 0,
        firstTransaction: null,
        lastTransaction: null
      };
    }

    const moneyOut = journalLines
      .filter(line => line.account?.account_class === 'Expense')
      .reduce((sum, line) => sum + (line.debit_amount || 0), 0);

    const moneyIn = journalLines
      .filter(line => line.account?.account_class === 'Revenue')
      .reduce((sum, line) => sum + (line.credit_amount || 0), 0);

    const sortedByDate = [...journalLines].sort((a, b) =>
      new Date(a.journal_entry.entry_date) - new Date(b.journal_entry.entry_date)
    );

    return {
      moneyOut,
      moneyIn,
      netBalance: moneyIn - moneyOut,
      transactionCount: journalLines.length,
      firstTransaction: sortedByDate[0]?.journal_entry.entry_date,
      lastTransaction: sortedByDate[sortedByDate.length - 1]?.journal_entry.entry_date
    };
  }, [journalLines]);

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    const phoneDigits = formData.phone ? formData.phone.replace(/[^\d]/g, '') : '';
    if (formData.phone && phoneDigits.length > 0 && phoneDigits.length < 10) {
      toast.error('Phone number must include area code (10 digits)');
      return;
    }

    const data = {
      name: formData.name.trim(),
      email: formData.email.trim() || undefined,
      phone: formData.phone || undefined,
      address: formData.address.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      status: formData.status
    };

    updateMutation.mutate({ id: contact.id, data });
  };

  const handleCancel = () => {
    setIsEditMode(false);
    if (contact) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        address: contact.address || '',
        notes: contact.notes || '',
        status: contact.status || 'active'
      });
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteMutation.mutate(contact.id);
    }
  };

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handleLineClick = (line) => {
    if (expandedLineId === line.id) {
      setExpandedLineId(null);
      setEditingLine(null);
    } else {
      setExpandedLineId(line.id);
      setEditingLine({
        description: line.description || '',
        account_id: line.account_id || null,
        contact_id: line.contact_id || null
      });
    }
  };

  const handleSaveLine = async (lineId) => {
    if (!editingLine.description.trim()) {
      toast.error('Description is required');
      return;
    }

    const line = journalLines.find(l => l.id === lineId);
    if (!line) {
      toast.error('Journal line not found');
      return;
    }

    setIsSavingLine(true);
    try {
      await updateJournalEntryLine({
        lineId: lineId,
        description: editingLine.description.trim(),
        accountId: editingLine.account_id,
        contactId: editingLine.contact_id
      });

      queryClient.invalidateQueries({ queryKey: ['journal-lines', 'contact', id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budget-analytics'] });
      setExpandedLineId(null);
      setEditingLine(null);
      toast.success('Transaction updated successfully');
    } catch (error) {
      toast.error(`Failed to update transaction: ${error.message}`);
    } finally {
      setIsSavingLine(false);
    }
  };

  const handleCancelLine = () => {
    setExpandedLineId(null);
    setEditingLine(null);
  };

  if (contactLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-slate-500">Loading contact...</div>
        </div>
      </div>
    );
  }

  if (contactError || !contact) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4">
            <div className="text-red-600">Failed to load contact</div>
            {contactError && <div className="text-sm text-slate-500">{contactError.message}</div>}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-center justify-between">
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
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="bg-primary hover:bg-primary/90"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start gap-6 mb-6">
                  <Avatar className="w-20 h-20 bg-gradient-to-br from-slate-200 to-slate-300">
                    <AvatarFallback className="text-xl font-semibold text-slate-700">
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    {isEditMode ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name" className="text-sm font-medium">Name *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Contact name"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="contact@example.com"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="(555) 123-4567"
                            maxLength={14}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="address" className="text-sm font-medium">Address</Label>
                          <Textarea
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="Street address, city, state, zip"
                            rows={2}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                          <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Additional notes"
                            rows={3}
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-2xl font-bold text-slate-900 mb-1">{contact.name}</h2>
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
                        </div>

                        <div className="space-y-3">
                          {contact.email && (
                            <div className="flex items-center gap-3 text-sm">
                              <Mail className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-700">{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-3 text-sm">
                              <Phone className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-700">{contact.phone}</span>
                            </div>
                          )}
                          {contact.address && (
                            <div className="flex items-center gap-3 text-sm">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-700">{contact.address}</span>
                            </div>
                          )}
                          {contact.notes && (
                            <div className="flex items-start gap-3 text-sm pt-2">
                              <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                              <span className="text-slate-700 whitespace-pre-wrap">{contact.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="text-lg font-semibold">Transaction History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {journalLinesLoading ? (
                  <div className="p-8 text-center text-slate-500">Loading transactions...</div>
                ) : journalLines.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-slate-600 font-medium mb-1">No transactions yet</p>
                    <p className="text-sm text-slate-500">Transactions with this contact will appear here</p>
                  </div>
                ) : (
                  <div className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {journalLines.map((line) => {
                          const isExpense = line.account?.account_class === 'Expense';
                          const isIncome = line.account?.account_class === 'Revenue';
                          const amount = isExpense ? line.debit_amount : line.credit_amount;

                          return (
                            <React.Fragment key={line.id}>
                              <TableRow
                                className="hover:bg-slate-50 cursor-pointer"
                                onClick={() => handleLineClick(line)}
                              >
                                <TableCell className="text-sm">
                                  {format(new Date(line.journal_entry.entry_date), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell className="font-medium text-sm">
                                  {expandedLineId === line.id && editingLine ? (
                                    <Input
                                      value={editingLine.description}
                                      onChange={(e) => setEditingLine(prev => ({ ...prev, description: e.target.value }))}
                                      className="h-8"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <div>
                                      {line.description}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className={isExpense ? 'text-burgundy' : 'text-forest-green'}>
                                      {formatCurrency(isExpense ? -Math.abs(amount) : Math.abs(amount))}
                                    </span>
                                    {expandedLineId === line.id ? (
                                      <ChevronUp className="w-4 h-4 text-slate-400" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-slate-400" />
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expandedLineId === line.id && editingLine && (
                                <TableRow>
                                  <TableCell colSpan={3} className="bg-slate-50 p-6">
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label className="text-sm font-medium mb-1.5">Category</Label>
                                          <CategoryDropdown
                                            value={editingLine.account_id}
                                            onValueChange={(value) => setEditingLine(prev => ({ ...prev, account_id: value }))}
                                            transactionType={isExpense ? 'expense' : 'income'}
                                            isTransactionTransfer={false}
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-sm font-medium mb-1.5">Contact</Label>
                                          <ContactDropdown
                                            value={editingLine.contact_id}
                                            onValueChange={(value) => setEditingLine(prev => ({ ...prev, contact_id: value }))}
                                          />
                                        </div>
                                      </div>
                                      <div className="flex justify-end gap-2 pt-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={handleCancelLine}
                                        >
                                          <X className="w-4 h-4 mr-1.5" />
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleSaveLine(line.id)}
                                          disabled={isSavingLine}
                                        >
                                          <Check className="w-4 h-4 mr-1.5" />
                                          {isSavingLine ? 'Saving...' : 'Save'}
                                        </Button>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="text-base font-semibold">Stats</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <TrendingDown className="w-4 h-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Money Out</p>
                    </div>
                    <p className="text-2xl font-bold text-burgundy">{formatCurrency(analytics.moneyOut)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total paid to them</p>
                  </div>

                  <div className="border-t pt-5">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Money In</p>
                    </div>
                    <p className="text-2xl font-bold text-forest-green">{formatCurrency(analytics.moneyIn)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total received from them</p>
                  </div>

                  <div className="border-t pt-5">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <Hash className="w-4 h-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Net Balance</p>
                    </div>
                    <p className={`text-2xl font-bold ${analytics.netBalance >= 0 ? 'text-forest-green' : 'text-burgundy'}`}>
                      {formatCurrency(Math.abs(analytics.netBalance))}
                    </p>
                    {analytics.transactionCount > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {analytics.netBalance >= 0 ? 'They owe you' : 'You owe them'}
                      </p>
                    )}
                  </div>

                  <div className="border-t pt-5">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                      <Hash className="w-4 h-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Transaction Count</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{analytics.transactionCount}</p>
                  </div>

                  {analytics.firstTransaction && (
                    <div className="border-t pt-5">
                      <div className="flex items-center gap-2 text-slate-600 mb-1">
                        <Calendar className="w-4 h-4" />
                        <p className="text-xs font-medium uppercase tracking-wider">First Transaction</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {format(new Date(analytics.firstTransaction), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}

                  {analytics.lastTransaction && (
                    <div className="border-t pt-5">
                      <div className="flex items-center gap-2 text-slate-600 mb-1">
                        <Calendar className="w-4 h-4" />
                        <p className="text-xs font-medium uppercase tracking-wider">Last Transaction</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {format(new Date(analytics.lastTransaction), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="text-base font-semibold">Connection Status</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    {contact.connection_status === 'connected' ? (
                      <Badge className="bg-light-blue/20 text-sky-blue font-normal">
                        Connected
                      </Badge>
                    ) : contact.connection_status === 'invited' ? (
                      <Badge className="bg-yellow-100 text-yellow-800 font-normal">
                        Invited
                      </Badge>
                    ) : contact.connection_status === 'platform_user' ? (
                      <Badge className="bg-lavender/20 text-burgundy font-normal">
                        On Platform
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Not Connected
                      </Badge>
                    )}
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="w-full gap-2 opacity-50 cursor-not-allowed"
                          >
                            <Send className="w-4 h-4" />
                            Invite to platform
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Coming soon</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
