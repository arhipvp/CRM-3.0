import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchStatementDriveFiles } from '../../../../../api';
import type { Statement } from '../../../../../types';
import { useStatementDriveManager } from '../useStatementDriveManager';

vi.mock('../../../../../api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../api')>('../../../../../api');
  return {
    ...actual,
    fetchStatementDriveFiles: vi.fn(),
  };
});

const mockedFetchStatementDriveFiles = vi.mocked(fetchStatementDriveFiles);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const buildStatement = (id: string, name: string): Statement => ({
  id,
  name,
  statementType: 'income',
  status: 'draft',
  counterparty: null,
  paidAt: null,
  comment: null,
  createdBy: null,
  driveFolderId: null,
  recordsCount: 0,
  totalAmount: '0',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
});

describe('useStatementDriveManager', () => {
  beforeEach(() => {
    mockedFetchStatementDriveFiles.mockReset();
  });

  it('keeps files from the latest selected statement', async () => {
    const firstRequest = deferred<{
      files: Array<{ id: string; name: string; isFolder: boolean }>;
      folderId: string | null;
    }>();
    const secondRequest = deferred<{
      files: Array<{ id: string; name: string; isFolder: boolean }>;
      folderId: string | null;
    }>();

    mockedFetchStatementDriveFiles
      .mockReturnValueOnce(firstRequest.promise as never)
      .mockReturnValueOnce(secondRequest.promise as never);

    const { result, rerender } = renderHook(
      ({ selectedStatement }) =>
        useStatementDriveManager({
          selectedStatement,
          statementTab: 'files',
          viewMode: 'statements',
          confirm: vi.fn().mockResolvedValue(true),
        }),
      {
        initialProps: {
          selectedStatement: buildStatement('statement-1', 'Первая ведомость'),
        },
      },
    );

    rerender({ selectedStatement: buildStatement('statement-2', 'Вторая ведомость') });

    await act(async () => {
      secondRequest.resolve({
        files: [{ id: 'new-file', name: 'new.xlsx', isFolder: false }],
        folderId: 'folder-2',
      });
      await secondRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.sortedStatementDriveFiles.map((file) => file.id)).toEqual(['new-file']);
    });

    await act(async () => {
      firstRequest.resolve({
        files: [{ id: 'old-file', name: 'old.xlsx', isFolder: false }],
        folderId: 'folder-1',
      });
      await firstRequest.promise;
    });

    expect(result.current.sortedStatementDriveFiles.map((file) => file.id)).toEqual(['new-file']);
  });
});
