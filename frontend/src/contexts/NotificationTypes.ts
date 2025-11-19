export type NotificationLevel = 'error' | 'success' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  type: NotificationLevel;
  duration?: number; // milliseconds, undefined = persistent
}

export interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type?: NotificationLevel, duration?: number) => void;
  removeNotification: (id: string) => void;
}
