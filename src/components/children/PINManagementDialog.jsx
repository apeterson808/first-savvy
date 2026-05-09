import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Check, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { childProfilesAPI } from '@/api/childProfiles';
import { toast } from 'sonner';

export function PINManagementDialog({ open, onOpenChange, childProfile, onSuccess }) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pinRefs = [useRef(), useRef(), useRef(), useRef()];
  const confirmRefs = [useRef(), useRef(), useRef(), useRef()];

  const handlePinChange = (index, value, isConfirm = false) => {
    if (!/^\d*$/.test(value)) return;

    const newValue = value.slice(-1);
    const refs = isConfirm ? confirmRefs : pinRefs;
    const setPinFunc = isConfirm ? setConfirmPin : setPin;

    setPinFunc(prev => {
      const newPin = [...prev];
      newPin[index] = newValue;
      return newPin;
    });

    if (newValue && index < 3) {
      refs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e, isConfirm = false) => {
    const refs = isConfirm ? confirmRefs : pinRefs;
    const setPinFunc = isConfirm ? setConfirmPin : setPin;

    if (e.key === 'Backspace') {
      if (!e.currentTarget.value && index > 0) {
        refs[index - 1].current?.focus();
      } else {
        setPinFunc(prev => {
          const newPin = [...prev];
          newPin[index] = '';
          return newPin;
        });
      }
    }
  };

  const generateRandomPin = () => {
    const randomPin = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10).toString());
    setPin(randomPin);
    setConfirmPin(randomPin);
    toast.success('Random PIN generated', {
      description: `PIN: ${randomPin.join('')} - Make sure to remember this!`
    });
  };

  const pinMatches = pin.join('') === confirmPin.join('') && pin.every(d => d !== '');
  const pinComplete = pin.every(d => d !== '');
  const confirmComplete = confirmPin.every(d => d !== '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!pinComplete) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    if (!confirmComplete) {
      setError('Please confirm your PIN');
      return;
    }

    if (!pinMatches) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);

    try {
      await childProfilesAPI.setChildPin(childProfile.id, pin.join(''));

      const hasUsername = childProfile.username && childProfile.username.trim().length > 0;

      toast.success('PIN set successfully', {
        description: hasUsername
          ? `${childProfile.display_name || childProfile.child_name} can now log in with username and PIN`
          : `Login PIN has been set for ${childProfile.display_name || childProfile.child_name}`
      });

      onSuccess?.();
      onOpenChange(false);

      setPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
    } catch (err) {
      setError(err.message || 'Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPin(['', '', '', '']);
    setConfirmPin(['', '', '', '']);
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {childProfile?.pin_hash ? 'Change PIN' : 'Set PIN'}
          </DialogTitle>
          <DialogDescription>
            Create a 4-digit PIN for {childProfile?.display_name || childProfile?.child_name} to log in with their username.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Enter PIN</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex gap-2 justify-center">
                {pin.map((digit, index) => (
                  <Input
                    key={`pin-${index}`}
                    ref={pinRefs[index]}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value, false)}
                    onKeyDown={(e) => handleKeyDown(index, e, false)}
                    className="w-14 h-14 text-center text-2xl font-bold"
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Confirm PIN</Label>
                {pinComplete && confirmComplete && (
                  pinMatches ? (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <Check className="h-4 w-4" />
                      <span>Match</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      <span>No match</span>
                    </div>
                  )
                )}
              </div>
              <div className="flex gap-2 justify-center">
                {confirmPin.map((digit, index) => (
                  <Input
                    key={`confirm-${index}`}
                    ref={confirmRefs[index]}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value, true)}
                    onKeyDown={(e) => handleKeyDown(index, e, true)}
                    className={`w-14 h-14 text-center text-2xl font-bold ${
                      confirmComplete && pinMatches ? 'border-green-500' :
                      confirmComplete && !pinMatches ? 'border-red-500' : ''
                    }`}
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={generateRandomPin}
              disabled={loading}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Random PIN
            </Button>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Make sure to remember this PIN or write it down somewhere safe. Your child will need it to log in.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !pinMatches}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting PIN...
                </>
              ) : (
                'Set PIN'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
