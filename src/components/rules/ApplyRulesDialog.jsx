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
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export function ApplyRulesDialog({ open, onOpenChange, profileId, rules }) {
  const queryClient = useQueryClient();
  const [selectedRules, setSelectedRules] = useState([]);
  const [applyToAll, setApplyToAll] = useState(true);
  const [results, setResults] = useState(null);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const ruleIds = selectedRules.length > 0 ? selectedRules : rules.map(r => r.id);
      return transactionRulesApi.applyRulesToTransactions(
        profileId,
        ruleIds,
        null
      );
    },
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries(['transactions']);
      queryClient.invalidateQueries(['transaction-rules']);

      if (data.matchedTransactions > 0) {
        toast.success(`Applied rules to ${data.matchedTransactions} transactions`);
      } else {
        toast.info('No transactions matched the selected rules');
      }
    },
    onError: (error) => {
      console.error('Error applying rules:', error);
      toast.error('Failed to apply rules');
    }
  });

  const handleSelectAll = () => {
    if (selectedRules.length === rules.length) {
      setSelectedRules([]);
    } else {
      setSelectedRules(rules.map(r => r.id));
    }
  };

  const handleToggleRule = (ruleId) => {
    setSelectedRules(prev =>
      prev.includes(ruleId)
        ? prev.filter(id => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  const handleApply = () => {
    if (selectedRules.length === 0 && rules.length > 0) {
      setSelectedRules(rules.map(r => r.id));
    }
    applyMutation.mutate();
  };

  const handleClose = () => {
    setResults(null);
    setSelectedRules([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply Rules to Transactions</DialogTitle>
          <DialogDescription>
            Select which rules to apply to pending transactions
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-green-600 bg-green-50 p-4 rounded-md">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <p className="font-medium">Rules Applied Successfully</p>
                <p className="text-sm text-green-600/80">
                  Processed {results.totalTransactions} transactions
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-md">
                <p className="text-sm text-slate-600">Matched Transactions</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {results.matchedTransactions}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-md">
                <p className="text-sm text-slate-600">Rules Applied</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {results.appliedRules}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-start gap-2 text-sm text-blue-800">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="font-medium">Changes Applied</p>
                  <p className="text-xs mt-1">
                    {results.changes.length} transaction{results.changes.length !== 1 ? 's were' : ' was'} modified by the rules
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : applyMutation.isPending ? (
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            <p className="text-center text-sm text-slate-600">
              Applying rules to transactions...
            </p>
            <Progress value={undefined} className="w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="font-medium">This will apply rules to pending transactions</p>
                  <p className="text-xs mt-1">
                    Rules are evaluated in alphabetical order. The first matching rule will be applied to each transaction.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Select Rules</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  {selectedRules.length === rules.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="border border-slate-200 rounded-md max-h-[300px] overflow-y-auto">
                {rules.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-8">
                    No enabled rules available
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {rules.map((rule) => (
                      <label
                        key={rule.id}
                        className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedRules.includes(rule.id) || selectedRules.length === 0}
                          onCheckedChange={() => handleToggleRule(rule.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{rule.name}</p>
                          {rule.description && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {rule.description}
                            </p>
                          )}
                          {rule.times_matched > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-400">
                                {rule.times_matched} matches
                              </span>
                              {rule.acceptance_rate > 0 && (
                                <>
                                  <span className="text-xs text-slate-300">•</span>
                                  <span className="text-xs text-slate-400">
                                    {rule.acceptance_rate.toFixed(0)}% accepted
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={handleClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={applyMutation.isPending || rules.length === 0}
              >
                {applyMutation.isPending ? 'Applying...' : 'Apply Rules'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
