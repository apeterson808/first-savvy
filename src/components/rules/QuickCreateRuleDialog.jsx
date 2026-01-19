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

  useEffect(() => {
    if (transaction && open) {
      const suggested = `Auto-categorize "${transaction.description.substring(0, 30)}${transaction.description.length > 30 ? '...' : ''}"`;
      setRuleName(suggested);
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Create Rule
          </DialogTitle>
          <DialogDescription>
            Create a rule to automatically process similar transactions
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name" className="flex items-center gap-1">
                Rule Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rule-name"
                placeholder="Enter a unique name for this rule"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className={nameError ? 'border-red-500' : ''}
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

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-semibold">Apply to</Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="direction" className="text-sm">Transaction Direction</Label>
                  <Select value={moneyDirection} onValueChange={setMoneyDirection}>
                    <SelectTrigger id="direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both (Money In & Out)</SelectItem>
                      <SelectItem value="money_in">Money In</SelectItem>
                      <SelectItem value="money_out">Money Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Accounts to Search</Label>
                  <Select
                    open={accountsDropdownOpen}
                    onOpenChange={setAccountsDropdownOpen}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {selectedAccountIds.length === 0 ? 'All Accounts' :
                         selectedAccountIds.length === bankAccounts.length ? 'All Accounts' :
                         selectedAccountIds.length === 1 ? getAccountName(selectedAccountIds[0]) :
                         `${selectedAccountIds.length} Accounts Selected`}
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
                        <span className="font-medium">All Accounts</span>
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
                          <span className="text-sm">{account.display_name || account.account_name}</span>
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Include the following</Label>
                <ToggleGroup
                  type="single"
                  value={matchLogic}
                  onValueChange={(value) => value && setMatchLogic(value)}
                  className="gap-0"
                >
                  <ToggleGroupItem value="any" className="h-7 px-3 text-xs rounded-r-none">
                    Any
                  </ToggleGroupItem>
                  <ToggleGroupItem value="all" className="h-7 px-3 text-xs rounded-l-none">
                    All
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {conditionRows.map((row, index) => (
                <div key={index}>
                  {index > 0 && (
                    <div className="text-xs text-slate-500 my-1 ml-2">
                      {matchLogic === 'all' ? 'and' : 'or'}
                    </div>
                  )}
                  <div className="grid grid-cols-[120px_120px_1fr_24px] gap-2">
                    <Select
                      value={row.field}
                      onValueChange={(value) => updateConditionRow(index, 'field', value)}
                    >
                      <SelectTrigger className="text-xs">
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
                      <SelectTrigger className="text-xs">
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
                      className="text-xs"
                    />

                    {conditionRows.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => removeConditionRow(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={addConditionRow}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add a condition
              </Button>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-semibold">Then</Label>

              <div className="grid grid-cols-[1fr_140px] gap-2">
                <div className="space-y-2">
                  <Label className="text-sm">Set Category</Label>
                  <CategoryDropdown
                    value={categoryId}
                    onValueChange={setCategoryId}
                    transactionType={transaction?.type === 'income' ? 'income' : 'expense'}
                    placeholder="Select category..."
                    triggerClassName="h-9 text-sm border-slate-300"
                    onAddNew={() => {}}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Contact</Label>
                  <ContactDropdown
                    value={contactId}
                    onValueChange={setContactId}
                    onAddNew={(searchTerm) => {
                      setContactSearchTerm(searchTerm);
                      setAddContactSheetOpen(true);
                    }}
                    triggerClassName="h-9 text-sm border-slate-300"
                    placeholder="Select contact"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-desc" className="text-sm flex items-center gap-1.5">
                  Change Description To
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>If left blank bank memo will be used for each transaction</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="new-desc"
                  placeholder="Enter new description (optional)"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm">Add Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Optional notes to add to matching transactions"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Automatically confirm and post</Label>
                  <p className="text-xs text-slate-500">
                    Matching transactions will be automatically posted without review
                  </p>
                </div>
                <Switch
                  checked={autoConfirmAndPost}
                  onCheckedChange={setAutoConfirmAndPost}
                />
              </div>
            </div>
          </div>

          <Card className="flex flex-col h-[600px]">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Preview - Pending Transactions</CardTitle>
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

            <CardContent className="flex-1 overflow-auto space-y-2 pt-0">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : previewTransactions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  <p>No pending transactions match</p>
                  <p className="text-xs mt-1">Add conditions to see preview</p>
                </div>
              ) : (
                previewTransactions.map((txn) => {
                  const willChangeDescription = newDescription && txn.description !== newDescription;
                  const displayDescription = newDescription || txn.description;
                  const displayCategoryId = categoryId || txn.category_account_id;
                  const displayCategory = displayCategoryId ? getCategoryName(displayCategoryId) : 'Uncategorized';
                  const categoryWillChange = categoryId && txn.category_account_id !== categoryId;

                  return (
                    <div key={txn.id} className="bg-white border border-slate-200 rounded-lg p-2.5 hover:border-slate-300 transition-colors">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-600 font-medium min-w-[60px] flex-shrink-0">
                          {format(new Date(txn.date), 'MM/dd/yy')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium truncate ${willChangeDescription ? 'text-blue-600' : 'text-slate-900'}`}>
                            {displayDescription}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 flex-shrink-0">
                          <span>{txn.contact_id ? 'Contact' : '—'}</span>
                          <span className={categoryWillChange ? 'text-blue-600 font-medium' : ''}>
                            {displayCategory}
                          </span>
                          <span>{getAccountName(txn.bank_account_id)}</span>
                        </div>
                        <div className="font-semibold text-right min-w-[80px] flex-shrink-0">
                          {txn.amount < 0 ? (
                            <span className="text-red-600">
                              -${Math.abs(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-green-600">
                              +${Math.abs(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || checkingName || !!nameError}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Rule'}
          </Button>
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
