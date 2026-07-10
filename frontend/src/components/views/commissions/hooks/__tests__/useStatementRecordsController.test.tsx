import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchStatementFinancialRecordsWithPagination } from '../../../../../api';
import { useStatementRecordsController } from '../useStatementRecordsController';

vi.mock('../../../../../api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../api')>('../../../../../api');
  return {
    ...actual,
    fetchStatementFinancialRecordsWithPagination: vi.fn(),
  };
});

const mockedFetchStatementFinancialRecordsWithPagination = vi.mocked(
  fetchStatementFinancialRecordsWithPagination,
);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const emptyPage = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

describe('useStatementRecordsController', () => {
  beforeEach(() => {
    mockedFetchStatementFinancialRecordsWithPagination.mockReset();
  });

  it('restarts from the first page when the selected statement changes during loading', async () => {
    const firstLoad = deferred<typeof emptyPage>();
    const secondLoad = deferred<typeof emptyPage>();
    mockedFetchStatementFinancialRecordsWithPagination
      .mockReturnValueOnce(firstLoad.promise as never)
      .mockReturnValueOnce(secondLoad.promise as never)
      .mockResolvedValueOnce(emptyPage as never);

    const { result, rerender } = renderHook(
      ({ statementId }) =>
        useStatementRecordsController({
          selectedStatementId: statementId,
          viewMode: 'statements',
        }),
      { initialProps: { statementId: 'statement-1' } },
    );

    await waitFor(() => {
      expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenCalledTimes(1);
    });

    rerender({ statementId: 'statement-2' });
    await waitFor(() => {
      expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      await result.current.loadStatementRecords('more');
    });

    expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
      'statement-2',
      { page: 1, page_size: 100 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
