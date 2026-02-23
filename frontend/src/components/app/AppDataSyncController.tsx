import React from 'react';

type AppDataSyncControllerProps = {
  isSyncing: boolean;
};

export const AppDataSyncController: React.FC<AppDataSyncControllerProps> = ({ isSyncing }) => {
  if (!isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="app-panel flex items-center gap-3 px-4 py-3 shadow-md">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
        <span className="text-sm font-semibold text-slate-700">Синхронизация...</span>
      </div>
    </div>
  );
};
