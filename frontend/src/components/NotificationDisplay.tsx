import { useNotification } from '../contexts/NotificationContext';

const TYPE_STYLES: Record<
  string,
  {
    accent: string;
    surface: string;
    text: string;
    live: 'polite' | 'assertive';
  }
> = {
  error: {
    accent: 'border-l-rose-500',
    surface: 'bg-rose-50',
    text: 'text-rose-900',
    live: 'assertive',
  },
  success: {
    accent: 'border-l-emerald-500',
    surface: 'bg-emerald-50',
    text: 'text-emerald-900',
    live: 'polite',
  },
  info: {
    accent: 'border-l-sky-500',
    surface: 'bg-sky-50',
    text: 'text-sky-900',
    live: 'polite',
  },
  warning: {
    accent: 'border-l-amber-500',
    surface: 'bg-amber-50',
    text: 'text-amber-900',
    live: 'polite',
  },
};

export function NotificationDisplay() {
  const { notifications, removeNotification } = useNotification();

  if (!notifications.length) {
    return null;
  }

  return (
    <div
      className="fixed right-5 top-5 z-50 w-[min(420px,calc(100vw-2.5rem))] space-y-3"
      aria-live="polite"
    >
      {notifications.map((notification) => {
        const styles = TYPE_STYLES[notification.type] ?? TYPE_STYLES.info;

        return (
          <div
            key={notification.id}
            role="status"
            aria-live={styles.live}
            className={`rounded-2xl border border-slate-200 border-l-4 shadow-md ${styles.accent} ${styles.surface} ${styles.text}`}
          >
            <div className="flex items-start justify-between gap-3 p-4">
              <p className="text-sm leading-relaxed">{notification.message}</p>
              <button
                type="button"
                onClick={() => removeNotification(notification.id)}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-current/70 transition hover:bg-white/50 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label="Закрыть уведомление"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
