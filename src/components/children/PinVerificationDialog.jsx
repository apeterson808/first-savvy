import React, { useState, useEffect } from 'react';
import { childProfilesAPI } from '@/api/childProfiles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { AlertCircle, Loader2 } from 'lucide-react';
import ChildAvatar from './ChildAvatar';

export default function PinVerificationDialog({ child, open, onOpenChange, onSuccess }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPin('');
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (pin.length === (child?.pin_length || 4)) {
      handleVerify();
    }
  }, [pin]);

  const handleVerify = async () => {
    if (!pin || pin.length < 4) return;

    setLoading(true);
    setError('');

    try {
      const verified = await childProfilesAPI.verifyChildPinForParent(child.id, pin);

      if (verified) {
        await childProfilesAPI.recordSuccessfulLogin(child.id);
        onSuccess(child);
        onOpenChange(false);
      } else {
        const attemptsLeft = 5 - (child.failed_login_attempts + 1);
        if (attemptsLeft > 0) {
          setError(`Incorrect PIN. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`);
        } else {
          setError('Account has been locked. Please unlock it from Settings.');
          setTimeout(() => {
            onOpenChange(false);
          }, 3000);
        }
        setPin('');
      }
    } catch (err) {
      console.error('PIN verification error:', err);
      setError(err.message || 'Failed to verify PIN. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPin('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center space-y-4 mb-4">
            <ChildAvatar child={child} size="lg" />
            <div className="text-center">
              <DialogTitle className="text-2xl">
                {child?.display_name || child?.child_name}
              </DialogTitle>
              <DialogDescription className="mt-2">
                Enter your PIN to continue
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col items-center space-y-4">
            <InputOTP
              maxLength={child?.pin_length || 4}
              value={pin}
              onChange={(value) => setPin(value)}
              disabled={loading}
              autoFocus
            >
              <InputOTPGroup>
                {Array.from({ length: child?.pin_length || 4 }).map((_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>

          <div className="text-center text-sm text-slate-500">
            <p>Forgot your PIN? Ask your parent to reset it in Settings.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
