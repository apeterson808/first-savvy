import React, { useState, useEffect } from 'react';

export function PageTabs({ tabs, defaultTab = 'overview', disabledTabs = [], actions }) {
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
    <div className="flex items-center justify-between mb-0 relative">
      <div className="flex items-center gap-1">
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
              className={`group flex items-center gap-1.5 px-4 py-1.5 cursor-pointer transition-all min-w-[100px] max-w-[180px] relative capitalize text-sm font-medium ${
                isActive
                  ? 'bg-slate-100 text-slate-900 z-10'
                  : isDisabled
                  ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              style={{
                borderTop: isActive ? '2px solid #cbd5e1' : '2px solid transparent',
                borderLeft: isActive ? '2px solid #cbd5e1' : '2px solid transparent',
                borderRight: isActive ? '2px solid #cbd5e1' : '2px solid transparent',
                borderBottom: isActive ? '2px solid #f1f5f9' : 'none',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                marginBottom: isActive ? '-2px' : '0',
                paddingBottom: isActive ? 'calc(0.375rem + 2px)' : '0.375rem',
              }}
            >
              {tab.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
      {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
      <div className="absolute bottom-0 h-0.5 bg-slate-300 z-0" style={{ left: '-1rem', right: '-1rem' }}></div>
    </div>
  );
}
