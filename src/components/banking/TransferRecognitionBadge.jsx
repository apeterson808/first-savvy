import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function TransferRecognitionBadge({
  transaction,
  pairedTransaction,
  accounts,
  getAccountDisplayName
}) {
  if (!transaction.transfer_auto_detected || !transaction.transfer_pair_id) {
    return null;
  }

  const isReviewed = transaction.transfer_reviewed;
  const confidence = transaction.transfer_match_confidence || 0;

  const otherAccount = pairedTransaction
    ? accounts.find(a => a.id === pairedTransaction.bank_account_id)
    : null;

  const getConfidenceColor = () => {
    if (!isReviewed) {
      return 'border-blue-400 bg-blue-50 text-blue-700';
    }
    return 'border-green-400 bg-green-50 text-green-700';
  };

  const getConfidenceLabel = () => {
    if (confidence >= 95) return 'High';
    if (confidence >= 85) return 'Medium';
    return 'Low';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${getConfidenceColor()} text-xs font-medium cursor-help`}
          >
            {isReviewed ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Matched Transfer
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Recognized Transfer
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">
              {isReviewed ? 'Accepted Transfer Match' : 'Auto-Detected Transfer'}
            </p>
            <p className="text-xs">
              Confidence: {getConfidenceLabel()} ({Math.round(confidence)}%)
            </p>
            {otherAccount && (
              <p className="text-xs">
                {transaction.amount < 0 ? 'To' : 'From'}: {getAccountDisplayName(otherAccount)}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
