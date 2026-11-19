import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FinancialRecord } from '../../../types';
import { AddFinancialRecordForm } from '../AddFinancialRecordForm';

describe('AddFinancialRecordForm settlement date', () => {
  it.each([undefined, '2026-05-15'])(
    'shows date %s read-only and omits it on submit',
    async (date) => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const record: FinancialRecord | undefined = date
        ? {
            id: 'legacy-record',
            paymentId: 'payment-1',
            amount: '100',
            date,
            recordType: 'Доход',
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-01T00:00:00Z',
          }
        : undefined;
      const { container } = render(
        <AddFinancialRecordForm
          paymentId="payment-1"
          record={record}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />,
      );

      expect(screen.getByText('Оплата отмечается через ведомости')).toBeInTheDocument();
      expect(screen.getByText(date ? '15.05.2026' : 'Не оплачено')).toBeInTheDocument();
      expect(container.querySelector('input[type="date"]')).toBeNull();
      fireEvent.change(screen.getByLabelText('Сумма (руб.) *'), { target: { value: '200' } });
      fireEvent.submit(container.querySelector('form')!);

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ paymentId: 'payment-1', amount: '200' });
      expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('date');
    },
  );
});
