import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';

import { CommissionsView } from '../CommissionsView';

describe('CommissionsView', () => {
  it('shows a pending statements state while finance snapshot is not yet consistent', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CommissionsView
          payments={[]}
          financialRecords={[
            {
              id: 'record-1',
              paymentId: 'payment-1',
              amount: '1000',
              createdAt: '2026-03-06T10:00:00Z',
              updatedAt: '2026-03-06T10:00:00Z',
            },
          ]}
          policies={[]}
          statements={[]}
          hasFinanceSnapshotLoaded={false}
          isBackgroundRefreshingFinance
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Ведомости' }));
    expect(screen.getAllByText('Загружаем согласованное состояние ведомостей...')).toHaveLength(2);
    expect(screen.queryByText('Ведомостей пока нет')).not.toBeInTheDocument();
  });
});
