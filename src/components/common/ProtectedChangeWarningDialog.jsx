import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ShieldAlert, FileWarning } from 'lucide-react';

export default function ProtectedChangeWarningDialog({
  open,
  onOpenChange,
  configurationName,
  affectedFiles = [],
  changeDescription,
  onConfirm,
  onCancel
}) {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const requiredConfirmation = 'I CONFIRM CATEGORY CHANGE';
  const isValid = confirmText === requiredConfirmation;

  const handleConfirm = () => {
    if (!isValid) {
      setError('Please type the confirmation text exactly as shown');
      return;
    }

    setError('');
    setConfirmText('');
    onConfirm?.();
  };

  const handleCancel = () => {
    setError('');
    setConfirmText('');
    onCancel?.();
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      handleCancel();
    }
    onOpenChange?.(isOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-xl">Protected Configuration Change</AlertDialogTitle>
              <p className="text-sm text-slate-500 mt-1">This requires explicit confirmation</p>
            </div>
          </div>

          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-900">
              You are about to modify a <strong>protected configuration</strong>. This configuration is critical to the application's functionality and should only be changed with explicit approval.
            </AlertDescription>
          </Alert>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Configuration Details</h4>
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Name:</span>
                <span className="font-mono font-medium">{configurationName}</span>
              </div>
              {changeDescription && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Change:</span>
                  <span className="font-medium">{changeDescription}</span>
                </div>
              )}
            </div>
          </div>

          {affectedFiles.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <FileWarning className="h-4 w-4" />
                Affected Files
              </h4>
              <div className="bg-slate-50 rounded-lg p-3">
                <ul className="space-y-1">
                  {affectedFiles.map((file, idx) => (
                    <li key={idx} className="text-sm font-mono text-slate-700">
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-3 text-blue-900">Confirmation Required</h4>
            <p className="text-sm text-blue-800 mb-3">
              To proceed with this change, please type the following text exactly:
            </p>
            <div className="bg-white rounded border border-blue-300 px-3 py-2 mb-3">
              <code className="text-sm font-mono font-bold text-blue-900">{requiredConfirmation}</code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-text" className="text-sm text-blue-900">
                Confirmation Text
              </Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value);
                  setError('');
                }}
                placeholder="Type the confirmation text"
                className="font-mono"
                autoComplete="off"
              />
              {error && (
                <p className="text-sm text-red-600 mt-1">{error}</p>
              )}
              {confirmText && !isValid && (
                <p className="text-sm text-amber-600 mt-1">Text does not match. Please type exactly as shown.</p>
              )}
              {isValid && (
                <p className="text-sm text-green-600 mt-1">Confirmation text is correct</p>
              )}
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            Confirm Change
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
