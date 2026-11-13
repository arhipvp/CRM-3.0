import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ActivityTimeline } from '../ActivityTimeline';
import type { ActivityLog } from '../../types';

const activity: ActivityLog = {
  id: 'audit-1',
  deal: 'deal-1',
  actionType: 'custom',
  actionTypeDisplay: 'Редактирование',
  description: 'Обновлена заметка',
  createdAt: '2026-11-13T10:00:00Z',
};

describe('ActivityTimeline author', () => {
  it('shows the saved full name and login even without a user reference', () => {
    render(
      <ActivityTimeline
        activities={[
          { ...activity, user: null, userDisplayName: 'Иван Петров', userUsername: 'ivan' },
        ]}
      />,
    );

    expect(screen.getByText('Иван Петров (@ivan)')).toBeInTheDocument();
  });

  it('falls back to the login for legacy entries', () => {
    render(<ActivityTimeline activities={[{ ...activity, userUsername: 'ivan' }]} />);

    expect(screen.getByText('ivan')).toBeInTheDocument();
  });

  it('shows the saved name when the login is unavailable', () => {
    render(<ActivityTimeline activities={[{ ...activity, userDisplayName: 'Иван Петров' }]} />);

    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
  });

  it('marks unknown authors without identifying them as system actions', () => {
    render(<ActivityTimeline activities={[{ ...activity, userUsername: ' ' }]} />);

    expect(screen.getByText('Автор не указан')).toBeInTheDocument();
  });
});
