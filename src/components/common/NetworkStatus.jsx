import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { setupNetworkListeners } from '../utils/errorHandler';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const cleanup = setupNetworkListeners(
      () => {
        setIsOnline(true);
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      },
      () => setIsOnline(false)
    );
    return cleanup;
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
      isOnline 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800'
    }`}>
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          Back online
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          No internet connection
        </>
      )}
    </div>
  );
}