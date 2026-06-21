import { DEAL_TABS } from './helpers';
import type { DealTabId } from './helpers';

interface DealTabsProps {
  activeTab: DealTabId;
  onChange: (tabId: DealTabId) => void;
  tabCounts?: Partial<Record<DealTabId, number>>;
  loadingByTab?: Partial<Record<DealTabId, boolean>>;
}

export const DealTabs: React.FC<DealTabsProps> = ({
  activeTab,
  onChange,
  tabCounts,
  loadingByTab,
}) => (
  <div
    role="tablist"
    aria-label="Разделы выбранной сделки"
    className="app-segmented-control scrollbar-none"
  >
    {DEAL_TABS.map((tab) => {
      const isActive = activeTab === tab.id;
      const count = tabCounts?.[tab.id];
      const hasCount = typeof count === 'number';
      const isLoading = Boolean(loadingByTab?.[tab.id]);
      const ariaLabel = hasCount ? `${tab.label} ${count}` : tab.label;
      return (
        <button
          key={tab.id}
          id={`deal-tab-${tab.id}`}
          role="tab"
          aria-label={ariaLabel}
          aria-selected={isActive}
          aria-controls={`deal-tabpanel-${tab.id}`}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`app-segmented-control-button min-w-[120px] ${
            isActive
              ? 'border border-[var(--app-border)] bg-white font-semibold text-sky-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <span className={isActive ? 'font-semibold' : 'font-medium'}>{tab.label}</span>
            {isLoading ? (
              <span
                className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-sky-600 animate-spin"
                aria-label="Загрузка"
              />
            ) : (
              hasCount && (
                <span className="app-counter" aria-hidden="true">
                  {count}
                </span>
              )
            )}
          </span>
        </button>
      );
    })}
  </div>
);
