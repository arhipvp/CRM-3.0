import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppDataSyncController } from '../AppDataSyncController';

const lastRefreshAtByResource = {
  deals: null,
  policies: null,
  tasks: null,
  finance: null,
} as const;

describe('AppDataSyncController', () => {
  it('does not render when only background refresh is active without errors', () => {
    render(
      <AppDataSyncController
        isBackgroundRefreshingAny
        lastRefreshAtByResource={lastRefreshAtByResource}
        lastRefreshErrorByResource={{
          deals: null,
          policies: null,
          tasks: null,
          finance: null,
        }}
      />,
    );

    expect(screen.queryByText('Сохраняем изменения...')).not.toBeInTheDocument();
    expect(screen.queryByText('Есть проблемы с обновлением')).not.toBeInTheDocument();
  });

  it('renders when mutation sync is active', () => {
    render(
      <AppDataSyncController
        isMutationSyncing
        lastRefreshAtByResource={lastRefreshAtByResource}
        lastRefreshErrorByResource={{
          deals: null,
          policies: null,
          tasks: null,
          finance: null,
        }}
      />,
    );

    expect(screen.getByText('Сохраняем изменения...')).toBeInTheDocument();
  });

  it('renders error state when background refresh has errors', () => {
    render(
      <AppDataSyncController
        lastRefreshAtByResource={lastRefreshAtByResource}
        lastRefreshErrorByResource={{
          deals: 'Network error',
          policies: null,
          tasks: null,
          finance: null,
        }}
      />,
    );

    expect(screen.getByText('Есть проблемы с обновлением')).toBeInTheDocument();
    expect(screen.getByText('ошибка обновления: сделки')).toBeInTheDocument();
  });
});
