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
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';
import { ArrowRight } from 'lucide-react';
import { getAccountDisplayName } from '../utils/constants';

export default function TransferMatchDialog({ 
  isOpen, 
  onClose, 
  transaction, 
  pairedTransaction,
  accounts,
  onConfirm 
}) {
  const [selectedToAccount, setSelectedToAccount] = React.useState(
    pairedTransaction?.bank_account_id || ''
  );

  if (!transaction) return null;

  const fromAccount = accounts.find(a => a.id === transaction.bank_account_id);
  const amount = Math.abs(transaction.amount);
  const memo = transaction.notes || transaction.description || '';

  const handleConfirm = () => {
    onConfirm(selectedToAccount);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Match Transfer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Amount</Label>
              <div className="text-lg font-semibold text-slate-900">
                ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Date</Label>
              <div className="text-lg font-semibold text-slate-900">
                {format(new Date(transaction.date), 'MMM dd, yyyy')}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">From Account</Label>
              <div className="text-sm font-medium text-slate-900">
                {fromAccount ? getAccountDisplayName(fromAccount) : 'Unknown'}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">To Account</Label>
              <ClickThroughSelect
                value={selectedToAccount}
                onValueChange={setSelectedToAccount}
                triggerClassName="h-9 hover:bg-white"
              >
                {accounts
                  .filter(a => a.id !== transaction.bank_account_id)
                  .map(acc => (
                    <ClickThroughSelectItem key={acc.id} value={acc.id}>
                      {getAccountDisplayName(acc)}
                    </ClickThroughSelectItem>
                  ))}
              </ClickThroughSelect>
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Memo</Label>
            <Input
              value={memo}
              disabled
              className="bg-slate-50 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!selectedToAccount}
          >
            Confirm Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}