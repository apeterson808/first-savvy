import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transactionRulesApi } from '../../api/transactionRules';
import { getUserChartOfAccounts } from '../../api/chartOfAccounts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { format } from 'date-fns';

export function TestRuleDialog({ open, onOpenChange, rule, profileId }) {
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ['user-chart-accounts', profileId],
    queryFn: () => getUserChartOfAccounts(profileId),
    enabled: !!profileId
  });

  useEffect(() => {
    if (open && rule) {
      loadPreview();
    }
  }, [open, rule]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const conditions = {
        match_description_pattern: rule.match_description_pattern,
        match_description_mode: rule.match_description_mode,
        match_case_sensitive: rule.match_case_sensitive,
        match_amount_min: rule.match_amount_min,
        match_amount_max: rule.match_amount_max,
        match_amount_exact: rule.match_amount_exact,
        match_transaction_type: rule.match_transaction_type,
        match_bank_account_id: rule.match_bank_account_id,
        match_contact_id: rule.match_contact_id,
      };

      const results = await transactionRulesApi.getMatchPreview(profileId, conditions, 10);
      setPreview(results);
    } catch (error) {
      console.error('Error loading preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (categoryId) => {
    const category = accounts.find(a => a.id === categoryId);
    return category?.display_name || category?.account_name || 'Unknown';
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.display_name || account?.account_name || 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Rule: {rule?.name}</DialogTitle>
          <DialogDescription>
            Preview of transactions that would match this rule
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : preview.length === 0 ? (
          <div className="text-center py-12">
            <XCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No matching transactions found</p>
            <p className="text-xs text-slate-400 mt-2">
              Try adjusting the rule conditions to match more transactions
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
              <span>Found {preview.length} matching transaction{preview.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {preview.map((transaction) => (
                <div
                  key={transaction.id}
                  className="border border-slate-200 rounded-md p-3 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {transaction.description}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {transaction.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>{format(new Date(transaction.date), 'MMM d, yyyy')}</span>
                        <span>{getAccountName(transaction.bank_account_id)}</span>
                        {transaction.category_account_id && (
                          <span className="text-blue-600">
                            Current: {getCategoryName(transaction.category_account_id)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-slate-900'}`}>
                        {formatCurrency(Math.abs(transaction.amount))}
                      </div>
                    </div>
                  </div>

                  {rule.action_set_category_id && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <div className="text-xs text-slate-600">
                        Would set category to:{' '}
                        <span className="font-medium text-blue-600">
                          {getCategoryName(rule.action_set_category_id)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {preview.length === 10 && (
              <p className="text-xs text-slate-500 text-center">
                Showing first 10 matches. Rule may match additional transactions.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
