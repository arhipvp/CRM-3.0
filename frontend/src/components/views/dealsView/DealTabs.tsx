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
    className="flex w-full flex-nowrap gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-1 scrollbar-none"
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
          className={`min-w-[120px] flex-shrink-0 rounded-xl px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
            isActive
              ? 'bg-white font-semibold text-sky-700 border border-slate-200 shadow-sm'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }`}
        >
          <span className={isActive ? 'font-semibold' : 'font-medium'}>
            {tab.label}
          </span>
        </button>
      );
    })}
  </div>
);

