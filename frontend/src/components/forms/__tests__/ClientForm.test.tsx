import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ClientForm } from '../ClientForm';

const pasteDate = (input: Element, value: string) => {
  fireEvent.paste(input, {
    clipboardData: {
      getData: () => value,
    },
  });
};

describe('ClientForm', () => {
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
