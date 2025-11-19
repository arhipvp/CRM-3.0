import React, { createContext, useContext, useState, useCallback } from 'react';
import { Notification, NotificationContextType, NotificationLevel } from './NotificationTypes';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (
      message: string,
      type: NotificationLevel = 'info',
      duration = 4000
    ) => {
      const id = Date.now().toString();
      const notification: Notification = { id, message, type, duration };

      setNotifications((prev) => [...prev, notification]);

      // Auto-remove after duration if specified
      if (duration) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    [removeNotification]
  );

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
