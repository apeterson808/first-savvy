import { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function ManualLoanForm({ onNext, onBack, initialData = {} }) {
  const [formData, setFormData] = useState({
    lenderName: initialData.lenderName || '',
    currentBalance: initialData.currentBalance || '',
    originalAmount: initialData.originalAmount || '',
    interestRate: initialData.interestRate || '',
    monthlyPayment: initialData.monthlyPayment || '',
    paymentDueDate: initialData.paymentDueDate || '',
    startDate: initialData.startDate || null,
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.lenderName || formData.lenderName.trim().length === 0) {
      newErrors.lenderName = 'Lender name is required';
    }

    if (!formData.currentBalance || parseFloat(formData.currentBalance) <= 0) {
      newErrors.currentBalance = 'Please enter a valid current balance';
    }

    if (formData.originalAmount && parseFloat(formData.originalAmount) < parseFloat(formData.currentBalance)) {
      newErrors.originalAmount = 'Original amount cannot be less than current balance';
    }

    if (formData.interestRate && (parseFloat(formData.interestRate) < 0 || parseFloat(formData.interestRate) > 100)) {
      newErrors.interestRate = 'Interest rate must be between 0 and 100';
    }

    if (formData.monthlyPayment && parseFloat(formData.monthlyPayment) <= 0) {
      newErrors.monthlyPayment = 'Monthly payment must be greater than 0';
    }

    if (formData.paymentDueDate) {
      const dueDate = parseInt(formData.paymentDueDate);
      if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) {
        newErrors.paymentDueDate = 'Payment due date must be between 1 and 31';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      const loanData = {
        lenderName: formData.lenderName.trim(),
        currentBalance: parseFloat(formData.currentBalance),
        originalAmount: formData.originalAmount ? parseFloat(formData.originalAmount) : parseFloat(formData.currentBalance),
        interestRate: formData.interestRate ? parseFloat(formData.interestRate) : null,
        monthlyPayment: formData.monthlyPayment ? parseFloat(formData.monthlyPayment) : null,
        paymentDueDate: formData.paymentDueDate ? parseInt(formData.paymentDueDate) : null,
        startDate: formData.startDate ? format(formData.startDate, 'yyyy-MM-dd') : null,
        source: 'manual',
      };
      onNext(loanData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lenderName">Lender Name *</Label>
          <Input
            id="lenderName"
            placeholder="Chase Auto Finance"
            value={formData.lenderName}
            onChange={(e) => handleChange('lenderName', e.target.value)}
          />
          {errors.lenderName && (
            <p className="text-sm text-destructive">{errors.lenderName}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="currentBalance">Current Balance *</Label>
            <Input
              id="currentBalance"
              type="number"
              placeholder="15000"
              value={formData.currentBalance}
              onChange={(e) => handleChange('currentBalance', e.target.value)}
              min="0"
              step="0.01"
            />
            {errors.currentBalance && (
              <p className="text-sm text-destructive">{errors.currentBalance}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="originalAmount">Original Loan Amount</Label>
            <Input
              id="originalAmount"
              type="number"
              placeholder="20000"
              value={formData.originalAmount}
              onChange={(e) => handleChange('originalAmount', e.target.value)}
              min="0"
              step="0.01"
            />
            {errors.originalAmount && (
              <p className="text-sm text-destructive">{errors.originalAmount}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="interestRate">Interest Rate (%)</Label>
            <Input
              id="interestRate"
              type="number"
              placeholder="5.5"
              value={formData.interestRate}
              onChange={(e) => handleChange('interestRate', e.target.value)}
              min="0"
              max="100"
              step="0.01"
            />
            {errors.interestRate && (
              <p className="text-sm text-destructive">{errors.interestRate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyPayment">Monthly Payment</Label>
            <Input
              id="monthlyPayment"
              type="number"
              placeholder="350"
              value={formData.monthlyPayment}
              onChange={(e) => handleChange('monthlyPayment', e.target.value)}
              min="0"
              step="0.01"
            />
            {errors.monthlyPayment && (
              <p className="text-sm text-destructive">{errors.monthlyPayment}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="paymentDueDate">Payment Due Date (Day of Month)</Label>
            <Input
              id="paymentDueDate"
              type="number"
              placeholder="15"
              value={formData.paymentDueDate}
              onChange={(e) => handleChange('paymentDueDate', e.target.value)}
              min="1"
              max="31"
            />
            {errors.paymentDueDate && (
              <p className="text-sm text-destructive">{errors.paymentDueDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Loan Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.startDate ? format(formData.startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.startDate}
                  onSelect={(date) => handleChange('startDate', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">
          Next
        </Button>
      </div>
    </form>
  );
}
