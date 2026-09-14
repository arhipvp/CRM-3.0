import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Deal } from '../../../types';
import { AppDealPreviewModal } from '../AppDealPreviewModal';
import { DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY } from '../useDealPreviewModalSize';

vi.mock('../../views/dealsView/DealDetailsPanel', () => ({
  DealDetailsPanel: () => <div>Содержимое предпросмотра</div>,
}));

const defaultMatchMedia = window.matchMedia;

const setViewport = (width: number, height: number, isDesktop = true) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: isDesktop,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
};

const renderPreview = () =>
  render(
    <AppDealPreviewModal
      isOpen
      previewDeal={{ id: 'deal-1', title: 'Тестовая сделка' } as Deal}
      previewClient={null}
      onClose={vi.fn()}
      onOpenFull={vi.fn()}
      panelProps={{} as never}
    />,
  );

describe('AppDealPreviewModal', () => {
  afterEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: defaultMatchMedia });
  });

  it('uses 80% of the desktop viewport by default and has one scrollable body', () => {
    setViewport(1200, 900);
    renderPreview();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ width: '960px', height: '720px' });
    expect(
      screen.getByRole('button', { name: 'Изменить размер предпросмотра сделки' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Содержимое предпросмотра').parentElement?.parentElement?.parentElement
        ?.className,
    ).toContain('overflow-y-auto');
    expect(screen.getByText('Содержимое предпросмотра').parentElement?.className).not.toContain(
      'max-h-[70vh]',
    );
  });

  it('restores a valid stored size and ignores an invalid value', async () => {
    setViewport(1200, 900);
    window.localStorage.setItem(DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY, '{"width":1000,"height":700}');
    const { unmount } = renderPreview();

    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveStyle({ width: '1000px', height: '700px' }),
    );
    unmount();

    window.localStorage.setItem(DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY, 'not-a-size');
    renderPreview();
    expect(screen.getByRole('dialog')).toHaveStyle({ width: '960px', height: '720px' });
  });

  it('resizes within viewport bounds and persists the new size', () => {
    setViewport(1200, 900);
    renderPreview();

    const dialog = screen.getByRole('dialog');
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 900,
      height: 650,
      top: 0,
      right: 900,
      bottom: 650,
      left: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Изменить размер предпросмотра сделки' }),
      {
        clientX: 300,
        clientY: 300,
        pointerId: 1,
      },
    );
    fireEvent.pointerMove(window, { clientX: 800, clientY: 800 });
    fireEvent.pointerUp(window);

    expect(dialog).toHaveStyle({ width: '1168px', height: '868px' });
    expect(window.localStorage.getItem(DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY)).toBe(
      '{"width":1168,"height":868}',
    );

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Изменить размер предпросмотра сделки' }),
      {
        clientX: 300,
        clientY: 300,
        pointerId: 2,
      },
    );
    fireEvent.pointerMove(window, { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(window);

    expect(dialog).toHaveStyle({ width: '720px', height: '560px' });
  });

  it('normalizes the saved size when the desktop viewport becomes smaller', () => {
    setViewport(1200, 900);
    renderPreview();

    setViewport(1000, 700);
    fireEvent(window, new Event('resize'));

    expect(screen.getByRole('dialog')).toHaveStyle({ width: '960px', height: '668px' });
    expect(window.localStorage.getItem(DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY)).toBe(
      '{"width":960,"height":668}',
    );
  });

  it('resets the size to the desktop default', () => {
    setViewport(1200, 900);
    window.localStorage.setItem(DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY, '{"width":800,"height":600}');
    renderPreview();

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить размер предпросмотра сделки' }));

    expect(screen.getByRole('dialog')).toHaveStyle({ width: '960px', height: '720px' });
    expect(window.localStorage.getItem(DEAL_PREVIEW_MODAL_SIZE_STORAGE_KEY)).toBe(
      '{"width":960,"height":720}',
    );
  });

  it('disables manual resizing on mobile', () => {
    setViewport(600, 900, false);
    renderPreview();

    expect(
      screen.queryByRole('button', { name: 'Изменить размер предпросмотра сделки' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Сбросить размер предпросмотра сделки' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveStyle('width: 480px');
  });
});
