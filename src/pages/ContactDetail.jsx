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
import { Mail, Phone, MapPin, FileText, TrendingUp, TrendingDown, Hash, Calendar, Edit2, ArrowLeft, ChevronDown, Trash2, Send, X, Check, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/utils/formatters';
import { useProfile } from '@/contexts/ProfileContext';
import { getUserChartOfAccounts, getDisplayName } from '@/api/chartOfAccounts';
import CategoryDropdown from '@/components/common/CategoryDropdown';
import ContactDropdown from '@/components/common/ContactDropdown';
import { TRANSACTION_TABLE_CONFIG, getRowClassName, getHeaderCellClassName, getBodyCellClassName } from '@/components/common/TransactionTableConfig';

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
  const [editingLineId, setEditingLineId] = useState(null);
  const [editingLine, setEditingLine] = useState(null);
  const [isSavingLine, setIsSavingLine] = useState(false);
  const queryClient = useQueryClient();
  const { activeProfile } = useProfile();

  const { data: contact, isLoading: contactLoading, error: contactError } = useQuery({
    queryKey: ['contact', id, activeProfile?.id],
    queryFn: () => firstsavvy.entities.Contact.get(id),
    enabled: !!id && !!activeProfile
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'contact', id, activeProfile?.id],
    queryFn: async () => {
      if (!id || !activeProfile) return [];
      const { data, error } = await firstsavvy
        .from('transactions')
        .select(`
          *,
          bank_account:user_chart_of_accounts!bank_account_id(id, account_name, display_name),
          category_account:user_chart_of_accounts!category_account_id(id, account_name, display_name)
        `)
        .eq('contact_id', id)
        .eq('status', 'posted')
        .eq('profile_id', activeProfile.id)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .limit(10000);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!activeProfile
  });

  const { data: chartAccounts = [] } = useQuery({
    queryKey: ['chart-accounts', activeProfile?.id],
    queryFn: async () => {
      if (!activeProfile) return [];
      const accounts = await getUserChartOfAccounts(activeProfile.id);
      return accounts;
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
    if (!transactions || transactions.length === 0) {
      return {
        moneyOut: 0,
        moneyIn: 0,
        netBalance: 0,
        transactionCount: 0,
        firstTransaction: null,
        lastTransaction: null
      };
    }

    const moneyOut = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    const moneyIn = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    const sortedByDate = [...transactions].sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    return {
      moneyOut,
      moneyIn,
      netBalance: moneyIn - moneyOut,
      transactionCount: transactions.length,
      firstTransaction: sortedByDate[0]?.date,
      lastTransaction: sortedByDate[sortedByDate.length - 1]?.date
    };
  }, [transactions]);

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

  const handleEditTransaction = (transaction, e) => {
    e.stopPropagation();
    setEditingLineId(transaction.id);
    setEditingLine({
      description: transaction.description || '',
      account_id: transaction.category_account_id || null,
      contact_id: transaction.contact_id || null
    });
  };

  const handleSaveLine = async (transactionId) => {
    if (!editingLine.description.trim()) {
      toast.error('Description is required');
      return;
    }

    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) {
      toast.error('Transaction not found');
      return;
    }

    setIsSavingLine(true);
    try {
      await firstsavvy.entities.Transaction.update(transactionId, {
        description: editingLine.description.trim(),
        category_account_id: editingLine.account_id,
        contact_id: editingLine.contact_id
      });

      queryClient.invalidateQueries({ queryKey: ['transactions', 'contact', id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budget-analytics'] });
      setEditingLineId(null);
      setEditingLine(null);
      toast.success('Transaction updated successfully');
    } catch (error) {
      toast.error(`Failed to update transaction: ${error.message}`);
    } finally {
      setIsSavingLine(false);
    }
  };

  const handleCancelLine = () => {
    setEditingLineId(null);
    setEditingLine(null);
  };

  const handleUndoTransaction = async (transactionId, e) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to undo this transaction? This will move it back to unposted status.')) {
      return;
    }

    try {
      await firstsavvy.rpc('undo_posted_transaction', { p_transaction_id: transactionId });

      queryClient.invalidateQueries({ queryKey: ['transactions', 'contact', id] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budget-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Transaction undone successfully');
    } catch (error) {
      toast.error(`Failed to undo transaction: ${error.message}`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (editingLineId && !e.target.closest('tr')) {
        handleCancelLine();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingLineId]);

  if (contactLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto">
          <div className="text-center text-slate-500">Loading contact...</div>
        </div>
      </div>
    );
  }

  if (contactError || !contact) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto">
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
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                {transactionsLoading ? (
                  <div className="p-8 text-center text-slate-500 text-sm">Loading transactions...</div>
                ) : transactions.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-slate-600 font-medium mb-1">No transactions yet</p>
                    <p className="text-sm text-slate-500">Transactions with this contact will appear here</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                      <TableHeader>
                        <TableRow className={TRANSACTION_TABLE_CONFIG.header.rowClass}>
                          {TRANSACTION_TABLE_CONFIG.columns.map((col) => (
                            <TableHead key={col.id} className={getHeaderCellClassName(col)}>
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction, index) => {
                          const isExpense = transaction.type === 'expense';
                          const isIncome = transaction.type === 'income';
                          const amount = Math.abs(transaction.amount || 0);
                          const isEditing = editingLineId === transaction.id;
                          const categoryAccount = transaction.category_account;
                          const bankAccount = transaction.bank_account;

                          return (
                            <TableRow key={transaction.id} className={getRowClassName(index)}>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[0])}>
                                {format(new Date(transaction.date), 'MM/dd/yy')}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[1])}>
                                {bankAccount ? getDisplayName(bankAccount) : '\u2014'}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[2])}>
                                {isEditing && editingLine ? (
                                  <input
                                    type="text"
                                    value={editingLine.description}
                                    onChange={(e) => setEditingLine(prev => ({ ...prev, description: e.target.value }))}
                                    className={TRANSACTION_TABLE_CONFIG.editField.inputClass}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    onClick={(e) => handleEditTransaction(transaction, e)}
                                    className={TRANSACTION_TABLE_CONFIG.editField.buttonClass}
                                  >
                                    {transaction.description}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[3])}>
                                {isEditing && editingLine ? (
                                  <ContactDropdown
                                    value={editingLine.contact_id}
                                    onValueChange={(value) => setEditingLine(prev => ({ ...prev, contact_id: value }))}
                                    triggerClassName={TRANSACTION_TABLE_CONFIG.editField.dropdownClass}
                                  />
                                ) : (
                                  <button
                                    onClick={(e) => handleEditTransaction(transaction, e)}
                                    className={TRANSACTION_TABLE_CONFIG.editField.buttonClass}
                                  >
                                    {contact?.name || '\u2014'}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[4])}>
                                {isEditing && editingLine ? (
                                  <CategoryDropdown
                                    value={editingLine.account_id}
                                    onValueChange={(value) => setEditingLine(prev => ({ ...prev, account_id: value }))}
                                    triggerClassName={TRANSACTION_TABLE_CONFIG.editField.dropdownClass}
                                    transactionType={transaction.type}
                                  />
                                ) : (
                                  <button
                                    onClick={(e) => handleEditTransaction(transaction, e)}
                                    className={TRANSACTION_TABLE_CONFIG.editField.buttonClass}
                                  >
                                    {categoryAccount ? getDisplayName(categoryAccount) : '\u2014'}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[5])}>
                                <span className={isExpense ? 'text-red-600' : isIncome ? 'text-green-600' : ''}>
                                  {formatCurrency(isExpense ? -amount : amount)}
                                </span>
                              </TableCell>
                              <TableCell className={getBodyCellClassName(TRANSACTION_TABLE_CONFIG.columns[6])}>
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelLine();
                                      }}
                                      className={TRANSACTION_TABLE_CONFIG.actionButtons.cancelClass}
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveLine(transaction.id);
                                      }}
                                      disabled={isSavingLine}
                                      className={TRANSACTION_TABLE_CONFIG.actionButtons.saveClass}
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={(e) => handleUndoTransaction(transaction.id, e)}
                                    className={TRANSACTION_TABLE_CONFIG.actionButtons.undoClass}
                                  >
                                    Undo
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
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
