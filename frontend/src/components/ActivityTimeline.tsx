import { ActivityLog } from '../types';
import { ColoredLabel } from './common/ColoredLabel';

interface ActivityTimelineProps {
  activities: ActivityLog[];
  isLoading?: boolean;
}

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'created':
      return '✓';
    case 'status_changed':
      return '⇄';
    case 'stage_changed':
      return '→';
    case 'description_updated':
      return '✎';
    case 'assigned':
      return '👤';
    case 'policy_created':
      return '📄';
    case 'quote_added':
      return '🧾';
    case 'document_uploaded':
      return '⤒';
    case 'payment_created':
      return '₽';
    case 'comment_added':
      return '💬';
    default:
      return '•';
  }
};

const getActionColorClass = (actionType: string) => {
  switch (actionType) {
    case 'created':
      return 'bg-emerald-500 text-white';
    case 'status_changed':
      return 'bg-amber-500 text-white';
    case 'stage_changed':
      return 'bg-sky-500 text-white';
    case 'policy_created':
      return 'bg-violet-500 text-white';
    case 'payment_created':
      return 'bg-pink-500 text-white';
    default:
      return 'bg-slate-500 text-white';
  }
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  isLoading = false,
}) => {
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

  if (activities.length === 0) {
    return (
      <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">Пока нет событий по сделке.</div>
    );
  }

  return (
    <div className="relative space-y-6">
      {activities.map((activity, index) => {
        const isLast = index === activities.length - 1;
        const markerClass = getActionColorClass(activity.actionType);
        return (
          <div key={activity.id} className="relative flex gap-4">
            <div className="relative flex h-full w-10 flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm ${markerClass}`}
                aria-hidden="true"
              >
                <span className="text-base leading-none">
                  {getActionIcon(activity.actionType)}
                </span>
              </div>
              {!isLast && (
                <div className="mt-2 h-full w-px flex-1 bg-slate-200" />
              )}
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-slate-900">
                  {activity.actionTypeDisplay}
                </span>
                {activity.userUsername && (
                  <span className="text-xs text-slate-600">
                    •{' '}
                    <ColoredLabel
                      value={activity.userUsername}
                      fallback="—"
                      showDot={false}
                      className="text-slate-600"
                    />
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">
                  {formatDateTime(activity.createdAt)}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {activity.description}
              </p>

              {activity.oldValue && activity.newValue && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="rounded-lg bg-rose-50 px-2 py-1 font-mono text-rose-700">
                    Было: {activity.oldValue}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 font-mono text-emerald-700">
                    Стало: {activity.newValue}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
