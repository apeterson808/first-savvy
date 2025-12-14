import React, { useState, useEffect } from 'react';
import NetWorthOverviewTab from '../components/networth/NetWorthOverviewTab';
import AssetsTab from '../components/networth/AssetsTab';
import LiabilitiesTab from '../components/networth/LiabilitiesTab';

export default function NetWorth() {
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      setActiveTab(urlParams.get('tab') || 'overview');
    };
    
    // Set initial tab from URL
    handlePopState();
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {activeTab === 'overview' && <NetWorthOverviewTab />}
      {activeTab === 'assets' && <AssetsTab />}
      {activeTab === 'liabilities' && <LiabilitiesTab />}
    </div>
  );
}