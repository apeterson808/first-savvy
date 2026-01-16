import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Edit, Trash2, Zap, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import transactionRulesApi from '@/api/transactionRules';
import { toast } from 'sonner';

export default function CategorizationRulesManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isApplyingRules, setIsApplyingRules] = useState(false);
  const queryClient = useQueryClient();
  const { activeProfile } = useProfile();
  const { user } = useAuth();

  const { data: chartOfAccounts = [] } = useQuery({
    queryKey: ['userChartOfAccounts', activeProfile?.id],
    queryFn: async () => {
      const accounts = await firstsavvy.entities.UserChartOfAccounts.filter(
        { profile_id: activeProfile?.id },
        'account_number'
      );
      return accounts.filter(acc => ['income', 'expense'].includes(acc.class));
    },
    enabled: !!activeProfile?.id
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['categorizationRules', activeProfile?.id],
    queryFn: () => transactionRulesApi.getCategorizationRules(activeProfile?.id),
    enabled: !!activeProfile?.id
  });

  const createMutation = useMutation({
    mutationFn: (data) => transactionRulesApi.createCategorizationRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorizationRules'] });
      toast.success('Rule created successfully');
      setDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error) => {
      toast.error('Failed to create rule: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => transactionRulesApi.updateCategorizationRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorizationRules'] });
      toast.success('Rule updated successfully');
      setDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error) => {
      toast.error('Failed to update rule: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => transactionRulesApi.deleteCategorizationRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorizationRules'] });
      toast.success('Rule deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete rule: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      user_id: user.id,
      profile_id: activeProfile?.id,
      name: formData.get('name'),
      match_type: formData.get('match_type'),
      match_value: formData.get('match_value'),
      category_account_id: formData.get('category_account_id'),
      transaction_type: formData.get('transaction_type'),
      priority: parseInt(formData.get('priority')) || 0,
      is_active: true
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleActive = (rule) => {
    updateMutation.mutate({
      id: rule.id,
      data: { is_active: !rule.is_active }
    });
  };

  const handleApplyRulesToExisting = async () => {
    if (!activeProfile?.id) return;

    setIsApplyingRules(true);
    try {
      const { data: uncategorizedTransactions } = await firstsavvy.entities.Transaction.filter({
        profile_id: activeProfile.id,
        category_account_id: null,
        type: ['income', 'expense']
      });

      if (!uncategorizedTransactions || uncategorizedTransactions.length === 0) {
        toast.info('No uncategorized transactions found');
        setIsApplyingRules(false);
        return;
      }

      const updates = await transactionRulesApi.applyAllRules(uncategorizedTransactions, activeProfile.id);

      if (updates.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        toast.success(`${updates.length} transaction${updates.length !== 1 ? 's' : ''} categorized`, {
          icon: <Sparkles className="w-4 h-4" />
        });
      } else {
        toast.info('No matching rules found for uncategorized transactions');
      }
    } catch (error) {
      console.error('Failed to apply rules:', error);
      toast.error('Failed to apply rules: ' + error.message);
    } finally {
      setIsApplyingRules(false);
    }
  };

  if (!activeProfile || !user) {
    return null;
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Categorization Rules</h3>
            </div>
            <p className="text-sm text-slate-500">
              Automatically categorize transactions based on description patterns
            </p>
          </div>
          <div className="flex gap-2">
            {rules.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleApplyRulesToExisting}
                disabled={isApplyingRules}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                {isApplyingRules ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-1 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-1" />
                    Apply to Existing
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => { setEditingRule(null); setDialogOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Rule
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
              <Sparkles className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-base font-medium text-slate-900 mb-1">No rules yet</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
              Create rules to automatically categorize transactions as they are imported
            </p>
            <Button
              size="sm"
              onClick={() => { setEditingRule(null); setDialogOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Your First Rule
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[200px]">Rule Name</TableHead>
                  <TableHead>Pattern Match</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-20 text-center">Priority</TableHead>
                  <TableHead className="w-20 text-center">Active</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => {
                  const categoryAccount = chartOfAccounts.find(acc => acc.id === rule.category_account_id);
                  return (
                    <TableRow key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {rule.match_type.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm text-slate-700">"{rule.match_value}"</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {categoryAccount ? (
                          <span className="text-sm">{categoryAccount.display_name}</span>
                        ) : (
                          <span className="text-sm text-red-500">Missing Category</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.transaction_type === 'all' ? 'secondary' : 'default'} className="capitalize text-xs">
                          {rule.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{rule.priority}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => toggleActive(rule)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingRule(rule); setDialogOpen(true); }}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this rule?')) {
                                deleteMutation.mutate(rule.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingRule ? 'Edit Categorization Rule' : 'New Categorization Rule'}</SheetTitle>
            <p className="text-sm text-slate-500">
              Create a rule to automatically categorize transactions
            </p>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-5 py-6">
            <div>
              <Label htmlFor="name" className="text-sm font-medium">
                Rule Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={editingRule?.name}
                placeholder="e.g., Starbucks Coffee Purchases"
                required
                className="mt-1.5"
              />
              <p className="text-xs text-slate-500 mt-1.5">Give your rule a descriptive name</p>
            </div>

            <div className="border-t pt-5">
              <h4 className="text-sm font-medium text-slate-900 mb-3">Pattern Matching</h4>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="match_type" className="text-sm font-medium">
                    Match Type <span className="text-red-500">*</span>
                  </Label>
                  <Select name="match_type" defaultValue={editingRule?.match_type || 'contains'}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains (recommended)</SelectItem>
                      <SelectItem value="starts_with">Starts with</SelectItem>
                      <SelectItem value="ends_with">Ends with</SelectItem>
                      <SelectItem value="exact">Exact match</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="match_value" className="text-sm font-medium">
                    Match Value <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="match_value"
                    name="match_value"
                    defaultValue={editingRule?.match_value}
                    placeholder="e.g., STARBUCKS"
                    required
                    className="mt-1.5"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Pattern to search for in transaction descriptions
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-5">
              <h4 className="text-sm font-medium text-slate-900 mb-3">Categorization</h4>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="category_account_id" className="text-sm font-medium">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select name="category_account_id" defaultValue={editingRule?.category_account_id} required>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {chartOfAccounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="transaction_type" className="text-sm font-medium">
                    Apply to Transaction Type
                  </Label>
                  <Select name="transaction_type" defaultValue={editingRule?.transaction_type || 'all'}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All transaction types</SelectItem>
                      <SelectItem value="expense">Expenses only</SelectItem>
                      <SelectItem value="income">Income only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority" className="text-sm font-medium">
                    Priority
                  </Label>
                  <Input
                    id="priority"
                    name="priority"
                    type="number"
                    defaultValue={editingRule?.priority || 0}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Higher numbers are evaluated first (default: 0)
                  </p>
                </div>
              </div>
            </div>

            <SheetFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </Card>
  );
}