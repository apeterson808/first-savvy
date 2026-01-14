import React from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { getAccountDisplayName } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';
import { getIconComponent } from '../utils/iconMapper';

export default function TransferPostPreviewDialog({
  isOpen,
  onClose,
  transaction,
  pairedTransaction,
  fromAccount,
  toAccount,
  onPost,
  isPosting
}) {
  if (!transaction || !pairedTransaction) return null;

  const amount = Math.abs(transaction.amount);
  const date = format(new Date(transaction.date), 'MMM dd, yyyy');
  const memo = transaction.notes || transaction.description || '';

  const FromIcon = fromAccount?.icon ? getIconComponent(fromAccount.icon) : null;
  const ToIcon = toAccount?.icon ? getIconComponent(toAccount.icon) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Preview Transfer Journal Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Transfer Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Transfer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Amount</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {formatCurrency(amount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Date</div>
                  <div className="text-lg font-semibold text-slate-900">{date}</div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {FromIcon && <FromIcon className="h-5 w-5" style={{ color: fromAccount.color }} />}
                  <div className="flex-1">
                    <div className="text-xs text-slate-500">From Account</div>
                    <div className="text-sm font-medium text-slate-900">
                      {fromAccount ? getAccountDisplayName(fromAccount) : 'Unknown'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                </div>

                <div className="flex items-center gap-3">
                  {ToIcon && <ToIcon className="h-5 w-5" style={{ color: toAccount.color }} />}
                  <div className="flex-1">
                    <div className="text-xs text-slate-500">To Account</div>
                    <div className="text-sm font-medium text-slate-900">
                      {toAccount ? getAccountDisplayName(toAccount) : 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>

              {memo && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Memo</div>
                  <div className="text-sm text-slate-700">{memo}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Journal Entry Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Journal Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Debit Line */}
                <div className="flex items-start justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3 flex-1">
                    {ToIcon && <ToIcon className="h-5 w-5" style={{ color: toAccount.color }} />}
                    <div>
                      <div className="text-xs font-medium text-green-700 mb-0.5">DEBIT</div>
                      <div className="text-sm font-medium text-slate-900">
                        {toAccount ? getAccountDisplayName(toAccount) : 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-500">{memo}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-700">
                      {formatCurrency(amount)}
                    </div>
                  </div>
                </div>

                {/* Credit Line */}
                <div className="flex items-start justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-3 flex-1">
                    {FromIcon && <FromIcon className="h-5 w-5" style={{ color: fromAccount.color }} />}
                    <div>
                      <div className="text-xs font-medium text-orange-700 mb-0.5">CREDIT</div>
                      <div className="text-sm font-medium text-slate-900">
                        {fromAccount ? getAccountDisplayName(fromAccount) : 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-500">{memo}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-orange-700">
                      {formatCurrency(amount)}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Balance Check */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-slate-900">Entry is balanced</span>
                  </div>
                  <div className="text-sm text-slate-500">
                    Debits = Credits = {formatCurrency(amount)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900 mb-1">
                  What happens when you post
                </div>
                <div className="text-xs text-blue-700 space-y-1">
                  <div>• Both transactions will move to the Posted tab</div>
                  <div>• A journal entry will be created linking both sides</div>
                  <div>• The journal entry will appear in each account's register</div>
                  <div>• Account balances will be updated automatically</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPosting}
          >
            Cancel
          </Button>
          <Button
            onClick={onPost}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={isPosting}
          >
            {isPosting ? 'Posting...' : 'Post Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
