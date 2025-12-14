import React, { useCallback, useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function PlaidLinkButton({ onSuccess, onExit, onLinkStart, className, children, onPlaidStateChange }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const onPlaidSuccess = useCallback(async (public_token, metadata) => {
    setLoading(true);
    try {
      // Pass selected account IDs from Plaid metadata
      const selectedAccountIds = metadata.accounts?.map(acc => acc.id) || [];
      const response = await base44.functions.invoke('plaidExchangeToken', { 
        public_token,
        selected_account_ids: selectedAccountIds 
      });
      // Pass discovered accounts to parent for review
      onSuccess?.(response.data);
    } catch (error) {
      console.error('Exchange error:', error);
      alert(`Failed to connect: ${error.message}`);
    } finally {
      setLoading(false);
      setLinkToken(null);
      onPlaidStateChange?.(false);
    }
  }, [onSuccess, onPlaidStateChange]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err, metadata) => {
      setLinkToken(null);
      setLoading(false);
      onPlaidStateChange?.(false);
      onExit?.(err, metadata);
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      onPlaidStateChange?.(true);
      open();
    }
  }, [linkToken, ready, open, onPlaidStateChange]);

  const handleClick = async () => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      const response = await base44.functions.invoke('plaidCreateLinkToken');
      if (response.data?.link_token) {
        setLinkToken(response.data.link_token);
        onLinkStart?.();
      } else {
        throw new Error('No link token received');
      }
    } catch (error) {
      console.error('Link token error:', error);
      alert(`Failed to initialize: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? 'Connecting...' : children || 'Connect Account'}
    </Button>
  );
}