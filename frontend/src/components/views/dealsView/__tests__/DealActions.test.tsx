import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DealActions } from '../DealActions';

const baseProps = {
  isSelectedDealDeleted: false,
  isDeletingDeal: false,
  isRestoringDeal: false,
  isDealClosedStatus: false,
  isClosingDeal: false,
  isReopeningDeal: false,
  isCurrentUserSeller: true,
  canReopenClosedDeal: true,
  dealEventsLength: 1,
  onEdit: vi.fn(),
  onRestore: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
  onReopen: vi.fn(),
  onMerge: vi.fn(),
  onDelay: vi.fn(),
  onRefresh: vi.fn(),
};

describe('DealActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls handlers when buttons clicked', () => {
    render(<DealActions {...baseProps} />);

    fireEvent.click(screen.getByText('Редактировать'));
    expect(baseProps.onEdit).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Удалить'));
    expect(baseProps.onDelete).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Закрыть'));
    expect(baseProps.onClose).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Сцепить'));
    expect(baseProps.onMerge).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Отложить'));
    expect(baseProps.onDelay).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Обновить'));
    expect(baseProps.onRefresh).toHaveBeenCalled();
  });

  it('shows restore button when deal deleted and calls restore', () => {
    render(<DealActions {...baseProps} isSelectedDealDeleted onRestore={baseProps.onRestore} />);
    fireEvent.click(screen.getByText('Восстановить'));
    expect(baseProps.onRestore).toHaveBeenCalled();
  });
});
