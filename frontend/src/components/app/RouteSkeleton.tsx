import React from 'react';

export const RouteSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="app-panel p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-1/3 rounded bg-slate-200" />
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="h-4 w-1/2 rounded bg-slate-200" />
      </div>
    </div>
    <div className="app-panel p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-5/6 rounded bg-slate-200" />
        <div className="h-4 w-2/3 rounded bg-slate-200" />
      </div>
    </div>
  </div>
);
