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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, CheckCircle2, FileText, Calendar } from 'lucide-react';
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
  isPosting,
  matchType = 'transfer'
}) {
  if (!transaction || !pairedTransaction) return null;

  const amount = Math.abs(transaction.amount);
  const date = format(new Date(transaction.date), 'MMM dd, yyyy');
  const memo = transaction.notes || transaction.description || '';

  const FromIcon = fromAccount?.icon ? getIconComponent(fromAccount.icon) : null;
  const ToIcon = toAccount?.icon ? getIconComponent(toAccount.icon) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <div>
                <DialogTitle className="text-2xl">
                  {matchType === 'credit_card_payment' ? 'Post Credit Card Payment' : 'Post Bank Transfer'}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">
                    {matchType === 'credit_card_payment' ? 'Credit Card Payment' : 'Bank Transfer'}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {date}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {FromIcon && <FromIcon className="h-5 w-5" style={{ color: fromAccount.color }} />}
              <span className="font-medium">{fromAccount ? getAccountDisplayName(fromAccount) : 'Unknown'}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-3">
              {ToIcon && <ToIcon className="h-5 w-5" style={{ color: toAccount.color }} />}
              <span className="font-medium">{toAccount ? getAccountDisplayName(toAccount) : 'Unknown'}</span>
            </div>
            <div className="font-semibold text-lg">{formatCurrency(amount)}</div>
          </div>

          {memo && (
            <div>
              <div className="text-sm font-medium mb-1">Description</div>
              <div className="text-muted-foreground">{memo}</div>
            </div>
          )}

          <Separator />

          <div>
            <div className="text-sm font-medium mb-3">Journal Entry Lines</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">1</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {ToIcon && <ToIcon className="h-4 w-4" style={{ color: toAccount.color }} />}
                      <div className="font-medium">
                        {toAccount ? getAccountDisplayName(toAccount) : 'Unknown'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{memo || '—'}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">2</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {FromIcon && <FromIcon className="h-4 w-4" style={{ color: fromAccount.color }} />}
                      <div className="font-medium">
                        {fromAccount ? getAccountDisplayName(fromAccount) : 'Unknown'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{memo || '—'}</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
                </TableRow>
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={3} className="text-right">
                    Totals
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(amount)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(amount)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">Entry is balanced</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Debits = Credits = {formatCurrency(amount)}
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
            disabled={isPosting}
          >
            {isPosting ? 'Posting...' : (matchType === 'credit_card_payment' ? 'Post Credit Card Payment' : 'Post Bank Transfer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
