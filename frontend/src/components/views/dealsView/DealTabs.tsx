import { DEAL_TAB_GROUPS, DEAL_TABS, getDealTabGroup } from './helpers';
import type { DealTabId } from './helpers';
import { handleTabKeyboardNavigation } from '../../common/tabs';

const DEAL_TAB_BY_ID = new Map(DEAL_TABS.map((tab) => [tab.id, tab]));
const DEAL_GROUP_IDS = DEAL_TAB_GROUPS.map((group) => group.id);

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
}) => {
  const activeGroup = getDealTabGroup(activeTab);
  const activeGroupId = activeGroup.id;
  return (
    <div className="space-y-2">
      <div
        role="tablist"
        aria-label="Основные разделы выбранной сделки"
        className="app-segmented-control scrollbar-none"
      >
        {DEAL_TAB_GROUPS.map((group) => {
          const isActive = group.id === activeGroupId;
          const count = group.tabs.reduce((total, tabId) => total + (tabCounts?.[tabId] ?? 0), 0);
          const isLoading = group.tabs.some((tabId) => loadingByTab?.[tabId]);
          return (
            <button
              key={group.id}
              id={`deal-tab-group-${group.id}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              type="button"
              onClick={() => onChange(group.tabs[0])}
              onKeyDown={(event) =>
                handleTabKeyboardNavigation({
                  event,
                  tabs: DEAL_GROUP_IDS,
                  activeTab: activeGroupId,
                  onChange: (groupId) => {
                    const nextGroup = DEAL_TAB_GROUPS.find((item) => item.id === groupId);
                    if (nextGroup) onChange(nextGroup.tabs[0]);
                  },
                  getTabElementId: (groupId) => `deal-tab-group-${groupId}`,
                })
              }
              className={`app-segmented-control-button min-w-[140px] ${
                isActive
                  ? 'border border-[var(--app-border)] bg-white font-semibold text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                {group.label}
                {isLoading ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600"
                    aria-label="Загрузка"
                  />
                ) : count > 0 ? (
                  <span className="app-counter" aria-hidden="true">
                    {count}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="flex min-h-8 flex-wrap items-start gap-2"
        aria-label={activeGroup.tabs.length > 1 ? `Подразделы: ${activeGroup.label}` : undefined}
        aria-hidden={activeGroup.tabs.length > 1 ? undefined : true}
        data-testid="deal-subtabs"
      >
        {activeGroup.tabs.length > 1 &&
          activeGroup.tabs.map((tabId) => {
            const tab = DEAL_TAB_BY_ID.get(tabId);
            if (!tab) return null;
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                id={`deal-tab-${tabId}`}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(tabId)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
      </div>
    </div>
  );
};
