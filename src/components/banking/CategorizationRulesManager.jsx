import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { useProfile } from '@/contexts/ProfileContext';
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
import { Plus, Edit, Trash2, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import transactionRulesApi from '@/api/transactionRules';

export default function CategorizationRulesManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const queryClient = useQueryClient();
  const { activeProfile } = useProfile();

  const { data: chartOfAccounts = [] } = useQuery({
    queryKey: ['chartOfAccounts', activeProfile?.id],
    queryFn: () => firstsavvy.entities.ChartAccount.filter(
      { class: ['income', 'expense'] },
      'account_number'
    ),
    enabled: !!activeProfile?.id
  });

  const incomeExpenseAccounts = chartOfAccounts.filter(
    acc => ['income', 'expense'].includes(acc.class)
  );

  const { data: rules = [] } = useQuery({
    queryKey: ['categorizationRules', activeProfile?.id],
    queryFn: () => transactionRulesApi.getCategorizationRules(activeProfile?.id),
    enabled: !!activeProfile?.id
  });

  const createMutation = useMutation({
    mutationFn: (data) => transactionRulesApi.createCategorizationRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorizationRules'] });
      setDialogOpen(false);
      setEditingRule(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => transactionRulesApi.updateCategorizationRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorizationRules'] });
      setDialogOpen(false);
      setEditingRule(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => transactionRulesApi.deleteCategorizationRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categorizationRules'] })
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      match_type: formData.get('match_type'),
      match_value: formData.get('match_value'),
      category_account_id: formData.get('category_account_id'),
      transaction_type: formData.get('transaction_type'),
      priority: parseInt(formData.get('priority')) || 0,
      is_active: true,
      profile_id: activeProfile?.id
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

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Categorization Rules</p>
          <p className="text-xs text-slate-500 mt-1">Auto-categorize transactions based on custom rules</p>
        </div>
        <Button 
          size="sm" 
          onClick={() => { setEditingRule(null); setDialogOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Rule
        </Button>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No categorization rules yet</p>
            <p className="text-slate-400 text-xs mt-1">Create rules to auto-categorize transactions</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Rule Name</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const categoryAccount = chartOfAccounts.find(acc => acc.id === rule.category_account_id);
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded mr-1">{rule.match_type}</span>
                      "{rule.match_value}"
                    </TableCell>
                    <TableCell>{categoryAccount?.display_name || 'Unknown'}</TableCell>
                    <TableCell className="capitalize">{rule.transaction_type}</TableCell>
                    <TableCell>
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
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => deleteMutation.mutate(rule.id)}
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
        )}
      </CardContent>

      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingRule ? 'Edit Rule' : 'New Categorization Rule'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Rule Name</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={editingRule?.name}
                placeholder="e.g., Amazon purchases"
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="match_type">Match Type</Label>
                <Select name="match_type" defaultValue={editingRule?.match_type || 'contains'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="starts_with">Starts with</SelectItem>
                    <SelectItem value="ends_with">Ends with</SelectItem>
                    <SelectItem value="exact">Exact match</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="match_value">Match Value</Label>
                <Input 
                  id="match_value" 
                  name="match_value" 
                  defaultValue={editingRule?.match_value}
                  placeholder="e.g., AMAZON"
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category_account_id">Category</Label>
                <Select name="category_account_id" defaultValue={editingRule?.category_account_id} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeExpenseAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="transaction_type">Transaction Type</Label>
                <Select name="transaction_type" defaultValue={editingRule?.transaction_type || 'all'} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="expense">Expense Only</SelectItem>
                    <SelectItem value="income">Income Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="priority">Priority (higher = checked first)</Label>
              <Input 
                id="priority" 
                name="priority" 
                type="number"
                defaultValue={editingRule?.priority || 0}
              />
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingRule ? 'Update' : 'Create'} Rule
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </Card>
  );
}