import React, { useState, useEffect, useCallback } from 'react';
import { PlaidEmbeddedLink } from 'react-plaid-link';
import { base44 } from '@/api/base44Client';
import { RefreshCw } from 'lucide-react';

export default function PlaidEmbeddedSearch({ onSuccess, onExit, onPlaidStateChange }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await base44.functions.plaidCreateLinkToken();
        if (response?.link_token) {
          setLinkToken(response.link_token);
        } else {
          throw new Error('No link token received');
        }
      } catch (err) {
        console.error('Link token error:', err);
        setError(err.message || 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    };

    fetchLinkToken();
  }, []);

  const onPlaidSuccess = useCallback(async (public_token, metadata) => {
    setLoading(true);
    onPlaidStateChange?.(true);
    try {
      const selectedAccountIds = metadata.accounts?.map(acc => acc.id) || [];
      const response = await base44.functions.plaidExchangeToken({
        public_token,
        selected_account_ids: selectedAccountIds
      });
      onSuccess?.(response);
    } catch (error) {
      console.error('Exchange error:', error);
      alert(`Failed to connect: ${error.message}`);
    } finally {
      setLoading(false);
      onPlaidStateChange?.(false);
    }
  }, [onSuccess, onPlaidStateChange]);

  const onPlaidExit = useCallback((err, metadata) => {
    onPlaidStateChange?.(false);
    onExit?.(err, metadata);
  }, [onExit, onPlaidStateChange]);

  const onPlaidEvent = useCallback((eventName, metadata) => {
    console.log('Plaid event:', eventName, metadata);
  }, []);

  const onLoad = useCallback(() => {
    console.log('Plaid embedded module loaded');
  }, []);

  if (loading && !linkToken) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm text-slate-600">Loading bank search...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-red-600 mb-2">Failed to load</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!linkToken) {
    return null;
  }

  return (
    <div className="w-full">
      <PlaidEmbeddedLink
        token={linkToken}
        onSuccess={onPlaidSuccess}
        onExit={onPlaidExit}
        onEvent={onPlaidEvent}
        onLoad={onLoad}
        style={{
          height: '400px',
          width: '100%',
        }}
      />
    </div>
  );
}
