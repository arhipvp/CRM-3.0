import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AddQuoteForm } from '../AddQuoteForm';

vi.mock('../../../api', () => ({
  fetchInsuranceCompanies: vi.fn().mockResolvedValue([{ id: 'company-1', name: 'Компания 1' }]),
  fetchInsuranceTypes: vi.fn().mockResolvedValue([{ id: 'type-1', name: 'КАСКО' }]),
}));

describe('AddQuoteForm', () => {
  it('отправляет франшизу как число и рендерит числовой input', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<AddQuoteForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Компания 1' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox', { name: /страховая компания/i }), {
      target: { value: 'company-1' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /тип страхования/i }), {
      target: { value: 'type-1' },
    });
    fireEvent.change(screen.getByLabelText(/Страховая сумма, ₽/), {
      target: { value: '1000000' },
    });
    fireEvent.change(screen.getByLabelText(/Премия, ₽/), {
      target: { value: '50000' },
    });

    const deductibleInput = screen.getByLabelText('Франшиза, ₽');
    expect(deductibleInput).toHaveAttribute('type', 'number');

    fireEvent.change(deductibleInput, {
      target: { value: '300000' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          deductible: 300000,
        }),
      );
    });
  });
});
