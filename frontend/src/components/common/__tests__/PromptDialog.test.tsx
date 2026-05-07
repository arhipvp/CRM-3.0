import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PromptDialog } from '../modal/PromptDialog';

describe('PromptDialog', () => {
  it('normalizes pasted date through date input mode', () => {
    const onChange = vi.fn();

    render(
      <PromptDialog
        isOpen
        title="Проставить дату оплаты"
        label="Дата оплаты"
        value=""
        onChange={onChange}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Продолжить"
        inputType="date"
      />,
    );

    fireEvent.paste(screen.getByLabelText('Дата оплаты'), {
      clipboardData: {
        getData: () => '26/02/1986',
      },
    });

    expect(onChange).toHaveBeenCalledWith('1986-02-26');
  });
});
