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
    excludeClientSimilarity: vi.fn(),
    fetchClientMergeSession: vi.fn(),
    finalizeClientMerge: vi.fn(),
    fetchSimilarClients: vi.fn(),
    previewClientMerge: vi.fn(),
    retryClientMerge: vi.fn(),
    startClientMerge: vi.fn(),
    stepClientMerge: vi.fn(),
    updateClient: vi.fn(),
  };
});

import {
  excludeClientSimilarity,
  fetchSimilarClients,
  finalizeClientMerge,
  previewClientMerge,
  retryClientMerge,
  startClientMerge,
  stepClientMerge,
} from '../../../api';

const previewClientMergeMock = vi.mocked(previewClientMerge);
const excludeClientSimilarityMock = vi.mocked(excludeClientSimilarity);
const fetchSimilarClientsMock = vi.mocked(fetchSimilarClients);
const startClientMergeMock = vi.mocked(startClientMerge);
const stepClientMergeMock = vi.mocked(stepClientMerge);
const retryClientMergeMock = vi.mocked(retryClientMerge);
const finalizeClientMergeMock = vi.mocked(finalizeClientMerge);

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

const mergeSession = {
  id: 'session-1',
  status: 'ready_to_finalize' as const,
  targetClientId: targetClient.id,
  sourceClientIds: [sourceClient.id],
  movedItems: 0,
  totalItems: 0,
  retryable: false,
  failedItem: null,
  lastError: '',
  warnings: [],
  result: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

type ClientActionsOptions = Parameters<typeof useClientActions>[0];

const renderClientActions = (overrides: Partial<ClientActionsOptions> = {}) => {
  const props: ClientActionsOptions = {
    clients: [targetClient, sourceClient],
    setModal: vi.fn(),
    setIsSyncing: vi.fn(),
    setError: vi.fn(),
    updateAppData: vi.fn(),
    addNotification: vi.fn(),
    ...overrides,
  };

  return {
    ...renderHook(() => useClientActions(props)),
    props,
  };
};

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
    excludeClientSimilarityMock.mockReset();
    excludeClientSimilarityMock.mockResolvedValue({
      id: 'exclusion-1',
      firstClientId: sourceClient.id,
      secondClientId: targetClient.id,
      createdAt: '2026-01-01T00:00:00Z',
    });
    window.localStorage.clear();
    startClientMergeMock.mockReset();
    startClientMergeMock.mockResolvedValue(mergeSession);
    stepClientMergeMock.mockReset();
    retryClientMergeMock.mockReset();
    finalizeClientMergeMock.mockReset();
    finalizeClientMergeMock.mockResolvedValue({
      targetClient,
      mergedClientIds: [sourceClient.id],
      movedCounts: {},
      warnings: [],
      details: {},
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

  it('removes excluded candidate from similar clients modal', async () => {
    const addNotification = vi.fn();
    const updateAppData = vi.fn();
    fetchSimilarClientsMock.mockResolvedValue({
      targetClient,
      candidates: [
        {
          client: sourceClient,
          score: 85,
          confidence: 'high',
          reasons: ['same_phone'],
          matchedFields: { phone: true },
        },
      ],
      meta: {
        totalChecked: 1,
        returned: 1,
        scoringVersion: 'test',
      },
    });
    const { result } = renderClientActions({ addNotification, updateAppData });

    await act(async () => {
      await result.current.handleClientFindSimilarRequest(targetClient);
    });
    expect(result.current.similarCandidates).toHaveLength(1);

    await act(async () => {
      await result.current.handleExcludeClientSimilarity(sourceClient.id);
    });

    expect(excludeClientSimilarityMock).toHaveBeenCalledWith({
      targetClientId: targetClient.id,
      candidateClientId: sourceClient.id,
    });
    expect(result.current.similarCandidates).toHaveLength(0);
    expect(updateAppData).toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith('Совпадение скрыто', 'success', 3000);
  });

  it('shows merge warnings as non-blocking notifications', async () => {
    const addNotification = vi.fn();
    const { result } = renderClientActions({ addNotification });
    finalizeClientMergeMock.mockResolvedValueOnce({
      targetClient,
      mergedClientIds: [sourceClient.id],
      movedCounts: {},
      warnings: ['Содержимое Drive перенесено, но исходную папку не удалось удалить.'],
      details: {},
    });

    act(() => {
      result.current.handleClientMergeRequest(targetClient, [sourceClient.id]);
    });
    await act(async () => {
      await result.current.handleClientMergePreview();
    });
    await act(async () => {
      await result.current.handleMergeSubmit();
    });

    expect(addNotification).toHaveBeenCalledWith('Клиенты объединены', 'success', 4000);
    expect(addNotification).toHaveBeenCalledWith(
      'Содержимое Drive перенесено, но исходную папку не удалось удалить.',
      'warning',
      8000,
    );
  });

  it('stops on retryable drive failure and continues the same session on retry', async () => {
    const addNotification = vi.fn();
    const { result } = renderClientActions({ addNotification });
    startClientMergeMock.mockResolvedValueOnce({
      ...mergeSession,
      status: 'moving_drive',
      movedItems: 0,
      totalItems: 1,
    });
    stepClientMergeMock.mockResolvedValueOnce({
      ...mergeSession,
      status: 'failed',
      movedItems: 0,
      totalItems: 1,
      retryable: true,
      lastError: 'Google Drive не ответил.',
    });
    retryClientMergeMock.mockResolvedValueOnce({
      ...mergeSession,
      status: 'ready_to_finalize',
      movedItems: 1,
      totalItems: 1,
      retryable: false,
      lastError: '',
    });

    act(() => {
      result.current.handleClientMergeRequest(targetClient, [sourceClient.id]);
    });
    await act(async () => {
      await result.current.handleClientMergePreview();
    });
    await act(async () => {
      await result.current.handleMergeSubmit();
    });

    expect(result.current.clientMergeSession?.status).toBe('failed');
    expect(result.current.mergeError).toBe('Google Drive не ответил.');
    expect(finalizeClientMergeMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleClientMergeRetry();
    });

    expect(retryClientMergeMock).toHaveBeenCalledWith('session-1');
    expect(finalizeClientMergeMock).toHaveBeenCalledWith('session-1');
    expect(addNotification).toHaveBeenCalledWith('Клиенты объединены', 'success', 4000);
  });
});
