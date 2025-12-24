import React, { useState, useEffect } from 'react';

export function PageTabs({ tabs, defaultTab = 'overview', disabledTabs = [] }) {
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') || defaultTab;
  });

  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      setActiveTab(urlParams.get('tab') || defaultTab);
    };
    window.addEventListener('popstate', handlePopState);

    const interval = setInterval(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const currentTab = urlParams.get('tab') || defaultTab;
      setActiveTab(prev => prev !== currentTab ? currentTab : prev);
    }, 100);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, [defaultTab]);

  return (
    <div className="flex items-end gap-0.5 mb-4">
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        const isDisabled = disabledTabs.includes(tab);
        return (
          <button
            key={tab}
            disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return;
              const newUrl = `${window.location.pathname}?tab=${tab}`;
              window.history.pushState({}, '', newUrl);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className={`px-4 py-2 text-sm font-medium transition-all capitalize relative ${
              isActive
                ? 'bg-white text-slate-900 border-t border-l border-r border-slate-200 rounded-t-lg z-10 shadow-sm'
                : isDisabled
                ? 'text-slate-300 cursor-not-allowed bg-slate-50 border border-slate-200 rounded-t-md'
                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-t-md hover:shadow-sm'
            }`}
            style={isActive ? { marginBottom: '-1px', paddingBottom: 'calc(0.5rem + 1px)' } : {}}
          >
            {tab.replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}
