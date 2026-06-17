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
import type { DealTimelineEventType } from '../../../types';
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
    onCreateManualEvent: (data: {
      eventType?: Extract<DealTimelineEventType, 'manual' | 'manual_expected_close'>;
      eventDate: string;
      reason: string;
    }) => Promise<void>;
    onUpdateManualEvent: (
      eventId: string,
      data: { eventDate?: string; reason?: string },
    ) => Promise<void>;
    onDeleteManualEvent: (eventId: string) => Promise<void>;
  };
}

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

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
  const [manualEventDate, setManualEventDate] = React.useState(getTodayInputValue);
  const [manualEventType, setManualEventType] =
    React.useState<Extract<DealTimelineEventType, 'manual' | 'manual_expected_close'>>('manual');
  const [manualEventReason, setManualEventReason] = React.useState('');
  const [manualEventError, setManualEventError] = React.useState<string | null>(null);
  const [isManualEventFormOpen, setIsManualEventFormOpen] = React.useState(false);
  const [isManualEventSaving, setIsManualEventSaving] = React.useState(false);

  const resetManualEventForm = () => {
    setManualEventDate(getTodayInputValue());
    setManualEventType('manual');
    setManualEventReason('');
    setManualEventError(null);
  };

  const handleManualEventCancel = () => {
    resetManualEventForm();
    setIsManualEventFormOpen(false);
  };

  const handleManualEventSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = manualEventReason.trim();
    if (!manualEventDate || !reason) {
      setManualEventError('Укажите дату и причину события.');
      return;
    }

    setManualEventError(null);
    setIsManualEventSaving(true);
    try {
      await activityProps.onCreateManualEvent({
        eventType: manualEventType,
        eventDate: manualEventDate,
        reason,
      });
      resetManualEventForm();
      setIsManualEventFormOpen(false);
    } catch (err) {
      console.error('Ошибка создания события сделки:', err);
      setManualEventError('Не удалось добавить событие.');
    } finally {
      setIsManualEventSaving(false);
    }
  };

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
            {!isManualEventFormOpen && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setManualEventError(null);
                  setIsManualEventFormOpen(true);
                }}
              >
                Добавить событие
              </button>
            )}
          </div>
          {(activityProps.dealEventsError || manualEventError) && (
            <InlineAlert>{activityProps.dealEventsError ?? manualEventError}</InlineAlert>
          )}
          {isManualEventFormOpen && (
            <form className="app-panel-muted space-y-4 p-4" onSubmit={handleManualEventSubmit}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Новое событие</p>
                  <p className="text-xs text-slate-500">
                    Добавьте дату и причину, чтобы событие появилось в ленте сделки.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-quiet"
                  onClick={handleManualEventCancel}
                >
                  Отмена
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-[180px_220px_minmax(0,1fr)_auto] md:items-end">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Дата</span>
                  <input
                    type="date"
                    className="input"
                    value={manualEventDate}
                    onChange={(event) => setManualEventDate(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Тип</span>
                  <select
                    className="input"
                    value={manualEventType}
                    onChange={(event) =>
                      setManualEventType(
                        event.target.value as Extract<
                          DealTimelineEventType,
                          'manual' | 'manual_expected_close'
                        >,
                      )
                    }
                  >
                    <option value="manual">Обычное событие</option>
                    <option value="manual_expected_close">Ручной крайний срок</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Причина</span>
                  <input
                    type="text"
                    className="input"
                    value={manualEventReason}
                    onChange={(event) => setManualEventReason(event.target.value)}
                    placeholder="Например: предположительно купит квартиру, предложить застраховать"
                  />
                </label>
                <button type="submit" className="btn btn-primary" disabled={isManualEventSaving}>
                  {isManualEventSaving ? 'Добавляем…' : 'Добавить'}
                </button>
              </div>
            </form>
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
