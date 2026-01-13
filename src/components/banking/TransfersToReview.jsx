import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Check, X, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatTransactionDescription } from '../utils/formatters';
import { getAccountDisplayName } from '../utils/constants';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function TransfersToReview({
  transferPairs,
  accounts,
  onAccept,
  onReject,
  onAcceptAll,
  isLoading
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [showAcceptAllDialog, setShowAcceptAllDialog] = useState(false);

  if (!transferPairs || transferPairs.length === 0) {
    return null;
  }

  const getConfidenceColor = (confidence) => {
    if (confidence >= 95) return 'text-green-600 bg-green-50';
    if (confidence >= 85) return 'text-blue-600 bg-blue-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 95) return 'High';
    if (confidence >= 85) return 'Medium';
    return 'Low';
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base">Transfers to Review</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {transferPairs.length} pair{transferPairs.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {transferPairs.length > 1 && (
                  <Button
                    size="sm"
                    onClick={() => setShowAcceptAllDialog(true)}
                    disabled={isLoading}
                    className="h-8"
                  >
                    Accept All
                  </Button>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              {transferPairs.map((pair) => {
                const sourceAccount = accounts.find(a => a.id === pair.source.bank_account_id);
                const destAccount = accounts.find(a => a.id === pair.destination.bank_account_id);

                return (
                  <div
                    key={pair.id}
                    className="p-3 bg-white border border-blue-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`${getConfidenceColor(pair.confidence)} text-xs`}
                        >
                          {getConfidenceLabel(pair.confidence)} Confidence ({Math.round(pair.confidence)}%)
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Recognized Transfer
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onAccept(pair.id)}
                          disabled={isLoading}
                          className="h-7 px-2 text-xs hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReject(pair.id)}
                          disabled={isLoading}
                          className="h-7 px-2 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 bg-slate-50 rounded border border-slate-200">
                        <p className="text-xs font-semibold text-slate-600 mb-2">From Account</p>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {sourceAccount ? getAccountDisplayName(sourceAccount) : 'Unknown Account'}
                          </p>
                          <p className="text-xs text-slate-600">
                            {format(parseISO(pair.source.date), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-xs text-slate-600 truncate">
                            {formatTransactionDescription(pair.source.description)}
                          </p>
                          <p className="text-sm font-bold text-red-600">
                            -${Math.abs(pair.source.amount).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="p-2 bg-slate-50 rounded border border-slate-200">
                        <p className="text-xs font-semibold text-slate-600 mb-2">To Account</p>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {destAccount ? getAccountDisplayName(destAccount) : 'Unknown Account'}
                          </p>
                          <p className="text-xs text-slate-600">
                            {format(parseISO(pair.destination.date), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-xs text-slate-600 truncate">
                            {formatTransactionDescription(pair.destination.description)}
                          </p>
                          <p className="text-sm font-bold text-green-600">
                            +${Math.abs(pair.destination.amount).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AlertDialog open={showAcceptAllDialog} onOpenChange={setShowAcceptAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept All Transfers?</AlertDialogTitle>
            <AlertDialogDescription>
              This will accept {transferPairs.length} automatically detected transfer{transferPairs.length !== 1 ? 's' : ''}.
              The transactions will remain in the Pending tab until you post them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              onAcceptAll();
              setShowAcceptAllDialog(false);
            }}>
              Accept All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
