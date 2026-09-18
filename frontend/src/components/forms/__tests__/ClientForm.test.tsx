import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ClientForm } from '../ClientForm';
import { fetchClientLookup } from '../../../api';

vi.mock('../../../api', () => ({
  fetchClientLookup: vi.fn().mockResolvedValue({ results: [] }),
}));

const pasteDate = (input: Element, value: string) => {
  fireEvent.paste(input, {
    clipboardData: {
      getData: () => value,
    },
  });
};

describe('ClientForm', () => {
  it('searches remote clients, excludes self and deleted clients, and saves the selected referrer', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fetchClientLookup).mockResolvedValueOnce({
      count: 3,
      next: null,
      previous: null,
      results: [
        { id: 'self', name: 'Иван Петров', createdAt: '', updatedAt: '' },
        {
          id: 'deleted',
          name: 'Иван Удалённый',
          createdAt: '',
          updatedAt: '',
          deletedAt: '2026-01-01',
        },
        { id: 'referrer', name: 'Иван Иванов', createdAt: '', updatedAt: '' },
      ],
    });
    render(<ClientForm initial={{ id: 'self', name: 'Иван Петров' }} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Клиент от…' }), {
      target: { value: 'Иван' },
    });
    const option = await screen.findByRole('option', { name: 'Иван Иванов' });
    expect(screen.queryByRole('option', { name: 'Иван Петров' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Иван Удалённый' })).not.toBeInTheDocument();
    fireEvent.mouseDown(option);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ referredBy: 'referrer' })),
    );
  });

  it('shows a retained deleted referrer and lets the user clear it', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ClientForm
        initial={{
          name: 'Клиент',
          referredBy: 'deleted',
          referredByName: 'Рекомендатель',
          referredByDeleted: true,
        }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveValue('Рекомендатель');
    expect(screen.getByText(/Рекомендатель удалён/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Очистить рекомендателя' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ referredBy: null })),
    );
  });

  it('requires an actual selection and allows replacing the referrer', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ClientForm
        clients={[{ id: 'new', name: 'Новый', createdAt: '', updatedAt: '' }]}
        initial={{ name: 'Клиент', referredBy: 'old', referredByName: 'Старый' }}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Новый' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Выберите рекомендателя из списка/)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Новый' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ referredBy: 'new' })),
    );
  });

  it.each(['26.02.1986', '26021986'])(
    'submits pasted birth date %s as ISO date',
    async (dateText) => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const { container } = render(<ClientForm onSubmit={onSubmit} />);

      fireEvent.change(screen.getByPlaceholderText('Например: "Иван Иванов"'), {
        target: { value: 'Иван Иванов' },
      });
      pasteDate(container.querySelector('input[type="date"]')!, dateText);
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            birthDate: '1986-02-26',
          }),
        );
      });
    },
  );
});
