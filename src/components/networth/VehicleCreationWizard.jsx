import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { VehicleDetailsForm } from './VehicleDetailsForm';
import { PlaidLoanSearch } from './PlaidLoanSearch';
import { ManualLoanForm } from './ManualLoanForm';
import { LoanConfirmation } from './LoanConfirmation';
import { createVehicleAsset, createVehicleWithLoan } from '@/api/vehiclesAndLoans';
import { toast } from 'sonner';

const STEPS = {
  VEHICLE_DETAILS: 'vehicle_details',
  LOAN_SEARCH: 'loan_search',
  MANUAL_LOAN: 'manual_loan',
  LOAN_CONFIRMATION: 'loan_confirmation',
};

export function VehicleCreationWizard({ open, onOpenChange, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(STEPS.VEHICLE_DETAILS);
  const [vehicleData, setVehicleData] = useState(null);
  const [loanData, setLoanData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetWizard = () => {
    setCurrentStep(STEPS.VEHICLE_DETAILS);
    setVehicleData(null);
    setLoanData(null);
    setIsLoading(false);
  };

  const handleVehicleDetailsNext = (data) => {
    setVehicleData(data);

    if (data.isFinanced) {
      setCurrentStep(STEPS.LOAN_SEARCH);
    } else {
      handleCreateOwnedVehicle(data);
    }
  };

  const handleCreateOwnedVehicle = async (data) => {
    setIsLoading(true);
    try {
      await createVehicleAsset(data);
      toast.success('Vehicle added successfully');
      onSuccess?.();
      onOpenChange(false);
      resetWizard();
    } catch (error) {
      console.error('Error creating vehicle:', error);
      toast.error('Failed to add vehicle. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualEntry = () => {
    setCurrentStep(STEPS.MANUAL_LOAN);
  };

  const handleManualLoanNext = (data) => {
    setLoanData(data);
    setCurrentStep(STEPS.LOAN_CONFIRMATION);
  };

  const handleLoanConfirmation = async () => {
    setIsLoading(true);
    try {
      await createVehicleWithLoan(vehicleData, loanData);
      toast.success('Vehicle and loan added successfully');
      onSuccess?.();
      onOpenChange(false);
      resetWizard();
    } catch (error) {
      console.error('Error creating vehicle with loan:', error);
      toast.error('Failed to add vehicle and loan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === STEPS.LOAN_SEARCH) {
      setCurrentStep(STEPS.VEHICLE_DETAILS);
    } else if (currentStep === STEPS.MANUAL_LOAN) {
      setCurrentStep(STEPS.LOAN_SEARCH);
    } else if (currentStep === STEPS.LOAN_CONFIRMATION) {
      setCurrentStep(STEPS.MANUAL_LOAN);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    resetWizard();
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case STEPS.VEHICLE_DETAILS:
        return 'Add Vehicle';
      case STEPS.LOAN_SEARCH:
        return 'Connect Auto Loan';
      case STEPS.MANUAL_LOAN:
        return 'Enter Loan Details';
      case STEPS.LOAN_CONFIRMATION:
        return 'Confirm Loan';
      default:
        return 'Add Vehicle';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {currentStep === STEPS.VEHICLE_DETAILS && (
            <VehicleDetailsForm
              onNext={handleVehicleDetailsNext}
              onCancel={handleCancel}
              initialData={vehicleData}
            />
          )}

          {currentStep === STEPS.LOAN_SEARCH && (
            <PlaidLoanSearch
              onManualEntry={handleManualEntry}
              onBack={handleBack}
            />
          )}

          {currentStep === STEPS.MANUAL_LOAN && (
            <ManualLoanForm
              onNext={handleManualLoanNext}
              onBack={handleBack}
              initialData={loanData}
            />
          )}

          {currentStep === STEPS.LOAN_CONFIRMATION && (
            <LoanConfirmation
              loanData={loanData}
              vehicleData={vehicleData}
              onConfirm={handleLoanConfirmation}
              onBack={handleBack}
              isLoading={isLoading}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
