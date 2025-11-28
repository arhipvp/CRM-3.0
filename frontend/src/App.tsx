import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from './contexts/NotificationProvider';
import AppContent from './AppContent';

export const App: React.FC = () => (
  <BrowserRouter>
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  </BrowserRouter>
);

export default App;
