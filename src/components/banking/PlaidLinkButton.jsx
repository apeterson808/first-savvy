import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { plaidAPI } from '@/api/plaidClient';
import { toast } from 'sonner';

export function PlaidLinkButton({ userId, onSuccess, onExit, children, disabled }) {
  const [linkToken, setLinkToken] = useState(null);
  const [isCreatingToken, setIsCreatingToken] = useState(false);

  useEffect(() => {
    if (userId && !linkToken) {
      createLinkToken();
    }
  }, [userId]);

  const createLinkToken = async () => {
    setIsCreatingToken(true);
    try {
      const response = await plaidAPI.createLinkToken(userId);
      setLinkToken(response.link_token);
    } catch (error) {
      console.error('Error creating link token:', error);
      toast.error('Failed to initialize bank connection');
    } finally {
      setIsCreatingToken(false);
    }
  };

  const handleOnSuccess = async (publicToken, metadata) => {
    try {
      const response = await plaidAPI.exchangePublicToken(publicToken, metadata);
      onSuccess?.(response);
    } catch (error) {
      console.error('Error exchanging token:', error);
      toast.error('Failed to complete bank connection');
    }
  };

  const handleOnExit = (error, metadata) => {
    if (error != null) {
      console.error('Plaid Link error:', error);
      toast.error('Bank connection cancelled or failed');
    }
    onExit?.(error, metadata);
  };

  const config = {
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: handleOnExit,
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready) {
      open();
    }
  };

  if (isCreatingToken) {
    return (
      <Button disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Initializing...
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={!ready || disabled}
    >
      {children || 'Connect with Plaid'}
    </Button>
  );
}
