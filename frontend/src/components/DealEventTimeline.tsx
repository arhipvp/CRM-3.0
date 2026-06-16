import type { DealTimelineEvent } from '../types';
import { ColoredLabel } from './common/ColoredLabel';
import { PANEL_MUTED_TEXT } from './common/uiClassNames';

interface DealEventTimelineProps {
  events: DealTimelineEvent[];
  isLoading?: boolean;
}

const eventIcon: Record<DealTimelineEvent['eventType'], string> = {
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

export function DealEventTimeline({ events, isLoading = false }: DealEventTimelineProps) {
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
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const markerClass = eventColorClass[event.eventType] ?? 'bg-slate-500 text-white';
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
                <span className="text-sm font-semibold text-slate-900">{event.title}</span>
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
              {event.description && (
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{event.description}</p>
              )}
              {event.eventDate && (
                <p className="mt-1 text-xs text-slate-400">Дата события: {event.eventDate}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
