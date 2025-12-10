import React from 'react';

import { DEAL_TABS } from './helpers';
import type { DealTabId } from './helpers';

interface DealTabsProps {
  activeTab: DealTabId;
  onChange: (tabId: DealTabId) => void;
}

export const DealTabs: React.FC<DealTabsProps> = ({ activeTab, onChange }) => (
  <div
    role="tablist"
    aria-label="Разделы выбранной сделки"
    className="flex w-full flex-nowrap gap-2 overflow-x-auto border-b border-slate-200 pb-2 scrollbar-none"
  >
    {DEAL_TABS.map((tab) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          id={`deal-tab-${tab.id}`}
          role="tab"
          aria-selected={isActive}
          aria-controls={`deal-tabpanel-${tab.id}`}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`min-w-[120px] flex-shrink-0 rounded-t-2xl px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
            isActive
              ? 'bg-white font-semibold text-sky-600 border border-b-white border-slate-200 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className={isActive ? 'font-semibold' : 'font-medium'}>{tab.label}</span>
        </button>
      );
    })}
  </div>
);
