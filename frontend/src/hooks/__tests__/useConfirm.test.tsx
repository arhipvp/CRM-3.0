import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useConfirm } from '../useConfirm';

const TestComponent: React.FC = () => {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [result, setResult] = React.useState<string>('none');

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          const confirmed = await confirm({
            title: 'Проверка',
            message: 'Подтвердите действие',
            confirmText: 'Да',
            cancelText: 'Нет',
          });
          setResult(confirmed ? 'yes' : 'no');
        }}
      >
        Open
      </button>
      <span data-testid="confirm-result">{result}</span>
      <ConfirmDialogRenderer />
    </div>
  );
};

describe('useConfirm', () => {
  it('resolves true after confirm click', async () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Да' }));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-result')).toHaveTextContent('yes');
    });
  });

  it('resolves false after cancel click', async () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Нет' }));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-result')).toHaveTextContent('no');
    });
  });
});
