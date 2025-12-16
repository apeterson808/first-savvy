import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserCheck, Mail, Phone as PhoneIcon } from 'lucide-react';
import { accountDetectionService, debounce } from '@/api/accountDetection';

export default function AccountDetectionField({
  type = 'email',
  value,
  onConnectionRequest,
  onInviteSend,
  disabled = false
}) {
  const [checking, setChecking] = useState(false);
  const [accountFound, setAccountFound] = useState(null);
  const [actionTaken, setActionTaken] = useState(false);

  const checkForAccount = useCallback(async (val) => {
    if (!val || actionTaken) return;

    setChecking(true);
    setAccountFound(null);

    let result;
    if (type === 'email') {
      result = await accountDetectionService.checkEmailForAccount(val);
    } else if (type === 'phone') {
      const phoneDigits = val.replace(/[^\d]/g, '');
      if (phoneDigits.length !== 10) {
        setChecking(false);
        return;
      }
      result = await accountDetectionService.checkPhoneForAccount(phoneDigits);
    }

    setChecking(false);
    setAccountFound(result);
  }, [type, actionTaken]);

  const debouncedCheck = useCallback(
    debounce((val) => checkForAccount(val), 800),
    [checkForAccount]
  );

  useEffect(() => {
    if (value && !actionTaken) {
      debouncedCheck(value);
    } else {
      setAccountFound(null);
    }
  }, [value, debouncedCheck, actionTaken]);

  const handleConnect = async () => {
    if (accountFound?.user && onConnectionRequest) {
      setActionTaken(true);
      await onConnectionRequest(accountFound.user);
    }
  };

  const handleInvite = async () => {
    if (onInviteSend) {
      setActionTaken(true);
      await onInviteSend(value, type);
    }
  };

  if (!value || disabled) return null;

  if (checking) {
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Checking for existing account...</span>
      </div>
    );
  }

  if (actionTaken) {
    return (
      <Alert className="mt-2 bg-blue-50 border-blue-200">
        <UserCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-700">
          {accountFound?.found ? 'Connection request sent!' : 'Invitation sent!'}
        </AlertDescription>
      </Alert>
    );
  }

  if (accountFound?.found && accountFound.user) {
    return (
      <Alert className="mt-2 bg-green-50 border-green-200">
        <UserCheck className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-900">Account found!</p>
              <p className="text-green-700">{accountFound.user.name}</p>
            </div>
            <Button
              size="sm"
              onClick={handleConnect}
              className="bg-green-600 hover:bg-green-700"
            >
              Connect
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (accountFound && !accountFound.found && !accountFound.error) {
    return (
      <Alert className="mt-2 bg-slate-50 border-slate-200">
        <div className="flex items-center justify-between w-full">
          <AlertDescription className="text-sm text-slate-600 flex items-center gap-2">
            {type === 'email' ? <Mail className="w-4 h-4" /> : <PhoneIcon className="w-4 h-4" />}
            <span>No account found</span>
          </AlertDescription>
          <Button
            size="sm"
            variant="outline"
            onClick={handleInvite}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            Send Invite
          </Button>
        </div>
      </Alert>
    );
  }

  return null;
}
