import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { transactionRulesApi } from '../../api/transactionRules';
import { getUserChartOfAccounts } from '../../api/chartOfAccounts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import ChartAccountDropdown from '../common/ChartAccountDropdown';
import CategoryDropdown from '../common/CategoryDropdown';
import ContactDropdown from '../common/ContactDropdown';
import AddContactSheet from '../contacts/AddContactSheet';
import { Sparkles, Plus, X, Loader2, ArrowRight, AlertCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { formatCurrency } from '../utils/formatters';
import { format } from 'date-fns';

export function QuickCreateRuleDialog({ open, onOpenChange, transaction, profileId }) {
  const queryClient = useQueryClient();

  const [ruleName, setRuleName] = useState('');
  const [nameError, setNameError] = useState('');
  const [checkingName, setCheckingName] = useState(false);

  const [moneyDirection, setMoneyDirection] = useState('both');
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [accountsDropdownOpen, setAccountsDropdownOpen] = useState(false);

  const [conditionRows, setConditionRows] = useState([
    { field: 'description', operator: 'contains', value: '' }
  ]);
  const [matchLogic, setMatchLogic] = useState('any');

  const [newDescription, setNewDescription] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [contactId, setContactId] = useState(null);
  const [notes, setNotes] = useState('');
  const [autoConfirmAndPost, setAutoConfirmAndPost] = useState(false);

  const [previewTransactions, setPreviewTransactions] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [addContactSheetOpen, setAddContactSheetOpen] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['user-chart-accounts', profileId],
    queryFn: () => getUserChartOfAccounts(profileId),
    enabled: !!profileId && open
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', profileId],
    queryFn: async () => {
      const { data, error } = await firstsavvy.from('contacts').select('*').eq('profile_id', profileId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId && open
  });

  useEffect(() => {
    if (transaction && open) {
      setCategoryId(transaction.category_account_id || null);
      setContactId(transaction.contact_id || null);
      setConditionRows([
        { field: 'description', operator: 'contains', value: transaction.description }
      ]);
      setSelectedAccountIds(transaction.bank_account_id ? [transaction.bank_account_id] : []);
    }
  }, [transaction, open]);

  const checkNameUniqueness = useCallback(async (name) => {
    if (!name.trim()) {
      setNameError('');
      return;
    }

    setCheckingName(true);
    try {
      const isUnique = await transactionRulesApi.checkRuleNameUnique(profileId, name);
      if (!isUnique) {
        setNameError('A rule with this name already exists');
      } else {
        setNameError('');
      }
    } catch (error) {
      console.error('Error checking name:', error);
    } finally {
      setCheckingName(false);
    }
  }, [profileId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ruleName) {
        checkNameUniqueness(ruleName);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [ruleName, checkNameUniqueness]);

  const loadPreview = useCallback(async () => {
    if (!open) return;

    const hasConditions = conditionRows.some(row => row.value.trim());
    if (!hasConditions) {
      setPreviewTransactions([]);
      return;
    }

    setPreviewLoading(true);
    try {
      const conditions = {
        match_description_mode: conditionRows[0]?.operator || 'contains',
        match_case_sensitive: false,
        match_money_direction: moneyDirection,
        match_bank_account_ids: selectedAccountIds.length > 0 ? selectedAccountIds : null,
      };

      conditionRows.forEach(row => {
        if (row.value.trim()) {
          if (row.field === 'description') {
            conditions.match_description_pattern = row.value;
          } else if (row.field === 'bank_memo') {
            conditions.match_original_description_pattern = row.value;
          } else if (row.field === 'amount') {
            if (row.operator === 'exact') {
              conditions.match_amount_exact = parseFloat(row.value);
            } else if (row.operator === 'greater_than') {
              conditions.match_amount_min = parseFloat(row.value);
            } else if (row.operator === 'less_than') {
              conditions.match_amount_max = parseFloat(row.value);
            }
          }
        }
      });

      const preview = await transactionRulesApi.getMatchPreview(profileId, conditions, 10);
      setPreviewTransactions(preview);
    } catch (error) {
      console.error('Error loading preview:', error);
      setPreviewTransactions([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [profileId, conditionRows, moneyDirection, selectedAccountIds, open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPreview();
    }, 500);

    return () => clearTimeout(timer);
  }, [loadPreview]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return transactionRulesApi.createRule(profileId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transaction-rules']);
      toast.success('Rule created successfully');
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Error creating rule:', error);
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        toast.error('A rule with this name already exists');
      } else {
        toast.error('Failed to create rule');
      }
    }
  });

  const resetForm = () => {
    setRuleName('');
    setNameError('');
    setMoneyDirection('both');
    setSelectedAccountIds([]);
    setConditionRows([{ field: 'description', operator: 'contains', value: '' }]);
    setMatchLogic('all');
    setNewDescription('');
    setCategoryId(null);
    setContactId(null);
    setNotes('');
    setAutoConfirmAndPost(false);
    setPreviewTransactions([]);
  };

  const handleCreate = () => {
    if (!ruleName.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    if (nameError) {
      toast.error('Please fix the rule name error');
      return;
    }

    const hasConditions = conditionRows.some(row => row.value.trim());
    if (!hasConditions) {
      toast.error('Please specify at least one search condition');
      return;
    }

    if (!newDescription && !categoryId && !contactId && !notes) {
      toast.error('Please specify at least one action');
      return;
    }

    const ruleData = {
      name: ruleName.trim(),
      match_money_direction: moneyDirection,
      match_bank_account_ids: selectedAccountIds.length > 0 ? selectedAccountIds : null,
      match_conditions_logic: matchLogic,
      match_description_mode: 'contains',
      match_case_sensitive: false,
    };

    conditionRows.forEach(row => {
      if (row.value.trim()) {
        if (row.field === 'description') {
          ruleData.match_description_pattern = row.value;
          ruleData.match_description_mode = row.operator;
        } else if (row.field === 'bank_memo') {
          ruleData.match_original_description_pattern = row.value;
          ruleData.match_description_mode = row.operator;
        } else if (row.field === 'amount') {
          if (row.operator === 'exact') {
            ruleData.match_amount_exact = parseFloat(row.value);
          } else if (row.operator === 'greater_than') {
            ruleData.match_amount_min = parseFloat(row.value);
          } else if (row.operator === 'less_than') {
            ruleData.match_amount_max = parseFloat(row.value);
          }
        }
      }
    });

    if (newDescription) {
      ruleData.action_set_description = newDescription;
    }
    if (categoryId) {
      ruleData.action_set_category_id = categoryId;
    }
    if (contactId) {
      ruleData.action_set_contact_id = contactId;
    }
    if (notes) {
      ruleData.action_add_note = notes;
    }

    ruleData.auto_confirm_and_post = autoConfirmAndPost;

    createMutation.mutate(ruleData);
  };

  const addConditionRow = () => {
    setConditionRows([...conditionRows, { field: 'description', operator: 'contains', value: '' }]);
  };

  const removeConditionRow = (index) => {
    if (conditionRows.length > 1) {
      setConditionRows(conditionRows.filter((_, i) => i !== index));
    }
  };

  const updateConditionRow = (index, field, value) => {
    const updated = [...conditionRows];
    updated[index][field] = value;
    setConditionRows(updated);
  };

  const getOperatorOptions = (field) => {
    if (field === 'amount') {
      return [
        { value: 'exact', label: 'Equal To' },
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' }
      ];
    }
    return [
      { value: 'contains', label: 'Contains' },
      { value: 'exact', label: 'Exact Match' },
      { value: 'starts_with', label: 'Starts With' },
      { value: 'ends_with', label: 'Ends With' }
    ];
  };

  const bankAccounts = accounts.filter(a =>
    ['asset', 'liability'].includes(a.class) &&
    a.display_in_sidebar
  );

  const allAccountsSelected = selectedAccountIds.length === bankAccounts.length;

  const toggleAllAccounts = () => {
    if (allAccountsSelected) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(bankAccounts.map(a => a.id));
    }
  };

  const toggleAccount = (accountId) => {
    setSelectedAccountIds(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.display_name || account?.account_name || 'Unknown';
  };

  const getCategoryName = (categoryId) => {
    const category = accounts.find(a => a.id === categoryId);
    return category?.display_name || category?.account_name || 'Uncategorized';
  };

  if (!transaction) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>
            Create Rule
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-3 flex-shrink-0">
          <div className="space-y-2">
            <Input
              id="rule-name"
              placeholder="Create rule name..."
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className={nameError ? 'border-red-500 h-10' : 'h-10'}
            />
            {nameError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {nameError}
              </p>
            )}
            {checkingName && (
              <p className="text-xs text-slate-500">Checking availability...</p>
            )}
          </div>
        </div>

        <div className="space-y-4 px-6 flex-1 overflow-y-auto py-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col h-[300px] shrink-0">
              <CardContent className="space-y-2 pt-3 flex-1">

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="direction" className="text-xs">Money In/Out</Label>
                    <Select value={moneyDirection} onValueChange={setMoneyDirection}>
                      <SelectTrigger id="direction" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Both</SelectItem>
                        <SelectItem value="money_in">Money In</SelectItem>
                        <SelectItem value="money_out">Money Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Accounts</Label>
                    <Select
                      open={accountsDropdownOpen}
                      onOpenChange={setAccountsDropdownOpen}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue>
                          {selectedAccountIds.length === 0 ? 'All' :
                           selectedAccountIds.length === bankAccounts.length ? 'All' :
                           selectedAccountIds.length === 1 ? getAccountName(selectedAccountIds[0]) :
                           `${selectedAccountIds.length} Selected`}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <div
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-100 rounded"
                          onClick={(e) => {
                            e.preventDefault();
                            toggleAllAccounts();
                          }}
                        >
                          <Checkbox
                            checked={allAccountsSelected}
                            onCheckedChange={toggleAllAccounts}
                          />
                          <span className="font-medium text-xs">All Accounts</span>
                        </div>
                        {bankAccounts.map(account => (
                          <div
                            key={account.id}
                            className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-100 rounded"
                            onClick={(e) => {
                              e.preventDefault();
                              toggleAccount(account.id);
                            }}
                          >
                            <Checkbox
                              checked={selectedAccountIds.includes(account.id)}
                              onCheckedChange={() => toggleAccount(account.id)}
                            />
                            <span className="text-xs">{account.display_name || account.account_name}</span>
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-slate-600">Include</Label>
                    <ToggleGroup
                      type="single"
                      value={matchLogic}
                      onValueChange={(value) => value && setMatchLogic(value)}
                      className="gap-0 border border-slate-300 rounded-md bg-white"
                    >
                      <ToggleGroupItem
                        value="any"
                        className="h-5 px-2 text-xs rounded-r-none border-0 data-[state=on]:bg-slate-200 data-[state=on]:text-slate-900"
                      >
                        Any
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="all"
                        className="h-5 px-2 text-xs rounded-l-none border-0 data-[state=on]:bg-slate-200 data-[state=on]:text-slate-900"
                      >
                        All
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div className="space-y-2">
                    {conditionRows.map((row, index) => (
                      <div key={index}>
                        {index > 0 && (
                          <div className="text-xs text-slate-500 my-1 ml-2">
                            {matchLogic === 'all' ? 'and' : 'or'}
                          </div>
                        )}
                        <div className="grid grid-cols-[110px_110px_1fr_24px] gap-1.5">
                          <Select
                            value={row.field}
                            onValueChange={(value) => updateConditionRow(index, 'field', value)}
                          >
                            <SelectTrigger className="text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="description">Description</SelectItem>
                              <SelectItem value="bank_memo">Bank Memo</SelectItem>
                              <SelectItem value="amount">Amount</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={row.operator}
                            onValueChange={(value) => updateConditionRow(index, 'operator', value)}
                          >
                            <SelectTrigger className="text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getOperatorOptions(row.field).map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Input
                            placeholder={row.field === 'amount' ? '0.00' : 'Enter text...'}
                            type={row.field === 'amount' ? 'number' : 'text'}
                            value={row.value}
                            onChange={(e) => updateConditionRow(index, 'value', e.target.value)}
                            className="text-xs h-8 w-full"
                          />

                          {conditionRows.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-6 p-0"
                              onClick={() => removeConditionRow(index)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={addConditionRow}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add condition
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col h-[300px] shrink-0">
              <CardContent className="space-y-2 pt-3 flex-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contact</Label>
                    <ContactDropdown
                      value={contactId}
                      onValueChange={setContactId}
                      onAddNew={(searchTerm) => {
                        setContactSearchTerm(searchTerm);
                        setAddContactSheetOpen(true);
                      }}
                      triggerClassName="h-8 text-xs border-slate-300"
                      placeholder="Select"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <CategoryDropdown
                      value={categoryId}
                      onValueChange={setCategoryId}
                      transactionType={transaction?.type === 'income' ? 'income' : 'expense'}
                      placeholder="Select category..."
                      triggerClassName="h-8 text-xs border-slate-300"
                      onAddNew={() => {}}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-desc" className="text-xs flex items-center gap-1.5">
                    Change Description To
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-slate-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>If left blank bank memo will be used</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="new-desc"
                    placeholder="Enter new description (optional)"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs">Add Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Optional notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="flex flex-col h-[220px] shrink-0">
            <CardHeader className="pb-1 pt-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Preview</CardTitle>
                <div className="flex items-center gap-2">
                  {previewLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  {!previewLoading && previewTransactions.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {previewTransactions.length} match{previewTransactions.length !== 1 ? 'es' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto pt-0 pb-2">
              {previewLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : previewTransactions.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  <p>No pending transactions match</p>
                  <p className="text-xs mt-1">Add conditions to see preview</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {previewTransactions.map((txn) => {
                    const willChangeDescription = newDescription && txn.description !== newDescription;
                    const displayDescription = newDescription || txn.original_description || txn.description;
                    const displayCategoryId = categoryId || txn.category_account_id;
                    const displayCategory = displayCategoryId ? getCategoryName(displayCategoryId) : 'Uncategorized';
                    const categoryWillChange = categoryId && txn.category_account_id !== categoryId;
                    const isSourceTransaction = transaction && txn.id === transaction.id;
                    const displayContact = contactId ? (contacts.find(c => c.id === contactId)?.name || 'Contact') : (txn.contact_id ? (contacts.find(c => c.id === txn.contact_id)?.name || 'Contact') : '—');

                    return (
                      <div
                        key={txn.id}
                        className={`border rounded p-1.5 text-xs ${isSourceTransaction ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'}`}
                      >
                        <div className="grid grid-cols-[80px_120px_1fr_90px_110px_115px] gap-3 items-center">
                          <span className="text-slate-600">
                            {format(new Date(txn.date), 'MM/dd/yy')}
                          </span>
                          <span className="text-slate-600 truncate">
                            {getAccountName(txn.bank_account_id)}
                          </span>
                          <span className={`truncate ${willChangeDescription ? 'text-blue-600 font-medium' : 'text-slate-900'}`}>
                            {displayDescription}
                          </span>
                          <span className="font-medium text-right">
                            {txn.amount < 0 ? (
                              <span className="text-red-600">
                                -${Math.abs(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-green-600">
                                +${Math.abs(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </span>
                          <span className="text-slate-600 truncate">
                            {displayContact}
                          </span>
                          <span className={`truncate ${categoryWillChange ? 'text-blue-600 font-medium' : 'text-slate-600'}`}>
                            {displayCategory}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="px-6 py-4 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoConfirmAndPost}
              onCheckedChange={setAutoConfirmAndPost}
            />
            <Label className="text-sm font-normal cursor-pointer" onClick={() => setAutoConfirmAndPost(!autoConfirmAndPost)}>
              Auto-post transactions
            </Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || checkingName || !!nameError}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AddContactSheet
      open={addContactSheetOpen}
      onOpenChange={(open) => {
        setAddContactSheetOpen(open);
        if (!open) {
          setContactSearchTerm('');
        }
      }}
      initialContactName={contactSearchTerm}
      onContactCreated={(newContact) => {
        if (newContact?.id) {
          setContactId(newContact.id);
        }
        setContactSearchTerm('');
      }}
    />
  </>
  );
}
