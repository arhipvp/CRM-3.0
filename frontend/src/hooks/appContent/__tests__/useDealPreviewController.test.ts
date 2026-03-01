import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDealPreviewController } from '../useDealPreviewController';

describe('useDealPreviewController', () => {
  it('выбирает сделку и сбрасывает флаг очистки фокуса', () => {
    const { result } = renderHook(() => useDealPreviewController());

    act(() => {
      result.current.clearSelectedDealFocus();
    });
    expect(result.current.selectedDealId).toBeNull();
    expect(result.current.isDealFocusCleared).toBe(true);

    act(() => {
      result.current.selectDealById('deal-1');
    });
    expect(result.current.selectedDealId).toBe('deal-1');
    expect(result.current.isDealFocusCleared).toBe(false);
  });

  it('открывает и закрывает preview сделки', () => {
    const { result } = renderHook(() => useDealPreviewController());

    act(() => {
      result.current.handleOpenDealPreview('deal-42');
    });

    expect(result.current.previewDealId).toBe('deal-42');
    expect(result.current.selectedDealId).toBe('deal-42');

    act(() => {
      result.current.handleCloseDealPreview();
    });

    expect(result.current.previewDealId).toBeNull();
  });

  it('формирует dealRowFocusRequest c растущим nonce', () => {
    const { result } = renderHook(() => useDealPreviewController());

    act(() => {
      result.current.requestDealRowFocus('deal-a');
    });
    expect(result.current.dealRowFocusRequest).toEqual({ dealId: 'deal-a', nonce: 1 });

    act(() => {
      result.current.requestDealRowFocus('deal-b');
    });
    expect(result.current.dealRowFocusRequest).toEqual({ dealId: 'deal-b', nonce: 2 });
  });

  it('позволяет внешнему handler блокировать выбор сделки', () => {
    const { result } = renderHook(() => useDealPreviewController());

    const handleSelectDeal = (dealId: string, isBlocked: boolean) => {
      if (isBlocked) {
        return;
      }
      result.current.selectDealById(dealId);
    };

    act(() => {
      handleSelectDeal('deal-1', true);
    });
    expect(result.current.selectedDealId).toBeNull();

    act(() => {
      handleSelectDeal('deal-2', false);
    });
    expect(result.current.selectedDealId).toBe('deal-2');
  });
});
