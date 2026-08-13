import { useNotification } from '../contexts/NotificationContext';
import { IconButton } from './common/Button';

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

type NotificationDisplayProps = {
  bottomOffsetClassName?: string;
};

export function NotificationDisplay({
  bottomOffsetClassName = 'bottom-4',
}: NotificationDisplayProps) {
  const { notifications, removeNotification } = useNotification();

  if (!notifications.length) {
    return null;
  }

  return (
    <div
      className={`fixed left-4 z-50 w-[min(420px,calc(100vw-1.5rem))] space-y-2 ${bottomOffsetClassName}`}
      aria-live="polite"
    >
      {notifications.map((notification) => {
        const styles = TYPE_STYLES[notification.type] ?? TYPE_STYLES.info;

        return (
          <div
            key={notification.id}
            role="status"
            aria-live={styles.live}
            className={`rounded-[var(--app-radius-md)] border border-[var(--app-border)] border-l-4 shadow-[var(--app-shadow)] ${styles.accent} ${styles.surface} ${styles.text}`}
          >
            <div className="flex items-start justify-between gap-3 px-3 py-2.5">
              <p className="text-sm leading-relaxed">{notification.message}</p>
              <IconButton
                icon="close"
                label="Закрыть уведомление"
                size="sm"
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 border-transparent bg-transparent text-current shadow-none hover:bg-white/60"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
