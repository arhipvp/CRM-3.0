import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Notification {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
  duration?: number; // milliseconds, undefined = persistent
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type: 'error' | 'success' | 'info' | 'warning', duration?: number) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (message: string, type: 'error' | 'success' | 'info' | 'warning' = 'info', duration = 4000) => {
      const id = Date.now().toString();
      const notification: Notification = { id, message, type, duration };

      setNotifications(prev => [...prev, notification]);

      // Auto-remove after duration if specified
      if (duration) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

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
