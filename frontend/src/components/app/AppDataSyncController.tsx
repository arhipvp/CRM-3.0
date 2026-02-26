import React from 'react';

import type { LastRefreshAtByResource, LastRefreshErrorByResource } from '../../hooks/useAppData';

type AppDataSyncControllerProps = {
  isMutationSyncing: boolean;
  isBackgroundRefreshingAny: boolean;
  lastRefreshAtByResource: LastRefreshAtByResource;
  lastRefreshErrorByResource: LastRefreshErrorByResource;
};

const RESOURCE_LABELS: Record<keyof LastRefreshErrorByResource, string> = {
  deals: '\u0441\u0434\u0435\u043b\u043a\u0438',
  policies: '\u043f\u043e\u043b\u0438\u0441\u044b',
  tasks: '\u0437\u0430\u0434\u0430\u0447\u0438',
  finance: '\u0444\u0438\u043d\u0430\u043d\u0441\u044b',
};

const getFreshnessLabel = (lastRefreshAtByResource: LastRefreshAtByResource): string | null => {
  const timestamps = Object.values(lastRefreshAtByResource).filter(
    (value): value is number => typeof value === 'number',
  );
  if (!timestamps.length) {
    return null;
  }

  const latest = Math.max(...timestamps);
  const diffSeconds = Math.max(0, Math.round((Date.now() - latest) / 1000));
  if (diffSeconds < 3) {
    return '\u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e';
  }
  return `\u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e ${diffSeconds} \u0441\u0435\u043a \u043d\u0430\u0437\u0430\u0434`;
};

const getErrorLabel = (lastRefreshErrorByResource: LastRefreshErrorByResource): string | null => {
  const failedResources = Object.entries(lastRefreshErrorByResource)
    .filter(([, error]) => Boolean(error))
    .map(([resource]) => RESOURCE_LABELS[resource as keyof LastRefreshErrorByResource]);
  if (!failedResources.length) {
    return null;
  }
  return `\u043e\u0448\u0438\u0431\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f: ${failedResources.join(', ')}`;
};

export const AppDataSyncController: React.FC<AppDataSyncControllerProps> = ({
  isMutationSyncing,
  isBackgroundRefreshingAny,
  lastRefreshAtByResource,
  lastRefreshErrorByResource,
}) => {
  const freshnessLabel = getFreshnessLabel(lastRefreshAtByResource);
  const errorLabel = getErrorLabel(lastRefreshErrorByResource);

  if (!isMutationSyncing && !isBackgroundRefreshingAny && !errorLabel) {
    return null;
  }

  const title = isMutationSyncing
    ? '\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f...'
    : isBackgroundRefreshingAny
      ? '\u041e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u043c \u0434\u0430\u043d\u043d\u044b\u0435...'
      : '\u0415\u0441\u0442\u044c \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u044b \u0441 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435\u043c';
  const subtitle = errorLabel ?? freshnessLabel ?? null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={[
          'app-panel flex items-start gap-3 px-4 py-3 shadow-md border-l-4',
          errorLabel ? 'border-l-rose-500' : 'border-l-sky-500',
        ].join(' ')}
      >
        <div
          className={[
            'mt-0.5 h-4 w-4 rounded-full border-2',
            isMutationSyncing || isBackgroundRefreshingAny
              ? 'animate-spin border-slate-300 border-t-sky-600'
              : 'border-rose-300 bg-rose-100',
          ].join(' ')}
        />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};
