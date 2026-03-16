import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { format, subMonths, startOfMonth } from 'date-fns';

export function PageTabs({ tabs, defaultTab = 'overview', disabledTabs = [], actions, dynamicTabConfig, inlineActions }) {
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

  const renderTab = (tab) => {
    const isActive = activeTab === tab;
    const isDisabled = disabledTabs.includes(tab);
    const config = dynamicTabConfig?.[tab];

    if (config?.type === 'dropdown') {
      return (
        <DropdownMenu key={tab}>
          <div className="relative inline-flex items-center">
            <button
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return;
                const newUrl = `${window.location.pathname}?tab=${tab}`;
                window.history.pushState({}, '', newUrl);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md pl-3 pr-7 py-1.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : isDisabled
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
              }`}
            >
              {config.label || tab.replace(/_/g, ' ')}
            </button>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isDisabled}
                className={`absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded px-1 py-1 text-sm transition-all ${
                  isActive
                    ? 'text-foreground hover:bg-muted'
                    : isDisabled
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:bg-muted/60'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent align="start" className="w-48">
            {config.options?.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => config.onSelect?.(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (config?.type === 'arrows') {
      const currentIndex = config.options?.findIndex(opt => opt.value === config.currentValue) ?? 0;
      const canGoPrevious = currentIndex < (config.options?.length ?? 1) - 1;
      const canGoNext = currentIndex > 0;

      return (
        <div key={tab} className="relative inline-flex items-center">
          <button
            disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return;
              const newUrl = `${window.location.pathname}?tab=${tab}`;
              window.history.pushState({}, '', newUrl);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition-all ${
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : isDisabled
                ? 'text-muted-foreground/50 cursor-not-allowed'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
            }`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (canGoPrevious && config.onNavigate) {
                  config.onNavigate(config.options[currentIndex + 1].value);
                }
              }}
              disabled={!canGoPrevious}
              className="h-5 w-5 p-0 disabled:opacity-30 hover:bg-transparent"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[80px] text-center">
              {config.label || tab.replace(/_/g, ' ')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (canGoNext && config.onNavigate) {
                  config.onNavigate(config.options[currentIndex - 1].value);
                }
              }}
              disabled={!canGoNext}
              className="h-5 w-5 p-0 disabled:opacity-30 hover:bg-transparent"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </button>
        </div>
      );
    }

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
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="inline-flex items-center gap-1">
        <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-0.5">
          {tabs.map((tab) => renderTab(tab))}
        </div>
        {inlineActions && <div className="flex items-center">{inlineActions}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
