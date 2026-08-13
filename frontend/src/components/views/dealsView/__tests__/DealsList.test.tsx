import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Deal, User } from '../../../../types';
import { DealsList } from '../DealsList';

const createDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'deal-1',
  title: 'Deal 1',
  clientId: 'client-1',
  status: 'open',
  createdAt: '2026-01-01T00:00:00Z',
  quotes: [],
  documents: [],
  ...overrides,
});

const focusMock = vi.fn();
const scrollIntoViewMock = vi.fn();
const DEALS_LIST_HEIGHT_STORAGE_KEY = 'crm:deals:list-height';

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const mockTableHeight = (element: HTMLElement, height: number) => {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom: height,
    height,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
};

const renderDealsList = (params?: {
  selectedDeal?: Deal | null;
  sortedDeals?: Deal[];
  dealRowFocusRequest?: { dealId: string; nonce: number } | null;
  dealSearch?: string;
  onDealSearchSubmit?: (value?: string) => void;
  onRefreshDealsList?: () => Promise<void>;
  isRefreshingDealsList?: boolean;
  onSelectDeal?: (dealId: string) => void;
  onPinDeal?: (dealId: string) => Promise<void>;
  onUnpinDeal?: (dealId: string) => Promise<void>;
  currentUser?: User | null;
}) => {
  const selectedDeal = params?.selectedDeal ?? createDeal();
  const sortedDeals = params?.sortedDeals ?? [selectedDeal];

  return render(
    <DealsList
      sortedDeals={sortedDeals}
      selectedDeal={selectedDeal}
      dealRowFocusRequest={params?.dealRowFocusRequest ?? null}
      dealSearch={params?.dealSearch ?? ''}
      onDealSearchChange={vi.fn()}
      onDealSearchSubmit={params?.onDealSearchSubmit ?? vi.fn()}
      onRefreshDealsList={params?.onRefreshDealsList}
      dealExecutorFilter="all"
      onDealExecutorFilterChange={vi.fn()}
      dealShowDeleted={false}
      onDealShowDeletedChange={vi.fn()}
      dealShowClosed={true}
      onDealShowClosedChange={vi.fn()}
      dealOrdering={undefined}
      onDealOrderingChange={vi.fn()}
      users={[]}
      dealsHasMore={false}
      dealsTotalCount={sortedDeals.length}
      isLoadingMoreDeals={false}
      isRefreshingDealsList={params?.isRefreshingDealsList ?? false}
      onLoadMoreDeals={vi.fn().mockResolvedValue(undefined)}
      onSelectDeal={params?.onSelectDeal ?? vi.fn()}
      onPinDeal={params?.onPinDeal ?? vi.fn().mockResolvedValue(undefined)}
      onUnpinDeal={params?.onUnpinDeal ?? vi.fn().mockResolvedValue(undefined)}
      currentUser={params?.currentUser ?? null}
    />,
  );
};

describe('DealsList dealRowFocusRequest', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockMatchMedia(true);
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
      writable: true,
    });
    focusMock.mockClear();
    scrollIntoViewMock.mockClear();
    Object.defineProperty(HTMLElement.prototype, 'focus', {
      configurable: true,
      value: focusMock,
      writable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
      writable: true,
    });
  });

  it('focuses selected row when request dealId matches selected deal', () => {
    const selectedDeal = createDeal({ id: 'deal-1' });

    renderDealsList({
      selectedDeal,
      sortedDeals: [selectedDeal],
      dealRowFocusRequest: { dealId: 'deal-1', nonce: 1 },
    });

    expect(focusMock).toHaveBeenCalledTimes(1);
    expect(focusMock).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('does not focus row when request dealId does not match selected deal', () => {
    const selectedDeal = createDeal({ id: 'deal-1' });

    renderDealsList({
      selectedDeal,
      sortedDeals: [selectedDeal],
      dealRowFocusRequest: { dealId: 'deal-2', nonce: 1 },
    });

    expect(focusMock).not.toHaveBeenCalled();
  });

  it('does not focus row again on rerender with the same nonce', () => {
    const selectedDeal = createDeal({ id: 'deal-1' });

    const view = renderDealsList({
      selectedDeal,
      sortedDeals: [selectedDeal],
      dealRowFocusRequest: { dealId: 'deal-1', nonce: 7 },
    });

    expect(focusMock).toHaveBeenCalledTimes(1);

    view.rerender(
      <DealsList
        sortedDeals={[selectedDeal]}
        selectedDeal={selectedDeal}
        dealRowFocusRequest={{ dealId: 'deal-1', nonce: 7 }}
        dealSearch=""
        onDealSearchChange={vi.fn()}
        onDealSearchSubmit={vi.fn()}
        dealExecutorFilter="all"
        onDealExecutorFilterChange={vi.fn()}
        dealShowDeleted={false}
        onDealShowDeletedChange={vi.fn()}
        dealShowClosed={true}
        onDealShowClosedChange={vi.fn()}
        dealOrdering={undefined}
        onDealOrderingChange={vi.fn()}
        users={[]}
        dealsHasMore={false}
        dealsTotalCount={1}
        isLoadingMoreDeals={false}
        isRefreshingDealsList={false}
        onLoadMoreDeals={vi.fn().mockResolvedValue(undefined)}
        onSelectDeal={vi.fn()}
        onPinDeal={vi.fn().mockResolvedValue(undefined)}
        onUnpinDeal={vi.fn().mockResolvedValue(undefined)}
        currentUser={null}
      />,
    );

    expect(focusMock).toHaveBeenCalledTimes(1);
  });

  it('submits search on form submit', () => {
    const onDealSearchSubmit = vi.fn();

    renderDealsList({ onDealSearchSubmit });

    const searchInput = screen.getByLabelText('Поиск по сделкам');
    fireEvent.submit(searchInput.closest('form') as HTMLFormElement);

    expect(onDealSearchSubmit).toHaveBeenCalledTimes(1);
  });

  it('applies client search immediately by deals count click', () => {
    const onDealSearchSubmit = vi.fn();
    const selectedDeal = createDeal({
      id: 'deal-with-client',
      clientName: 'Старостин Александр Викторович',
      clientActiveDealsCount: 2,
    });

    renderDealsList({
      selectedDeal,
      sortedDeals: [selectedDeal],
      onDealSearchSubmit,
    });

    const counter = screen.getByRole('button', {
      name: 'Показать все сделки клиента Старостин Александр Викторович',
    });
    expect(counter).toHaveTextContent('2');
    expect(counter).not.toHaveTextContent('(2)');
    fireEvent.click(counter);

    expect(onDealSearchSubmit).toHaveBeenCalledTimes(1);
    expect(onDealSearchSubmit).toHaveBeenCalledWith('Старостин Александр Викторович');
  });

  it('pins an available seller deal and renders the pin icon button', () => {
    const onPinDeal = vi.fn().mockResolvedValue(undefined);
    const currentUser = { id: 'seller-1', username: 'seller', roles: [] };
    const deal = createDeal({ id: 'deal-to-pin', seller: currentUser.id, isPinned: false });

    renderDealsList({
      selectedDeal: deal,
      sortedDeals: [deal],
      currentUser,
      onPinDeal,
    });

    const pinButton = screen.getByRole('button', { name: 'Закрепить сделку' });
    expect(pinButton).toHaveAttribute('title', 'Закрепить');
    expect(pinButton.querySelector('svg')).toBeInTheDocument();
    fireEvent.click(pinButton);

    expect(onPinDeal).toHaveBeenCalledWith('deal-to-pin');
  });

  it('unpins an available pinned deal and renders a distinct icon', () => {
    const onUnpinDeal = vi.fn().mockResolvedValue(undefined);
    const currentUser = { id: 'admin-1', username: 'admin', roles: ['Admin'] };
    const unpinnedDeal = createDeal({ id: 'deal-to-unpin', seller: 'seller-1', isPinned: false });
    const view = renderDealsList({
      selectedDeal: unpinnedDeal,
      sortedDeals: [unpinnedDeal],
      currentUser,
      onUnpinDeal,
    });
    const pinMarkup = screen.getByRole('button', { name: 'Закрепить сделку' }).innerHTML;
    const pinnedDeal = { ...unpinnedDeal, isPinned: true };

    view.rerender(
      <DealsList
        sortedDeals={[pinnedDeal]}
        selectedDeal={pinnedDeal}
        dealSearch=""
        onDealSearchChange={vi.fn()}
        onDealSearchSubmit={vi.fn()}
        dealExecutorFilter="all"
        onDealExecutorFilterChange={vi.fn()}
        dealShowDeleted={false}
        onDealShowDeletedChange={vi.fn()}
        dealShowClosed={true}
        onDealShowClosedChange={vi.fn()}
        dealOrdering={undefined}
        onDealOrderingChange={vi.fn()}
        users={[]}
        dealsHasMore={false}
        dealsTotalCount={1}
        isLoadingMoreDeals={false}
        onLoadMoreDeals={vi.fn().mockResolvedValue(undefined)}
        onSelectDeal={vi.fn()}
        onPinDeal={vi.fn().mockResolvedValue(undefined)}
        onUnpinDeal={onUnpinDeal}
        currentUser={currentUser}
      />,
    );

    const unpinButton = screen.getByRole('button', { name: 'Открепить сделку' });
    expect(unpinButton).toHaveAttribute('title', 'Открепить');
    expect(unpinButton.innerHTML).not.toBe(pinMarkup);
    fireEvent.click(unpinButton);

    expect(onUnpinDeal).toHaveBeenCalledWith('deal-to-unpin');
  });

  it('does not render pin controls without permission', () => {
    const deal = createDeal({ seller: 'seller-1' });

    renderDealsList({
      selectedDeal: deal,
      sortedDeals: [deal],
      currentUser: { id: 'other-user', username: 'other', roles: [] },
    });

    expect(screen.queryByRole('button', { name: 'Закрепить сделку' })).not.toBeInTheDocument();
  });

  it('clears search via clear button', () => {
    const onDealSearchSubmit = vi.fn();

    renderDealsList({ dealSearch: 'ипотека', onDealSearchSubmit });

    fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск сделок' }));

    expect(onDealSearchSubmit).toHaveBeenCalledTimes(1);
    expect(onDealSearchSubmit).toHaveBeenCalledWith('');
  });

  it('refreshes deals list via refresh button', () => {
    const onRefreshDealsList = vi.fn().mockResolvedValue(undefined);

    renderDealsList({ onRefreshDealsList });

    fireEvent.click(screen.getByRole('button', { name: 'Обновить сделки' }));

    expect(onRefreshDealsList).toHaveBeenCalledTimes(1);
  });

  it('disables refresh button and shows loading label while refresh is in progress', () => {
    renderDealsList({
      onRefreshDealsList: vi.fn().mockResolvedValue(undefined),
      isRefreshingDealsList: true,
    });

    expect(screen.getByRole('button', { name: 'Обновляем сделки' })).toBeDisabled();
  });

  it('selects deal from the mobile card list', () => {
    mockMatchMedia(false);
    const onSelectDeal = vi.fn();
    const selectedDeal = createDeal({ id: 'mobile-deal', title: 'Mobile Deal' });

    renderDealsList({
      selectedDeal,
      sortedDeals: [selectedDeal],
      onSelectDeal,
    });

    expect(screen.queryByTestId('deals-list-scroll')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть сделку Mobile Deal' }));

    expect(onSelectDeal).toHaveBeenCalledWith('mobile-deal');
  });

  it('uses compact default height for the desktop deals table', () => {
    renderDealsList();

    expect(screen.queryByRole('button', { name: 'Открыть сделку Deal 1' })).not.toBeInTheDocument();
    expect(screen.getByTestId('deals-list-scroll')).toHaveStyle({ height: '26vh' });
  });

  it('restores saved desktop deals table height from localStorage', () => {
    window.localStorage.setItem(DEALS_LIST_HEIGHT_STORAGE_KEY, '360px');

    renderDealsList();

    expect(screen.getByTestId('deals-list-scroll')).toHaveStyle({ height: '360px' });
  });

  it('falls back to compact default height when saved table height is invalid', () => {
    window.localStorage.setItem(DEALS_LIST_HEIGHT_STORAGE_KEY, 'not-a-size');

    renderDealsList();

    expect(screen.getByTestId('deals-list-scroll')).toHaveStyle({ height: '26vh' });
  });

  it('resizes the desktop deals table by dragging the separator', () => {
    renderDealsList();

    const tableScroll = screen.getByTestId('deals-list-scroll');
    mockTableHeight(tableScroll, 300);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Изменить высоту списка сделок' }), {
      clientY: 300,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, { clientY: 380 });
    fireEvent.pointerUp(window);

    expect(tableScroll).toHaveStyle({ height: '380px' });
    expect(window.localStorage.getItem(DEALS_LIST_HEIGHT_STORAGE_KEY)).toBe('380px');
  });

  it('does not resize the desktop deals table below the minimum height', () => {
    renderDealsList();

    const tableScroll = screen.getByTestId('deals-list-scroll');
    mockTableHeight(tableScroll, 300);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Изменить высоту списка сделок' }), {
      clientY: 300,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, { clientY: 0 });
    fireEvent.pointerUp(window);

    expect(tableScroll).toHaveStyle({ height: '220px' });
    expect(window.localStorage.getItem(DEALS_LIST_HEIGHT_STORAGE_KEY)).toBe('220px');
  });

  it('does not resize the desktop deals table above the viewport limit', () => {
    renderDealsList();

    const tableScroll = screen.getByTestId('deals-list-scroll');
    mockTableHeight(tableScroll, 650);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Изменить высоту списка сделок' }), {
      clientY: 300,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, { clientY: 500 });
    fireEvent.pointerUp(window);

    expect(tableScroll).toHaveStyle({ height: '700px' });
    expect(window.localStorage.getItem(DEALS_LIST_HEIGHT_STORAGE_KEY)).toBe('700px');
  });

  it('resizes the desktop deals table with arrow and boundary keys', () => {
    renderDealsList();

    const tableScroll = screen.getByTestId('deals-list-scroll');
    const separator = screen.getByRole('button', { name: 'Изменить высоту списка сделок' });
    mockTableHeight(tableScroll, 300);

    fireEvent.keyDown(separator, { key: 'ArrowDown' });
    expect(tableScroll).toHaveStyle({ height: '316px' });

    fireEvent.keyDown(separator, { key: 'Home' });
    expect(tableScroll).toHaveStyle({ height: '220px' });

    fireEvent.keyDown(separator, { key: 'End' });
    expect(tableScroll).toHaveStyle({ height: '700px' });
  });
});
