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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ArrowRight } from 'lucide-react';
import { getAccountDisplayName } from '../utils/constants';

export default function CreditCardPaymentMatchDialog({
  isOpen,
  onClose,
  transaction,
  pairedTransaction,
  accounts,
  onConfirm
}) {
  if (!transaction) return null;

  const bankAccount = accounts.find(a => a.id ===
    (transaction.type === 'expense' ? transaction.bank_account_id : pairedTransaction?.bank_account_id)
  );

  const creditCardAccount = accounts.find(a => a.id ===
    (transaction.type === 'income' ? transaction.bank_account_id : pairedTransaction?.bank_account_id)
  );

  const amount = Math.abs(transaction.amount);
  const confidence = transaction.cc_payment_match_confidence || 0;
  const bankDate = transaction.type === 'expense' ? transaction.date : pairedTransaction?.date;
  const ccDate = transaction.type === 'income' ? transaction.date : pairedTransaction?.date;

  const getConfidenceColor = () => {
    if (confidence >= 95) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 85) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  const getConfidenceLabel = () => {
    if (confidence >= 95) return 'High Confidence';
    if (confidence >= 85) return 'Medium Confidence';
    return 'Low Confidence';
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-orange-600" />
            Credit Card Payment Match
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-center">
            <Badge variant="outline" className={`${getConfidenceColor()} border`}>
              {getConfidenceLabel()} ({Math.round(confidence)}%)
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Payment Amount</Label>
              <div className="text-lg font-semibold text-slate-900">
                ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Bank Date</Label>
              <div className="text-lg font-semibold text-slate-900">
                {bankDate ? format(new Date(bankDate), 'MMM dd, yyyy') : 'N/A'}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">From Bank Account</Label>
              <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                {bankAccount ? getAccountDisplayName(bankAccount) : 'Unknown'}
              </div>
              {bankDate && (
                <div className="text-xs text-slate-500 mt-1">
                  Withdrawal on {format(new Date(bankDate), 'MMM dd, yyyy')}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">To Credit Card</Label>
              <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-orange-600" />
                {creditCardAccount ? getAccountDisplayName(creditCardAccount) : 'Unknown'}
              </div>
              {ccDate && (
                <div className="text-xs text-slate-500 mt-1">
                  Payment received on {format(new Date(ccDate), 'MMM dd, yyyy')}
                </div>
              )}
            </div>
          </div>

          {transaction.description && (
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Bank Description</Label>
              <Input
                value={transaction.type === 'expense' ? transaction.description : pairedTransaction?.description || ''}
                disabled
                className="bg-slate-50 text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Confirm Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
