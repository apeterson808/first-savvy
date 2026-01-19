import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionRulesApi } from '../../api/transactionRules';
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
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import ChartAccountDropdown from '../common/ChartAccountDropdown';
import { Sparkles, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export function QuickCreateRuleDialog({ open, onOpenChange, transaction, profileId }) {
  const queryClient = useQueryClient();

  const [ruleName, setRuleName] = useState('');
  const [matchExactAmount, setMatchExactAmount] = useState(false);
  const [matchThisAccount, setMatchThisAccount] = useState(true);
  const [categoryId, setCategoryId] = useState(transaction?.category_account_id || null);
  const [priority, setPriority] = useState(50);

  React.useEffect(() => {
    if (transaction && open) {
      const suggested = `Auto-categorize "${transaction.description.substring(0, 30)}${transaction.description.length > 30 ? '...' : ''}"`;
      setRuleName(suggested);
      setCategoryId(transaction.category_account_id || null);
    }
  }, [transaction, open]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return transactionRulesApi.createRuleFromTransaction(profileId, transaction, data);
    },
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
    setRuleName('');
    setMatchExactAmount(false);
    setMatchThisAccount(true);
    setCategoryId(null);
    setPriority(50);
  };

  const handleCreate = () => {
    if (!ruleName.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    if (!categoryId) {
      toast.error('Please select a category');
      return;
    }

    createMutation.mutate({
      name: ruleName,
      categoryId,
      descriptionPattern: transaction.description,
      matchMode: 'contains',
      caseSensitive: false,
      matchAmountExact: matchExactAmount,
      matchAccount: matchThisAccount,
      matchType: false,
      priority
    });
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Quick Create Rule
          </DialogTitle>
          <DialogDescription>
            Create a rule to automatically categorize similar transactions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-md p-3 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Transaction</p>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{transaction.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {transaction.type}
                  </Badge>
                </div>
              </div>
              <p className="font-semibold">{formatCurrency(Math.abs(transaction.amount))}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              placeholder="Enter a name for this rule"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Category to Apply</Label>
            <ChartAccountDropdown
              value={categoryId}
              onValueChange={setCategoryId}
              profileId={profileId}
              filterByClass={['income', 'expense']}
              placeholder="Select category..."
            />
            <p className="text-xs text-slate-500">
              This category will be automatically applied to matching transactions
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200">
            <Label className="text-sm font-medium">Match Conditions</Label>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm">Match exact amount</p>
                <p className="text-xs text-slate-500">
                  Only match transactions with amount {formatCurrency(Math.abs(transaction.amount))}
                </p>
              </div>
              <Switch
                checked={matchExactAmount}
                onCheckedChange={setMatchExactAmount}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm">Match this account only</p>
                <p className="text-xs text-slate-500">
                  Only apply to transactions in this specific account
                </p>
              </div>
              <Switch
                checked={matchThisAccount}
                onCheckedChange={setMatchThisAccount}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-blue-800">
                  <p className="font-medium">This rule will match:</p>
                  <ul className="text-xs mt-1 space-y-0.5 ml-4 list-disc">
                    <li>Transactions containing "{transaction.description.substring(0, 30)}"</li>
                    {matchExactAmount && <li>With exact amount {formatCurrency(Math.abs(transaction.amount))}</li>}
                    {matchThisAccount && <li>In this specific account</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority (1-100)</Label>
            <Input
              id="priority"
              type="number"
              min="1"
              max="100"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 50)}
            />
            <p className="text-xs text-slate-500">
              Higher priority rules are evaluated first
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
