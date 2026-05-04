import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Client, ClientDuplicateHint } from '../../../types';
import { ClientNameIndicators } from '../ClientNameIndicators';

const client = {
  id: 'client-1',
  name: 'ИВАНОВ ИВАН',
} as Client;

const baseHint: ClientDuplicateHint = {
  clientId: client.id,
  candidateCount: 0,
  maxScore: 0,
  confidence: 'low',
  reasons: [],
  needsNameNormalization: false,
  normalizedName: client.name,
};

describe('ClientNameIndicators', () => {
  it('renders duplicate indicator only when candidates exist', () => {
    const { rerender } = render(
      <ClientNameIndicators
        client={client}
        hint={baseHint}
        onFindSimilar={vi.fn()}
        onNormalizeName={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <ClientNameIndicators
        client={client}
        hint={{ ...baseHint, candidateCount: 2, maxScore: 90, confidence: 'high' }}
        onFindSimilar={vi.fn()}
        onNormalizeName={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: `Показать возможные дубли клиента ${client.name}` }),
    ).toBeInTheDocument();
  });

  it('opens duplicate candidates without triggering parent row click', () => {
    const onFindSimilar = vi.fn();
    const onRowClick = vi.fn();

    render(
      <div onClick={onRowClick}>
        <ClientNameIndicators
          client={client}
          hint={{ ...baseHint, candidateCount: 1, maxScore: 70, confidence: 'medium' }}
          onFindSimilar={onFindSimilar}
        />
      </div>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: `Показать возможные дубли клиента ${client.name}` }),
    );

    expect(onFindSimilar).toHaveBeenCalledWith(client);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('requests name normalization with preview value', () => {
    const onNormalizeName = vi.fn(async () => undefined);

    render(
      <ClientNameIndicators
        client={client}
        hint={{
          ...baseHint,
          needsNameNormalization: true,
          normalizedName: 'Иванов Иван',
        }}
        onNormalizeName={onNormalizeName}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: `Нормализовать ФИО клиента ${client.name}` }),
    );

    expect(onNormalizeName).toHaveBeenCalledWith(client, 'Иванов Иван');
  });
});
