import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { transactionRulesApi } from '../../api/transactionRules';
import { supabase } from '../../api/supabaseClient';
import { getUserChartOfAccounts } from '../../api/chartOfAccounts';
import { firstsavvy } from '../../api/firstsavvyClient';
import {
  Dialog,
  DialogContent,
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
import ContactDropdown from '../common/ContactDropdown';
import CategoryDropdown from '../common/CategoryDropdown';
import AddContactSheet from '../contacts/AddContactSheet';
import { Plus, X, Loader2, AlertCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { format } from 'date-fns';

export function RuleDialog({ open, onOpenChange, mode = 'create', rule = null, transaction = null, profileId, onPromoteSuccess }) {
  const queryClient = useQueryClient();
  const isEditMode = mode === 'edit' || mode === 'promote';
  const isPromoteMode = mode === 'promote';

  const [ruleName, setRuleName] = useState('');
  const [nameError, setNameError] = useState('');
  const [checkingName, setCheckingName] = useState(false);

  const [moneyDirection, setMoneyDirection] = useState('both');
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [accountsDropdownOpen, setAccountsDropdownOpen] = useState(false);

  const [conditionRows, setConditionRows] = useState([
    { field: 'bank_memo', operator: 'contains', value: '' }
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
    if (!open) {
      setRuleName('');
      setNameError('');
      setMoneyDirection('both');
      setSelectedAccountIds([]);
      setConditionRows([{ field: 'bank_memo', operator: 'contains', value: '' }]);
      setMatchLogic('any');
      setNewDescription('');
      setCategoryId(null);
      setContactId(null);
      setNotes('');
      setAutoConfirmAndPost(false);
      setPreviewTransactions([]);
      return;
    }

    if (isEditMode && rule) {
      setRuleName(isPromoteMode ? (rule.name || '').replace(/^Auto:\s*/i, '') : (rule.name || ''));
      setMoneyDirection(rule.match_money_direction || 'both');
      setSelectedAccountIds(rule.match_bank_account_ids || []);
      setMatchLogic(rule.match_conditions_logic || 'any');
      setNewDescription(rule.action_set_description || '');
      setCategoryId(rule.action_set_category_id || null);
      setContactId(rule.action_set_contact_id || null);
      setNotes(rule.action_add_note || '');
      setAutoConfirmAndPost(rule.auto_confirm_and_post || false);

      const rows = [];
      if (rule.match_description_pattern) {
        rows.push({
          field: 'description',
          operator: rule.match_description_mode || 'contains',
          value: rule.match_description_pattern
        });
      }
      if (rule.match_original_description_pattern) {
        rows.push({
          field: 'bank_memo',
          operator: rule.match_description_mode || 'contains',
          value: rule.match_original_description_pattern
        });
      }
      if (rule.match_amount_exact !== null && rule.match_amount_exact !== undefined) {
        rows.push({
          field: 'amount',
          operator: 'exact',
          value: String(rule.match_amount_exact)
        });
      } else if (rule.match_amount_min !== null && rule.match_amount_min !== undefined) {
        rows.push({
          field: 'amount',
          operator: 'greater_than',
          value: String(rule.match_amount_min)
        });
      } else if (rule.match_amount_max !== null && rule.match_amount_max !== undefined) {
        rows.push({
          field: 'amount',
          operator: 'less_than',
          value: String(rule.match_amount_max)
        });
      }

      if (rows.length > 0) {
        setConditionRows(rows);
      }
    } else if (transaction) {
      setCategoryId(transaction.category_account_id || null);
      setContactId(transaction.contact_id || null);
      setConditionRows([
        { field: 'description', operator: 'contains', value: transaction.description || '' }
      ]);
      setSelectedAccountIds([]);
    } else {
      setRuleName('');
      setNameError('');
      setMoneyDirection('both');
      setSelectedAccountIds([]);
      setConditionRows([{ field: 'bank_memo', operator: 'contains', value: '' }]);
      setMatchLogic('any');
      setNewDescription('');
      setCategoryId(null);
      setContactId(null);
      setNotes('');
      setAutoConfirmAndPost(false);
      setPreviewTransactions([]);
    }
  }, [rule, transaction, open, isEditMode]);

  const checkNameUniqueness = useCallback(async (name) => {
    if (!name.trim()) {
      setNameError('');
      return;
    }

    setCheckingName(true);
    try {
      const isUnique = await transactionRulesApi.checkRuleNameUnique(
        profileId,
        name,
        isEditMode ? rule?.id : null
      );
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
  }, [profileId, isEditMode, rule?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ruleName && (!isEditMode || ruleName !== rule?.name)) {
        checkNameUniqueness(ruleName);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [ruleName, checkNameUniqueness, isEditMode, rule?.name]);

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

      const preview = await transactionRulesApi.getMatchPreview(profileId, conditions, 100);
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
      const newRule = await transactionRulesApi.createRule(profileId, data);
      await transactionRulesApi.applyManualRuleToAllTransactions(profileId, newRule.id);
      return newRule;
    },
    onSuccess: async (newRule) => {
      queryClient.invalidateQueries(['transaction-rules']);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
      onOpenChange(false);
      resetForm();
      toast.success('Rule created and applied to all matching transactions!');
    },
    onError: (error) => {
      console.error('Error creating rule:', error);
      const errorMessage = error.message || '';
      const statusCode = error.code || error.status;

      if (statusCode === 500 || errorMessage.includes('timeout') || errorMessage.includes('statement timeout')) {
        toast.error('Rule created but auto-apply timed out. Edit the rule to apply it to pending transactions.', {
          duration: 6000
        });
      } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        toast.error('A rule with this name already exists');
      } else if (errorMessage.includes('actions_check') || errorMessage.includes('action_')) {
        toast.error('Please specify at least one action (category, contact, description, or note)');
      } else if (errorMessage.includes('foreign key') || errorMessage.includes('violates')) {
        toast.error('Invalid category or contact selected. Please try again.');
      } else if (errorMessage.includes('check constraint')) {
        toast.error('Invalid rule configuration. Please check your conditions and try again.');
      } else if (errorMessage.includes('permission') || errorMessage.includes('policy')) {
        toast.error('Permission denied. Please check your account access.');
      } else {
        toast.error('Failed to create rule. Please try again.');
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const updated = await transactionRulesApi.updateRule(rule.id, data);
      if (isPromoteMode) {
        const { error } = await supabase
          .from('transaction_rules')
          .update({ created_from_transaction_id: null, updated_at: new Date().toISOString() })
          .eq('id', rule.id);
        if (error) throw error;
        await transactionRulesApi.applyManualRuleToAllTransactions(profileId, rule.id);
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transaction-rules']);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
      toast.success(isPromoteMode ? 'Rule promoted and applied to all matching transactions!' : 'Rule updated and applied to matching transactions!');
      onOpenChange(false);
      resetForm();
      if (isPromoteMode && onPromoteSuccess) onPromoteSuccess();
    },
    onError: (error) => {
      console.error('Error updating rule:', error);
      const errorMessage = error.message || '';
      const statusCode = error.code || error.status;

      if (statusCode === 500 || errorMessage.includes('timeout') || errorMessage.includes('statement timeout')) {
        toast.error('Rule updated but some transactions may not have been processed. Try applying the rule manually.', {
          duration: 6000
        });
      } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        toast.error('A rule with this name already exists');
      } else if (errorMessage.includes('actions_check') || errorMessage.includes('action_')) {
        toast.error('Please specify at least one action (category, contact, description, or note)');
      } else if (errorMessage.includes('foreign key') || errorMessage.includes('violates')) {
        toast.error('Invalid category or contact selected. Please try again.');
      } else if (errorMessage.includes('check constraint')) {
        toast.error('Invalid rule configuration. Please check your conditions and try again.');
      } else if (errorMessage.includes('permission') || errorMessage.includes('policy')) {
        toast.error('Permission denied. Please check your account access.');
      } else {
        toast.error('Failed to update rule. Please try again.');
      }
    }
  });

  const resetForm = () => {
    setRuleName('');
    setNameError('');
    setMoneyDirection('both');
    setSelectedAccountIds([]);
    setConditionRows([{ field: 'bank_memo', operator: 'contains', value: '' }]);
    setMatchLogic('any');
    setNewDescription('');
    setCategoryId(null);
    setContactId(null);
    setNotes('');
    setAutoConfirmAndPost(false);
    setPreviewTransactions([]);
  };

  const handleSubmit = () => {
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

    if (autoConfirmAndPost && !categoryId) {
      toast.error('Auto-posting requires a category to create journal entries. Please select a category.');
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

    let descriptionModeSet = false;
    let hasValidationError = false;

    for (const row of conditionRows) {
      if (row.value.trim()) {
        if (row.field === 'description') {
          ruleData.match_description_pattern = row.value;
          if (!descriptionModeSet) {
            ruleData.match_description_mode = row.operator;
            descriptionModeSet = true;
          }
        } else if (row.field === 'bank_memo') {
          ruleData.match_original_description_pattern = row.value;
          if (!descriptionModeSet) {
            ruleData.match_description_mode = row.operator;
            descriptionModeSet = true;
          }
        } else if (row.field === 'amount') {
          const amount = parseFloat(row.value);
          if (isNaN(amount) || amount < 0) {
            toast.error('Please enter a valid positive amount');
            hasValidationError = true;
            break;
          }
          if (row.operator === 'exact') {
            ruleData.match_amount_exact = amount;
          } else if (row.operator === 'greater_than') {
            ruleData.match_amount_min = amount;
          } else if (row.operator === 'less_than') {
            ruleData.match_amount_max = amount;
          }
        }
      }
    }

    if (hasValidationError) {
      return;
    }

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

    if (isEditMode) {
      updateMutation.mutate(ruleData);
    } else {
      createMutation.mutate(ruleData);
    }
  };

  const addConditionRow = () => {
    setConditionRows([...conditionRows, { field: 'bank_memo', operator: 'contains', value: '' }]);
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
    a.account_type === 'bank_account' ||
    a.account_type === 'credit_card'
  );

  const allAccountsSelected = selectedAccountIds.length === 0;

  const toggleAllAccounts = () => {
    if (!allAccountsSelected) {
      setSelectedAccountIds([]);
    }
  };

  const toggleAccount = (accountId) => {
    setSelectedAccountIds(prev => {
      // If "All Accounts" is currently selected (empty array)
      if (prev.length === 0) {
        // Select only this account
        return [accountId];
      }

      // If this account is already selected, remove it
      if (prev.includes(accountId)) {
        const newSelection = prev.filter(id => id !== accountId);
        // If no accounts left, return to "All Accounts" state
        return newSelection.length === 0 ? [] : newSelection;
      } else {
        // Add this account to the selection
        return [...prev, accountId];
      }
    });
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.display_name || account?.account_name || 'Unknown';
  };

  const getCategoryName = (categoryId) => {
    const category = accounts.find(a => a.id === categoryId);
    return category?.display_name || category?.account_name || 'Uncategorized';
  };

  const mutation = isEditMode ? updateMutation : createMutation;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>
            {isPromoteMode ? 'Promote Rule' : isEditMode ? 'Edit Rule' : 'Create Rule'}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 flex-shrink-0">
          <div className="space-y-2">
            <Input
              id="rule-name"
              placeholder="Enter rule name*"
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

        <div className="space-y-4 px-6 flex-1 overflow-y-auto pt-4 pb-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col h-[260px] shrink-0">
              <CardContent className="space-y-2 pt-3 flex-1 overflow-y-auto">

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
                        <span className="text-xs text-slate-900">
                          {selectedAccountIds.length === 0 ? 'All Accounts' :
                           selectedAccountIds.length === 1 ? getAccountName(selectedAccountIds[0]) :
                           `${selectedAccountIds.length} Accounts`}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded">
                          <Checkbox
                            id="all-accounts-check"
                            checked={allAccountsSelected}
                            onCheckedChange={toggleAllAccounts}
                          />
                          <label
                            htmlFor="all-accounts-check"
                            className="font-medium text-xs cursor-pointer flex-1"
                          >
                            All Accounts
                          </label>
                        </div>
                        {bankAccounts.map(account => (
                          <div
                            key={account.id}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded"
                          >
                            <Checkbox
                              id={`account-${account.id}`}
                              checked={selectedAccountIds.includes(account.id)}
                              onCheckedChange={() => toggleAccount(account.id)}
                            />
                            <label
                              htmlFor={`account-${account.id}`}
                              className="text-xs cursor-pointer flex-1"
                            >
                              {account.display_name || account.account_name}
                            </label>
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
                              <SelectItem value="bank_memo">Bank Memo</SelectItem>
                              <SelectItem value="description">Description</SelectItem>
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

            <Card className="flex flex-col h-[260px] shrink-0">
              <CardContent className="space-y-2 pt-3 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contact</Label>
                    <ContactDropdown
                      value={contactId}
                      onValueChange={setContactId}
                      onAddNew={(searchTerm) => {
                        const descriptionCondition = conditionRows.find(row => row.field === 'description' && row.value.trim());
                        const initialName = searchTerm || descriptionCondition?.value || '';
                        setContactSearchTerm(initialName);
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

          <Card className="flex flex-col h-[200px] shrink-0">
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
              id="auto-post-toggle"
              checked={autoConfirmAndPost}
              onCheckedChange={setAutoConfirmAndPost}
            />
            <Label htmlFor="auto-post-toggle" className="text-sm font-normal cursor-pointer">
              Auto-post transactions
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">Auto-posting requires a category to create journal entries. Transactions without categories cannot be posted.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || checkingName || !!nameError}
            >
              {mutation.isPending ? (isPromoteMode ? 'Promoting...' : isEditMode ? 'Saving...' : 'Creating...') : (isPromoteMode ? 'Promote Rule' : isEditMode ? 'Save Changes' : 'Create')}
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
      initialName={contactSearchTerm}
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
