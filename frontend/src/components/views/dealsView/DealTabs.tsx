import { DEAL_TAB_GROUPS, DEAL_TABS, getDealTabGroup } from './helpers';
import type { DealTabId } from './helpers';
import { Tabs } from '../../common/Tabs';

const DEAL_TAB_BY_ID = new Map(DEAL_TABS.map((tab) => [tab.id, tab]));

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
      <Tabs
        idPrefix="deal-tab-group"
        ariaLabel="Основные разделы выбранной сделки"
        value={activeGroupId}
        onChange={(groupId) => {
          const nextGroup = DEAL_TAB_GROUPS.find((item) => item.id === groupId);
          if (nextGroup) onChange(nextGroup.tabs[0]);
        }}
        className="[&>button]:min-w-[140px]"
        options={DEAL_TAB_GROUPS.map((group) => ({
          value: group.id,
          label: group.label,
          count: group.tabs.reduce((total, tabId) => total + (tabCounts?.[tabId] ?? 0), 0),
          loading: group.tabs.some((tabId) => loadingByTab?.[tabId]),
        }))}
      />
      <div
        className="min-h-8"
        aria-label={activeGroup.tabs.length > 1 ? `Подразделы: ${activeGroup.label}` : undefined}
        aria-hidden={activeGroup.tabs.length > 1 ? undefined : true}
        data-testid="deal-subtabs"
      >
        {activeGroup.tabs.length > 1 && (
          <Tabs
            idPrefix="deal-tab"
            ariaLabel={`Подразделы: ${activeGroup.label}`}
            variant="secondary"
            value={activeTab}
            onChange={onChange}
            options={activeGroup.tabs.flatMap((tabId) => {
              const tab = DEAL_TAB_BY_ID.get(tabId);
              return tab ? [{ value: tabId, label: tab.label }] : [];
            })}
          />
        )}
      </div>
    </div>
  );
};
