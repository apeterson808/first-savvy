import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { formatCurrency } from '../utils/formatters';
import { format } from 'date-fns';

export function LoanConfirmation({ loanData, vehicleData, onConfirm, onBack, isLoading }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Confirm Loan Details</h3>
        <p className="text-sm text-muted-foreground">
          Review the loan information before adding it to your account
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Lender</p>
              <p className="font-medium">{loanData.lenderName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="font-medium">{formatCurrency(loanData.currentBalance)}</p>
            </div>
          </div>

          {loanData.originalAmount && (
            <div>
              <p className="text-sm text-muted-foreground">Original Loan Amount</p>
              <p className="font-medium">{formatCurrency(loanData.originalAmount)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {loanData.interestRate && (
              <div>
                <p className="text-sm text-muted-foreground">Interest Rate</p>
                <p className="font-medium">{loanData.interestRate}%</p>
              </div>
            )}
            {loanData.monthlyPayment && (
              <div>
                <p className="text-sm text-muted-foreground">Monthly Payment</p>
                <p className="font-medium">{formatCurrency(loanData.monthlyPayment)}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {loanData.paymentDueDate && (
              <div>
                <p className="text-sm text-muted-foreground">Payment Due Date</p>
                <p className="font-medium">Day {loanData.paymentDueDate} of each month</p>
              </div>
            )}
            {loanData.startDate && (
              <div>
                <p className="text-sm text-muted-foreground">Loan Start Date</p>
                <p className="font-medium">{format(new Date(loanData.startDate), 'MMM d, yyyy')}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-1">Financing</p>
            <p className="font-medium">{vehicleData.name}</p>
            <p className="text-sm text-muted-foreground">
              Estimated Value: {formatCurrency(vehicleData.estimatedValue)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Finish'}
        </Button>
      </div>
    </div>
  );
}
