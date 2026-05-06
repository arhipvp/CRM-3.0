import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClientActions } from '../useClientActions';
import type { Client } from '../../../types';

vi.mock('../../../api', () => {
  class APIError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }

  return {
    APIError,
    createClient: vi.fn(),
    deleteClient: vi.fn(),
    fetchSimilarClients: vi.fn(),
    mergeClients: vi.fn(),
    previewClientMerge: vi.fn(),
    updateClient: vi.fn(),
  };
});

import { fetchSimilarClients, previewClientMerge } from '../../../api';

const previewClientMergeMock = vi.mocked(previewClientMerge);
const fetchSimilarClientsMock = vi.mocked(fetchSimilarClients);

const createClient = (overrides: Partial<Client>): Client => ({
  id: 'client-1',
  name: 'Зотова Марина',
  phone: '',
  email: null,
  birthDate: null,
  notes: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const targetClient = createClient({
  id: 'target-client',
  name: 'Зотова Марина',
  phone: '+7 926 569-34-60',
  email: 'target@example.com',
  notes: '',
});

const sourceClient = createClient({
  id: 'source-client',
  name: 'Зотова Марина Николаевна',
  phone: '+79260001122',
  email: 'source@example.com',
});

const previewResponse = {
  targetClientId: targetClient.id,
  sourceClientIds: [sourceClient.id],
  includeDeleted: true,
  previewSnapshotId: 'preview-1',
  movedCounts: {},
  items: {},
  canonicalProfile: {
    name: 'Зотова Марина Николаевна',
    phone: '+7 926 569-34-60',
    email: 'target@example.com',
    notes:
      'Контакты из объединённых клиентов:\n- Телефон: +79260001122 (Зотова Марина Николаевна)\n- Email: source@example.com (Зотова Марина Николаевна)',
    candidates: {
      names: ['Зотова Марина', 'Зотова Марина Николаевна'],
      phones: ['+7 926 569-34-60', '+79260001122'],
      emails: ['target@example.com', 'source@example.com'],
    },
  },
  drivePlan: [],
  warnings: [],
};

const renderClientActions = () =>
  renderHook(() =>
    useClientActions({
      clients: [targetClient, sourceClient],
      setModal: vi.fn(),
      setIsSyncing: vi.fn(),
      setError: vi.fn(),
      updateAppData: vi.fn(),
      addNotification: vi.fn(),
    }),
  );

describe('useClientActions', () => {
  beforeEach(() => {
    previewClientMergeMock.mockReset();
    previewClientMergeMock.mockResolvedValue(previewResponse);
    fetchSimilarClientsMock.mockReset();
    fetchSimilarClientsMock.mockResolvedValue({
      targetClient,
      candidates: [],
      meta: {
        totalChecked: 0,
        returned: 0,
        scoringVersion: 'test',
      },
    });
  });

  it('fills merge final fields from preview canonical profile', async () => {
    const { result } = renderClientActions();

    act(() => {
      result.current.handleClientMergeRequest(targetClient, [sourceClient.id]);
    });
    await act(async () => {
      await result.current.handleClientMergePreview();
    });

    expect(result.current.clientMergeFieldOverrides).toEqual({
      name: 'Зотова Марина Николаевна',
      phone: '+7 926 569-34-60',
      email: 'target@example.com',
      notes: previewResponse.canonicalProfile.notes,
    });
  });

  it('uses the same preview defaults when merging from similar clients', async () => {
    const { result } = renderClientActions();

    await act(async () => {
      await result.current.handleClientFindSimilarRequest(targetClient);
    });
    await act(async () => {
      await result.current.handleMergeFromSimilar(sourceClient.id);
    });

    expect(previewClientMergeMock).toHaveBeenCalledWith({
      targetClientId: targetClient.id,
      sourceClientIds: [sourceClient.id],
      includeDeleted: true,
    });
    expect(result.current.clientMergeFieldOverrides.name).toBe('Зотова Марина Николаевна');
    expect(result.current.clientMergeFieldOverrides.notes).toContain('source@example.com');
  });
});
