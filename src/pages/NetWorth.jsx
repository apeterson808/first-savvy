import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import NetWorthOverviewTab from '../components/networth/NetWorthOverviewTab';
import AssetsTab from '../components/networth/AssetsTab';
import LiabilitiesTab from '../components/networth/LiabilitiesTab';

export default function NetWorth() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    setActiveTab(urlParams.get('tab') || 'overview');
  }, [location.search]);

  return (
    <div className="min-h-screen bg-slate-50">
      {activeTab === 'overview' && <NetWorthOverviewTab />}
      {activeTab === 'assets' && <AssetsTab />}
      {activeTab === 'liabilities' && <LiabilitiesTab />}
    </div>
  );
}