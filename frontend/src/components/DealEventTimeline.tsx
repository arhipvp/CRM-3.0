import { useState } from 'react';

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

const eventColorClass: Partial<Record<DealTimelineEvent['eventType'], string>> = {
  manual: 'bg-emerald-600 text-white',
  manual_expected_close: 'bg-sky-600 text-white',
  manual_next_contact: 'bg-slate-600 text-white',
  payment_due: 'bg-pink-500 text-white',
  policy_expiration: 'bg-violet-500 text-white',
  task_completed: 'bg-emerald-500 text-white',
  policy_created: 'bg-indigo-500 text-white',
  quote_created: 'bg-amber-500 text-white',
  file_uploaded: 'bg-cyan-600 text-white',
};

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
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const markerClass = eventColorClass[event.eventType] ?? 'bg-slate-500 text-white';
        const canManage =
          event.eventType === 'manual' && onUpdateManualEvent && onDeleteManualEvent;
        const isEditing = editingEventId === event.id;
        return (
          <div key={event.id} className="relative flex gap-4">
            <div className="relative flex h-full w-10 flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm ${markerClass}`}
                aria-hidden="true"
              >
                <span className="text-base leading-none">{eventIcon[event.eventType]}</span>
              </div>
              {!isLast && <div className="mt-2 h-full w-px flex-1 bg-slate-200" />}
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
                  <span className="text-sm font-semibold text-slate-900">{event.title}</span>
                )}
                {event.actorDisplayName && (
                  <span className="text-xs text-slate-600">
                    •{' '}
                    <ColoredLabel
                      value={event.actorDisplayName}
                      fallback="—"
                      showDot={false}
                      className="text-slate-600"
                    />
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">
                  {formatDateTime(event.createdAt)}
                </span>
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
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{event.description}</p>
              )}
              {!isEditing && event.eventDate && (
                <p className="mt-1 text-xs text-slate-400">Дата события: {event.eventDate}</p>
              )}
              {canManage && !isEditing && (
                <div className="mt-2 flex flex-wrap gap-2">
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
          </div>
        );
      })}
    </div>
  );
}
