import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { createElement, type PropsWithChildren } from 'react';

import { useDealPreviewController } from '../useDealPreviewController';

describe('useDealPreviewController', () => {
  const wrapper = ({ children }: PropsWithChildren) => createElement(MemoryRouter, null, children);

  it('выбирает сделку и сбрасывает флаг очистки фокуса', () => {
    const { result } = renderHook(() => useDealPreviewController(), { wrapper });

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

  it('снимает фокус из deep link и удаляет только параметры сделки из URL', async () => {
    const FocusHarness = () => {
      const controller = useDealPreviewController();
      const location = useLocation();
      return createElement(
        'div',
        null,
        createElement(
          'button',
          { type: 'button', onClick: () => controller.clearSelectedDealFocus() },
          'Снять фокус',
        ),
        createElement(
          'output',
          { 'data-testid': 'selected-deal' },
          controller.selectedDealId ?? 'none',
        ),
        createElement(
          'output',
          { 'data-testid': 'location' },
          `${location.pathname}${location.search}`,
        ),
        createElement(
          'div',
          null,
          controller.selectedDealId ? 'Карточка сделки' : 'Выберите сделку',
        ),
      );
    };

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/deals?dealId=deal-1&tab=policies&filter=open'] },
        createElement(FocusHarness),
      ),
    );

    await waitFor(() => {
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('deal-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Снять фокус' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-deal')).toHaveTextContent('none');
      expect(screen.getByText('Выберите сделку')).toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent('/deals?filter=open');
    });
  });

  it('не очищает фокус новой сделки по завершении операции над прежней', () => {
    const { result } = renderHook(() => useDealPreviewController(), { wrapper });

    act(() => {
      result.current.selectDealById('deal-1');
      result.current.selectDealById('deal-2');
      result.current.clearSelectedDealFocus('deal-1');
    });

    expect(result.current.selectedDealId).toBe('deal-2');
    expect(result.current.isDealFocusCleared).toBe(false);
  });

  it('открывает и закрывает preview сделки', () => {
    const { result } = renderHook(() => useDealPreviewController(), { wrapper });

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
    const { result } = renderHook(() => useDealPreviewController(), { wrapper });

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
    const { result } = renderHook(() => useDealPreviewController(), { wrapper });

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
