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
    <div className="inline-flex items-center rounded-lg bg-muted p-1 mb-4">
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
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all ${
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : isDisabled
                ? 'text-muted-foreground/50 cursor-not-allowed'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
            }`}
          >
            {tab.replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}
