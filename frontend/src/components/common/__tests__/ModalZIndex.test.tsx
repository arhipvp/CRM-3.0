import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '../ConfirmDialog';
import { PromptDialog } from '../modal/PromptDialog';
import { FinancialRecordModal } from '../../financialRecords/FinancialRecordModal';
import { PaymentModal } from '../../payments/PaymentModal';

const getModalRoot = (name: string) => screen.getByRole('dialog', { name }).parentElement;

describe('modal z-index', () => {
  it('renders confirmation dialogs above preview deal modals by default', () => {
    render(
      <ConfirmDialog
        isOpen
        title="Удалить запись?"
        message="Подтвердите удаление"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(getModalRoot('Удалить запись?')).toHaveStyle({ zIndex: '80' });
  });

  it('passes custom z-index to prompt dialogs', () => {
    render(
      <PromptDialog
        isOpen
        title="Закрыть сделку"
        label="Причина закрытия"
        value=""
        onChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Закрыть"
        zIndex={70}
      />,
    );

    expect(getModalRoot('Закрыть сделку')).toHaveStyle({ zIndex: '70' });
  });

  it('passes custom z-index to payment modal', () => {
    render(
      <PaymentModal
        isOpen
        title="Редактировать платёж"
        zIndex={70}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />,
    );

    expect(getModalRoot('Редактировать платёж')).toHaveStyle({ zIndex: '70' });
  });

  it('passes custom z-index to financial record modal', () => {
    render(
      <FinancialRecordModal
        isOpen
        title="Редактировать запись"
        paymentId="payment-1"
        zIndex={70}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />,
    );

    expect(getModalRoot('Редактировать запись')).toHaveStyle({ zIndex: '70' });
  });
});
