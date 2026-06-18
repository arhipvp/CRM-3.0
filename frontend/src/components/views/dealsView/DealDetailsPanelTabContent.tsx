import React from 'react';

import { ActivityTimeline } from '../../ActivityTimeline';
import { DealEventTimeline } from '../../DealEventTimeline';
import { InlineAlert } from '../../common/InlineAlert';
import { DealNotesSection } from './DealNotesSection';
import { ChatTab } from './tabs/ChatTab';
import { FilesTab } from './tabs/FilesTab';
import { PoliciesTab } from './tabs/PoliciesTab';
import { QuotesTab } from './tabs/QuotesTab';
import { TasksTab } from './tabs/TasksTab';
import type { ActivityLog } from '../../../types';
import type { DealTabId } from './helpers';

interface DealDetailsPanelTabContentProps {
  activeTab: DealTabId;
  notesSectionProps: React.ComponentProps<typeof DealNotesSection>;
  tasksTabProps: React.ComponentProps<typeof TasksTab>;
  policiesTabProps: React.ComponentProps<typeof PoliciesTab>;
  quotesTabProps: React.ComponentProps<typeof QuotesTab>;
  filesTabProps: React.ComponentProps<typeof FilesTab>;
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
      return <TasksTab {...tasksTabProps} />;
    case 'policies':
      return <PoliciesTab {...policiesTabProps} />;
    case 'quotes':
      return <QuotesTab {...quotesTabProps} />;
    case 'files':
      return <FilesTab {...filesTabProps} />;
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
