import { useMemo, useState } from 'react';

import type { DealTimelineEvent } from '../types';
import { ColoredLabel } from './common/ColoredLabel';
import { PANEL_MUTED_TEXT } from './common/uiClassNames';

interface DealEventTimelineProps {
  events: DealTimelineEvent[];
  isLoading?: boolean;
  onUpdateManualEvent?: (
    eventId: string,
    data: { eventDate?: string; reason?: string },
  ) => Promise<void>;
  onDeleteManualEvent?: (eventId: string) => Promise<void>;
}

const eventIcon: Record<DealTimelineEvent['eventType'], string> = {
  manual: '✎',
  manual_expected_close: '✎',
  manual_next_contact: '✎',
  payment_due: '₽',
  policy_expiration: '⏱',
  deal_updated: '•',
  task_created: '✓',
  task_completed: '✓',
  policy_created: '📄',
  quote_created: '🧾',
  file_uploaded: '⤒',
};

const MANAGEABLE_EVENT_TYPES: DealTimelineEvent['eventType'][] = [
  'manual',
  'manual_expected_close',
  'manual_next_contact',
];

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const parseEventDate = (value: string) => {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(value);
};

const formatEventDate = (value: string) => {
  const parsed = parseEventDate(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

const startOfLocalDay = (value: Date) => {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getDayDiff = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = parseEventDate(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const today = startOfLocalDay(new Date());
  const eventDate = startOfLocalDay(parsed);
  return Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getCreatedAtTime = (event: DealTimelineEvent) => {
  const parsed = new Date(event.createdAt);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const sortEventsByDateCloseness = (events: DealTimelineEvent[]) =>
  [...events].sort((left, right) => {
    const leftDiff = getDayDiff(left.eventDate);
    const rightDiff = getDayDiff(right.eventDate);

    if (leftDiff === null && rightDiff === null) {
      return getCreatedAtTime(right) - getCreatedAtTime(left);
    }
    if (leftDiff === null) {
      return 1;
    }
    if (rightDiff === null) {
      return -1;
    }

    const absoluteDiff = Math.abs(leftDiff) - Math.abs(rightDiff);
    if (absoluteDiff !== 0) {
      return absoluteDiff;
    }

    if (leftDiff >= 0 && rightDiff < 0) {
      return -1;
    }
    if (leftDiff < 0 && rightDiff >= 0) {
      return 1;
    }

    return leftDiff - rightDiff || getCreatedAtTime(right) - getCreatedAtTime(left);
  });

const getEventUrgencyClasses = (event: DealTimelineEvent) => {
  const diffDays = getDayDiff(event.eventDate);

  if (diffDays === null) {
    return {
      marker: 'border border-slate-200 bg-slate-100 text-slate-500',
      dateBadge: 'border-slate-200 bg-slate-50 text-slate-500',
      title: 'text-slate-900',
      body: 'text-slate-700',
      meta: 'text-slate-400',
      connector: 'bg-slate-200',
      row: '',
      isPast: false,
    };
  }

  if (diffDays < 0) {
    return {
      marker: 'border border-slate-200 bg-slate-100 text-slate-400',
      dateBadge: 'border-slate-200 bg-slate-50 text-slate-400',
      title: 'text-slate-500',
      body: 'text-slate-500',
      meta: 'text-slate-400',
      connector: 'bg-slate-100',
      row: 'opacity-75',
      isPast: true,
    };
  }

  if (diffDays <= 0) {
    return {
      marker: 'bg-rose-600 text-white',
      dateBadge: 'border-rose-200 bg-rose-50 text-rose-700',
      title: 'text-slate-900',
      body: 'text-slate-700',
      meta: 'text-rose-700',
      connector: 'bg-rose-100',
      row: '',
      isPast: false,
    };
  }

  if (diffDays <= 3) {
    return {
      marker: 'bg-orange-500 text-white',
      dateBadge: 'border-orange-200 bg-orange-50 text-orange-700',
      title: 'text-slate-900',
      body: 'text-slate-700',
      meta: 'text-orange-700',
      connector: 'bg-orange-100',
      row: '',
      isPast: false,
    };
  }

  return {
    marker: 'bg-emerald-500 text-white',
    dateBadge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    title: 'text-slate-900',
    body: 'text-slate-700',
    meta: 'text-emerald-700',
    connector: 'bg-emerald-100',
    row: '',
    isPast: false,
  };
};

export function DealEventTimeline({
  events,
  isLoading = false,
  onUpdateManualEvent,
  onDeleteManualEvent,
}: DealEventTimelineProps) {
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState('');
  const [editingReason, setEditingReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const sortedEvents = useMemo(() => sortEventsByDateCloseness(events), [events]);

  const startEditing = (event: DealTimelineEvent) => {
    setEditingEventId(event.id);
    setEditingDate(event.eventDate ?? '');
    setEditingReason(event.title);
    setActionError(null);
  };

  const cancelEditing = () => {
    setEditingEventId(null);
    setEditingDate('');
    setEditingReason('');
    setActionError(null);
  };

  const saveEditing = async (eventId: string) => {
    if (!onUpdateManualEvent) {
      return;
    }
    const reason = editingReason.trim();
    if (!editingDate || !reason) {
      setActionError('Укажите дату и причину события.');
      return;
    }
    setSavingEventId(eventId);
    setActionError(null);
    try {
      await onUpdateManualEvent(eventId, { eventDate: editingDate, reason });
      cancelEditing();
    } catch (err) {
      console.error('Ошибка обновления события сделки:', err);
      setActionError('Не удалось сохранить событие.');
    } finally {
      setSavingEventId(null);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!onDeleteManualEvent) {
      return;
    }
    setDeletingEventId(eventId);
    setActionError(null);
    try {
      await onDeleteManualEvent(eventId);
      if (editingEventId === eventId) {
        cancelEditing();
      }
    } catch (err) {
      console.error('Ошибка удаления события сделки:', err);
      setActionError('Не удалось удалить событие.');
    } finally {
      setDeletingEventId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="app-panel-muted p-4">
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-1/3 rounded bg-slate-200" />
                <div className="h-3 w-2/3 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return <div className={PANEL_MUTED_TEXT}>Пока нет событий по сделке.</div>;
  }

  return (
    <div className="relative space-y-6">
      {actionError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </div>
      )}
      {sortedEvents.map((event, index) => {
        const isLast = index === sortedEvents.length - 1;
        const urgency = getEventUrgencyClasses(event);
        const canManage =
          MANAGEABLE_EVENT_TYPES.includes(event.eventType) &&
          onUpdateManualEvent &&
          onDeleteManualEvent;
        const isEditing = editingEventId === event.id;
        return (
          <div
            key={event.id}
            className={`relative flex gap-4 ${urgency.row}`}
            data-testid={`deal-event-row-${event.id}`}
          >
            <div className="relative flex h-full w-10 flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm ${urgency.marker}`}
                aria-hidden="true"
                data-testid={`deal-event-marker-${event.id}`}
              >
                <span className="text-base leading-none">{eventIcon[event.eventType]}</span>
              </div>
              {!isLast && <div className={`mt-2 h-full w-px flex-1 ${urgency.connector}`} />}
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {isEditing ? (
                  <input
                    type="text"
                    className="input min-w-0 flex-1"
                    value={editingReason}
                    onChange={(inputEvent) => setEditingReason(inputEvent.target.value)}
                    aria-label="Причина события"
                  />
                ) : (
                  <span className={`text-sm font-semibold ${urgency.title}`}>{event.title}</span>
                )}
                {event.actorDisplayName && (
                  <span className={`text-xs ${urgency.meta}`}>
                    •{' '}
                    <ColoredLabel
                      value={event.actorDisplayName}
                      fallback="—"
                      showDot={false}
                      className={urgency.meta}
                    />
                  </span>
                )}
                <span className={`ml-auto text-xs ${urgency.meta}`}>
                  {formatDateTime(event.createdAt)}
                </span>
                {canManage && !isEditing && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet"
                      onClick={() => startEditing(event)}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => void deleteEvent(event.id)}
                      disabled={deletingEventId === event.id}
                    >
                      {deletingEventId === event.id ? 'Удаляем…' : 'Удалить'}
                    </button>
                  </div>
                )}
              </div>
              {isEditing && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    className="input w-44"
                    value={editingDate}
                    onChange={(inputEvent) => setEditingDate(inputEvent.target.value)}
                    aria-label="Дата события"
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => void saveEditing(event.id)}
                    disabled={savingEventId === event.id}
                  >
                    {savingEventId === event.id ? 'Сохраняем…' : 'Сохранить'}
                  </button>
                  <button type="button" className="btn btn-sm btn-quiet" onClick={cancelEditing}>
                    Отмена
                  </button>
                </div>
              )}
              {!isEditing && event.description && (
                <p className={`mt-2 text-sm leading-relaxed ${urgency.body}`}>
                  {event.description}
                </p>
              )}
              {!isEditing && event.eventDate && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${urgency.dateBadge}`}
                    data-testid={`deal-event-date-${event.id}`}
                  >
                    {urgency.isPast ? 'Прошло' : 'Дата события'}: {formatEventDate(event.eventDate)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
