import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AllRecordsPanel } from '../AllRecordsPanel';

const renderPanel = (overrides: Partial<ComponentProps<typeof AllRecordsPanel>> = {}) => {
  const props: ComponentProps<typeof AllRecordsPanel> = {
    allRecordsSearchInput: '',
    onSearchChange: vi.fn(),
    onSearchSubmit: vi.fn(),
    allRecordsError: null,
    isAllRecordsLoading: false,
    onRetryLoad: vi.fn(),
    showUnpaidPayments: false,
    onToggleShowUnpaidPayments: vi.fn(),
    showStatementRecords: false,
    onToggleShowStatementRecords: vi.fn(),
    showPaidRecords: false,
    onToggleShowPaidRecords: vi.fn(),
    showZeroSaldo: false,
    onToggleShowZeroSaldo: vi.fn(),
    salesChannelFilter: [],
    onSalesChannelFilterChange: vi.fn(),
    salesChannels: [],
    paymentScheduledDateFrom: '',
    onPaymentScheduledDateFromChange: vi.fn(),
    paymentScheduledDateTo: '',
    onPaymentScheduledDateToChange: vi.fn(),
    activeAllRecordsFilterCount: 0,
    canResetAllRecordsFilters: false,
    onResetAllRecordsFilters: vi.fn(),
    isAllRecordsExporting: false,
    allRecordsExportError: null,
    onExportAllRecords: vi.fn(),
    recordTypeFilter: 'all',
    onRecordTypeFilterChange: vi.fn(),
    isRecordTypeLocked: false,
    targetStatementId: '',
    onTargetStatementChange: vi.fn(),
    statements: [],
    normalizeText: (value) => value ?? '',
    shownRecordsCount: 0,
    totalRecordsCount: 0,
    isAllRecordsLoadingMore: false,
    allRecordsHasMore: false,
    onLoadMore: vi.fn(),
    recordsTable: <div>Таблица записей</div>,
    ...overrides,
  };

  render(<AllRecordsPanel {...props} />);
  return props;
};

describe('AllRecordsPanel', () => {
  it('submits search from the search form', () => {
    const onSearchSubmit = vi.fn();

    renderPanel({ allRecordsSearchInput: 'Гриша', onSearchSubmit });

    fireEvent.submit(screen.getByLabelText('Поиск по записям').closest('form') as HTMLFormElement);

    expect(onSearchSubmit).toHaveBeenCalledTimes(1);
    expect(onSearchSubmit).toHaveBeenCalledWith();
  });

  it('refreshes records via refresh button', () => {
    const onRetryLoad = vi.fn();

    renderPanel({ onRetryLoad });

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));

    expect(onRetryLoad).toHaveBeenCalledTimes(1);
  });

  it('selects multiple sales channels and changes payment date filters', () => {
    const onSalesChannelFilterChange = vi.fn();
    const onPaymentScheduledDateFromChange = vi.fn();
    const onPaymentScheduledDateToChange = vi.fn();

    renderPanel({
      salesChannelFilter: ['channel-1'],
      salesChannels: [
        {
          id: 'channel-1',
          name: 'Перебоева',
          description: '',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'channel-2',
          name: 'Чернышов, Сбер',
          description: '',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      onSalesChannelFilterChange,
      onPaymentScheduledDateFromChange,
      onPaymentScheduledDateToChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Выбрано: 1' }));
    fireEvent.click(screen.getByLabelText('Чернышов, Сбер'));
    fireEvent.change(screen.getByLabelText('Дата платежа от'), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('Дата платежа до'), {
      target: { value: '2026-03-31' },
    });

    expect(onSalesChannelFilterChange).toHaveBeenCalledWith(['channel-1', 'channel-2']);
    expect(onPaymentScheduledDateFromChange).toHaveBeenCalledWith('2026-03-01');
    expect(onPaymentScheduledDateToChange).toHaveBeenCalledWith('2026-03-31');
  });

  it('clears selected sales channels', () => {
    const onSalesChannelFilterChange = vi.fn();

    renderPanel({
      salesChannelFilter: ['channel-1', 'channel-2'],
      onSalesChannelFilterChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Выбрано: 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));

    expect(onSalesChannelFilterChange).toHaveBeenCalledWith([]);
  });

  it('resets filters and shows active filters count', () => {
    const onResetAllRecordsFilters = vi.fn();

    renderPanel({
      activeAllRecordsFilterCount: 2,
      canResetAllRecordsFilters: true,
      onResetAllRecordsFilters,
    });

    expect(screen.getByText('Активных фильтров: 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));

    expect(onResetAllRecordsFilters).toHaveBeenCalledTimes(1);
  });

  it('disables search controls while records are loading', () => {
    renderPanel({ isAllRecordsLoading: true });

    expect(screen.getByRole('button', { name: 'Найти' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Обновляем...' })).toBeDisabled();
  });
});
