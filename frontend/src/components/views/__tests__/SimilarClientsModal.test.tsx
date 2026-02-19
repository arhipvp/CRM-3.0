import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Client, ClientSimilarityCandidate } from '../../../types';
import { SimilarClientsModal } from '../SimilarClientsModal';

const targetClient: Client = {
  id: 'target-1',
  name: 'Иванов Иван Иванович',
  phone: '+79991112233',
  email: 'target@example.com',
  birthDate: '1990-01-01',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const candidate: ClientSimilarityCandidate = {
  client: {
    id: 'candidate-1',
    name: 'Петров Иван Иванович',
    phone: '+79991112233',
    email: 'candidate@example.com',
    birthDate: '1990-01-01',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  score: 85,
  confidence: 'high',
  reasons: ['same_phone', 'name_patronymic_birthdate_match'],
  matchedFields: {
    phone: true,
    birth_date: true,
  },
};

describe('SimilarClientsModal', () => {
  it('renders candidates with reasons and handles merge action', () => {
    const onMerge = vi.fn();
    render(
      <SimilarClientsModal
        isOpen
        targetClient={targetClient}
        candidates={[candidate]}
        isLoading={false}
        error={null}
        onClose={() => undefined}
        onMerge={onMerge}
      />,
    );

    expect(screen.getByText(/Совпадает телефон/)).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));
    expect(onMerge).toHaveBeenCalledWith('candidate-1');
  });
});
