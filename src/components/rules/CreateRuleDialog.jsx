import React, { useState } from 'react';
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
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import ChartAccountDropdown from '../common/ChartAccountDropdown';
import ContactDropdown from '../common/ContactDropdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AlertCircle } from 'lucide-react';

export function CreateRuleDialog({ open, onOpenChange, profileId, transaction = null }) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 50,
    match_description_pattern: transaction?.description || '',
    match_description_mode: 'contains',
    match_case_sensitive: false,
    match_amount_exact: null,
    match_amount_min: null,
    match_amount_max: null,
    match_transaction_type: '',
    match_bank_account_id: transaction?.bank_account_id || null,
    match_contact_id: null,
    action_set_category_id: transaction?.category_account_id || null,
    action_set_contact_id: null,
    action_add_note: '',
  });

  const [matchCount, setMatchCount] = useState(null);
  const [previewTransactions, setPreviewTransactions] = useState([]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['user-chart-accounts', profileId],
    queryFn: () => getUserChartOfAccounts(profileId),
    enabled: !!profileId
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', profileId],
    queryFn: () => firstsavvy.entities.Contact.list(),
    enabled: !!profileId
  });

  const createMutation = useMutation({
    mutationFn: (data) => transactionRulesApi.createRule(profileId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['transaction-rules']);
      toast.success('Rule created successfully');
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Error creating rule:', error);
      toast.error('Failed to create rule');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      priority: 50,
      match_description_pattern: '',
      match_description_mode: 'contains',
      match_case_sensitive: false,
      match_amount_exact: null,
      match_amount_min: null,
      match_amount_max: null,
      match_transaction_type: '',
      match_bank_account_id: null,
      match_contact_id: null,
      action_set_category_id: null,
      action_set_contact_id: null,
      action_add_note: '',
    });
    setMatchCount(null);
    setPreviewTransactions([]);
  };

  const handlePreview = async () => {
    try {
      const conditions = {
        match_description_pattern: formData.match_description_pattern || null,
        match_description_mode: formData.match_description_mode,
        match_case_sensitive: formData.match_case_sensitive,
        match_amount_min: formData.match_amount_min ? parseFloat(formData.match_amount_min) : null,
        match_amount_max: formData.match_amount_max ? parseFloat(formData.match_amount_max) : null,
        match_amount_exact: formData.match_amount_exact ? parseFloat(formData.match_amount_exact) : null,
        match_transaction_type: formData.match_transaction_type || null,
        match_bank_account_id: formData.match_bank_account_id || null,
        match_contact_id: formData.match_contact_id || null,
      };

      const preview = await transactionRulesApi.getMatchPreview(profileId, conditions, 5);
      setPreviewTransactions(preview);
      setMatchCount(preview.length);
      toast.success(`Found ${preview.length} matching transactions`);
    } catch (error) {
      console.error('Error previewing matches:', error);
      toast.error('Failed to preview matches');
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    if (!formData.match_description_pattern && !formData.match_amount_exact &&
        !formData.match_amount_min && !formData.match_bank_account_id) {
      toast.error('Please specify at least one condition');
      return;
    }

    if (!formData.action_set_category_id && !formData.action_set_contact_id &&
        !formData.action_add_note) {
      toast.error('Please specify at least one action');
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

    createMutation.mutate(cleanedData);
  };

  const bankAccounts = accounts.filter(a => ['asset', 'liability'].includes(a.class) && a.is_active);
  const categoryAccounts = accounts.filter(a => ['income', 'expense'].includes(a.class) && a.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Transaction Rule</DialogTitle>
          <DialogDescription>
            Set up conditions and actions for automatic transaction processing
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
                placeholder="e.g., Categorize Netflix payments"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description of what this rule does"
                value={formData.description}
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
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })}
              />
              <p className="text-xs text-slate-500">
                Higher priority rules are evaluated first
              </p>
            </div>
          </TabsContent>

          <TabsContent value="conditions" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="pattern">Description Pattern</Label>
              <Input
                id="pattern"
                placeholder="e.g., Netflix, AMAZON, etc."
                value={formData.match_description_pattern}
                onChange={(e) => setFormData({ ...formData, match_description_pattern: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="match-mode">Match Mode</Label>
                <Select
                  value={formData.match_description_mode}
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
                    checked={formData.match_case_sensitive}
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
                <div>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={formData.match_amount_min || ''}
                    onChange={(e) => setFormData({ ...formData, match_amount_min: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={formData.match_amount_max || ''}
                    onChange={(e) => setFormData({ ...formData, match_amount_max: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Exact"
                    value={formData.match_amount_exact || ''}
                    onChange={(e) => setFormData({ ...formData, match_amount_exact: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Transaction Type</Label>
              <Select
                value={formData.match_transaction_type}
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

            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              className="w-full"
            >
              Preview Matches
            </Button>

            {matchCount !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <AlertCircle className="w-4 h-4" />
                  <span>This rule would match {matchCount} existing transactions</span>
                </div>
              </div>
            )}
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
                placeholder="Optional note to add to matching transactions"
                value={formData.action_add_note}
                onChange={(e) => setFormData({ ...formData, action_add_note: e.target.value })}
                rows={3}
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="font-medium">At least one action is required</p>
                  <p className="text-xs mt-1">The rule will apply the selected actions to matching transactions</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
