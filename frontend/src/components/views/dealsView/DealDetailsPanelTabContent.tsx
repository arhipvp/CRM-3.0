import React, { Suspense, lazy } from 'react';

import { ActivityTimeline } from '../../ActivityTimeline';
import { DealEventTimeline } from '../../DealEventTimeline';
import { InlineAlert } from '../../common/InlineAlert';
import { DealNotesSection } from './DealNotesSection';
import { ChatTab } from './tabs/ChatTab';
import type { FilesTab as FilesTabComponent } from './tabs/FilesTab';
import type { PoliciesTab as PoliciesTabComponent } from './tabs/PoliciesTab';
import type { QuotesTab as QuotesTabComponent } from './tabs/QuotesTab';
import type { TasksTab as TasksTabComponent } from './tabs/TasksTab';
import type { ActivityLog } from '../../../types';
import type { DealTabId } from './helpers';

const TasksTab = lazy(async () => {
  const module = await import('./tabs/TasksTab');
  return { default: module.TasksTab };
});
const PoliciesTab = lazy(async () => {
  const module = await import('./tabs/PoliciesTab');
  return { default: module.PoliciesTab };
});
const QuotesTab = lazy(async () => {
  const module = await import('./tabs/QuotesTab');
  return { default: module.QuotesTab };
});
const FilesTab = lazy(async () => {
  const module = await import('./tabs/FilesTab');
  return { default: module.FilesTab };
});
const TabLoadingFallback = () => <div className="py-8 text-sm text-slate-500">Загрузка...</div>;

interface DealDetailsPanelTabContentProps {
  activeTab: DealTabId;
  notesSectionProps: React.ComponentProps<typeof DealNotesSection>;
  tasksTabProps: React.ComponentProps<typeof TasksTabComponent>;
  policiesTabProps: React.ComponentProps<typeof PoliciesTabComponent>;
  quotesTabProps: React.ComponentProps<typeof QuotesTabComponent>;
  filesTabProps: React.ComponentProps<typeof FilesTabComponent>;
  chatTabProps: React.ComponentProps<typeof ChatTab>;
  activityProps: {
    activityError: string | null;
    activityLogs: ActivityLog[];
    isActivityLoading: boolean;
    dealEventsError: string | null;
    dealTimelineEvents: React.ComponentProps<typeof DealEventTimeline>['events'];
    isDealEventsLoading: boolean;
    onUpdateManualEvent: (
      eventId: string,
      data: { eventDate?: string; reason?: string },
    ) => Promise<void>;
    onDeleteManualEvent: (eventId: string) => Promise<void>;
  };
}

export const DealDetailsPanelTabContent: React.FC<DealDetailsPanelTabContentProps> = ({
  activeTab,
  notesSectionProps,
  tasksTabProps,
  policiesTabProps,
  quotesTabProps,
  filesTabProps,
  chatTabProps,
  activityProps,
}) => {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="space-y-6">
          <DealNotesSection {...notesSectionProps} />
        </div>
      );
    case 'tasks':
      return (
        <Suspense fallback={<TabLoadingFallback />}>
          <TasksTab {...tasksTabProps} />
        </Suspense>
      );
    case 'policies':
      return (
        <Suspense fallback={<TabLoadingFallback />}>
          <PoliciesTab {...policiesTabProps} />
        </Suspense>
      );
    case 'quotes':
      return (
        <Suspense fallback={<TabLoadingFallback />}>
          <QuotesTab {...quotesTabProps} />
        </Suspense>
      );
    case 'files':
      return (
        <Suspense fallback={<TabLoadingFallback />}>
          <FilesTab {...filesTabProps} />
        </Suspense>
      );
    case 'chat':
      return <ChatTab {...chatTabProps} />;
    case 'events':
      return (
        <section className="app-panel space-y-4 border-none p-6 shadow-none">
          <div className="flex items-center justify-between">
            <p className="app-label">Лента</p>
          </div>
          {activityProps.dealEventsError && (
            <InlineAlert>{activityProps.dealEventsError}</InlineAlert>
          )}
          <DealEventTimeline
            events={activityProps.dealTimelineEvents}
            isLoading={activityProps.isDealEventsLoading}
            onUpdateManualEvent={activityProps.onUpdateManualEvent}
            onDeleteManualEvent={activityProps.onDeleteManualEvent}
          />
        </section>
      );
    case 'history':
      return (
        <section className="app-panel space-y-4 border-none p-6 shadow-none">
          <div className="flex items-center justify-between">
            <p className="app-label">Журнал</p>
          </div>
          {activityProps.activityError && <InlineAlert>{activityProps.activityError}</InlineAlert>}
          <ActivityTimeline
            activities={activityProps.activityLogs}
            isLoading={activityProps.isActivityLoading}
          />
        </section>
      );
    default:
      return null;
  }
};
