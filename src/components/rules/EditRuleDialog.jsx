import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { transactionRulesApi } from '../../api/transactionRules';
import { getUserChartOfAccounts } from '../../api/chartOfAccounts';
import { firstsavvy } from '../../api/firstsavvyClient';
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
import { toast } from 'sonner';
import ChartAccountDropdown from '../common/ChartAccountDropdown';
import ContactDropdown from '../common/ContactDropdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export function EditRuleDialog({ open, onOpenChange, rule, profileId }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name || '',
        description: rule.description || '',
        priority: rule.priority || 50,
        match_description_pattern: rule.match_description_pattern || '',
        match_description_mode: rule.match_description_mode || 'contains',
        match_case_sensitive: rule.match_case_sensitive || false,
        match_amount_exact: rule.match_amount_exact || null,
        match_amount_min: rule.match_amount_min || null,
        match_amount_max: rule.match_amount_max || null,
        match_transaction_type: rule.match_transaction_type || '',
        match_bank_account_id: rule.match_bank_account_id || null,
        match_contact_id: rule.match_contact_id || null,
        action_set_category_id: rule.action_set_category_id || null,
        action_set_contact_id: rule.action_set_contact_id || null,
        action_add_note: rule.action_add_note || '',
      });
    }
  }, [rule]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['user-chart-accounts', profileId],
    queryFn: () => getUserChartOfAccounts(profileId),
    enabled: !!profileId
  });

  const updateMutation = useMutation({
    mutationFn: (data) => transactionRulesApi.updateRule(rule.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['transaction-rules']);
      toast.success('Rule updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating rule:', error);
      toast.error('Failed to update rule');
    }
  });

  const handleSubmit = () => {
    if (!formData.name?.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    const cleanedData = {
      ...formData,
      match_transaction_type: formData.match_transaction_type || null,
      match_description_pattern: formData.match_description_pattern || null,
      match_amount_min: formData.match_amount_min ? parseFloat(formData.match_amount_min) : null,
      match_amount_max: formData.match_amount_max ? parseFloat(formData.match_amount_max) : null,
      match_amount_exact: formData.match_amount_exact ? parseFloat(formData.match_amount_exact) : null,
      action_add_note: formData.action_add_note || null,
    };

    updateMutation.mutate(cleanedData);
  };

  const bankAccounts = accounts.filter(a => ['asset', 'liability'].includes(a.class) && a.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Rule</DialogTitle>
          <DialogDescription>
            Update the rule conditions and actions
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1-100)</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="100"
                value={formData.priority || 50}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })}
              />
            </div>
          </TabsContent>

          <TabsContent value="conditions" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="pattern">Description Pattern</Label>
              <Input
                id="pattern"
                value={formData.match_description_pattern || ''}
                onChange={(e) => setFormData({ ...formData, match_description_pattern: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="match-mode">Match Mode</Label>
                <Select
                  value={formData.match_description_mode || 'contains'}
                  onValueChange={(value) => setFormData({ ...formData, match_description_mode: value })}
                >
                  <SelectTrigger id="match-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="starts_with">Starts with</SelectItem>
                    <SelectItem value="ends_with">Ends with</SelectItem>
                    <SelectItem value="exact">Exact match</SelectItem>
                    <SelectItem value="regex">Regular expression</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Case Sensitive</Label>
                <div className="flex items-center space-x-2 h-10">
                  <Switch
                    checked={formData.match_case_sensitive || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, match_case_sensitive: checked })}
                  />
                  <span className="text-sm text-slate-600">
                    {formData.match_case_sensitive ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Amount Filter</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={formData.match_amount_min || ''}
                  onChange={(e) => setFormData({ ...formData, match_amount_min: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={formData.match_amount_max || ''}
                  onChange={(e) => setFormData({ ...formData, match_amount_max: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Exact"
                  value={formData.match_amount_exact || ''}
                  onChange={(e) => setFormData({ ...formData, match_amount_exact: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Transaction Type</Label>
              <Select
                value={formData.match_transaction_type || ''}
                onValueChange={(value) => setFormData({ ...formData, match_transaction_type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Any type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any type</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="credit_card_payment">Credit Card Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bank Account</Label>
              <Select
                value={formData.match_bank_account_id || ''}
                onValueChange={(value) => setFormData({ ...formData, match_bank_account_id: value || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any account</SelectItem>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.display_name || account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Set Category</Label>
              <ChartAccountDropdown
                value={formData.action_set_category_id}
                onValueChange={(value) => setFormData({ ...formData, action_set_category_id: value })}
                profileId={profileId}
                filterByClass={['income', 'expense']}
                placeholder="Select category..."
              />
            </div>

            <div className="space-y-2">
              <Label>Set Contact</Label>
              <ContactDropdown
                value={formData.action_set_contact_id}
                onValueChange={(value) => setFormData({ ...formData, action_set_contact_id: value })}
                placeholder="Select contact..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Add Note</Label>
              <Textarea
                id="note"
                value={formData.action_add_note || ''}
                onChange={(e) => setFormData({ ...formData, action_add_note: e.target.value })}
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
