import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Deal } from '../../../../types';
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

const renderDealsList = (params?: {
  selectedDeal?: Deal | null;
  sortedDeals?: Deal[];
  dealRowFocusRequest?: { dealId: string; nonce: number } | null;
}) => {
  const selectedDeal = params?.selectedDeal ?? createDeal();
  const sortedDeals = params?.sortedDeals ?? [selectedDeal];

  return render(
    <DealsList
      sortedDeals={sortedDeals}
      selectedDeal={selectedDeal}
      dealRowFocusRequest={params?.dealRowFocusRequest ?? null}
      dealSearch=""
      onDealSearchChange={vi.fn()}
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
      onLoadMoreDeals={vi.fn().mockResolvedValue(undefined)}
      onSelectDeal={vi.fn()}
      onPinDeal={vi.fn().mockResolvedValue(undefined)}
      onUnpinDeal={vi.fn().mockResolvedValue(undefined)}
      currentUser={null}
      isDealSelectionBlocked={false}
    />,
  );
};

describe('DealsList dealRowFocusRequest', () => {
  beforeEach(() => {
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
        onUnpinDeal={vi.fn().mockResolvedValue(undefined)}
        currentUser={null}
        isDealSelectionBlocked={false}
      />,
    );

    expect(focusMock).toHaveBeenCalledTimes(1);
  });
});
