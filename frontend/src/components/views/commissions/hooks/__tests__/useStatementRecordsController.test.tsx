import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchStatementFinancialRecordsWithPagination } from '../../../../../api';
import type { FinancialRecord } from '../../../../../types';
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

const emptyPage: Awaited<ReturnType<typeof fetchStatementFinancialRecordsWithPagination>> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

describe('useStatementRecordsController', () => {
  beforeEach(() => {
    mockedFetchStatementFinancialRecordsWithPagination.mockReset();
  });

  it('cancels the previous statement when switching while its second page is loading', async () => {
    const oldSecondPage = deferred<typeof emptyPage>();
    const record: FinancialRecord = {
      id: 'record-1',
      paymentId: 'payment-1',
      amount: '100',
      statementId: 'statement-2',
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    };
    mockedFetchStatementFinancialRecordsWithPagination
      .mockResolvedValueOnce({ ...emptyPage, next: '?page=2' })
      .mockReturnValueOnce(oldSecondPage.promise)
      .mockResolvedValueOnce({ ...emptyPage, count: 1, results: [record] });

    const { result, rerender } = renderHook(
      ({ statementId }) =>
        useStatementRecordsController({
          selectedStatementId: statementId,
          viewMode: 'statements',
        }),
      { initialProps: { statementId: 'statement-1' } },
    );

    await waitFor(() => {
      expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
        'statement-1',
        { page: 2, page_size: 200, ordering: '-date,-created_at,id' },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    rerender({ statementId: 'statement-2' });
    await waitFor(() => {
      expect(result.current.statementRecords).toEqual([record]);
    });
    const oldSignal = mockedFetchStatementFinancialRecordsWithPagination.mock.calls[1][2]?.signal;
    expect(oldSignal?.aborted).toBe(true);

    await act(async () => {
      oldSecondPage.resolve({ ...emptyPage, next: '?page=3' });
    });

    expect(result.current.statementRecords).toEqual([record]);
    expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenCalledTimes(3);
    expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
      'statement-2',
      { page: 1, page_size: 200, ordering: '-date,-created_at,id' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('cycles comment ordering from the default date order to ascending, descending, and back', async () => {
    mockedFetchStatementFinancialRecordsWithPagination.mockResolvedValue(emptyPage);

    const { result } = renderHook(() =>
      useStatementRecordsController({
        selectedStatementId: 'statement-1',
        viewMode: 'statements',
      }),
    );

    await waitFor(() => {
      expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
        'statement-1',
        { page: 1, page_size: 200, ordering: '-date,-created_at,id' },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    act(() => {
      result.current.toggleCommentSort();
    });
    await waitFor(() => {
      expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
        'statement-1',
        { page: 1, page_size: 200, ordering: 'record_comment_sort,-date,-created_at,id' },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(result.current.getCommentSortLabel()).toBe('по возрастанию');
    expect(result.current.getCommentSortIndicator()).toBe('↑');

    act(() => {
      result.current.toggleCommentSort();
    });
    await waitFor(() => {
      expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
        'statement-1',
        { page: 1, page_size: 200, ordering: '-record_comment_sort,-date,-created_at,id' },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(result.current.getCommentSortLabel()).toBe('по убыванию');
    expect(result.current.getCommentSortIndicator()).toBe('↓');

    act(() => {
      result.current.toggleCommentSort();
    });
    await waitFor(() => {
      expect(mockedFetchStatementFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
        'statement-1',
        { page: 1, page_size: 200, ordering: '-date,-created_at,id' },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(result.current.getCommentSortLabel()).toBe('не сортируется');
    expect(result.current.getCommentSortIndicator()).toBe('↕');
  });
});
