import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormActions } from '../forms/FormActions';
import { FormError } from '../forms/FormError';
import { FormField } from '../forms/FormField';

describe('form primitives', () => {
  it('renders form field with label and hint', () => {
    render(
      <FormField label="Поле" htmlFor="field-id" required hint="Подсказка">
        <input id="field-id" />
      </FormField>,
    );

    expect(screen.getByText('Поле *')).toBeInTheDocument();
    expect(screen.getByText('Подсказка')).toBeInTheDocument();
  });

  it('renders form error only when message exists', () => {
    const { rerender } = render(<FormError message={null} />);
    expect(screen.queryByText('Ошибка')).not.toBeInTheDocument();

    rerender(<FormError message="Ошибка" />);
    expect(screen.getByText('Ошибка')).toBeInTheDocument();
  });

  it('calls cancel action and blocks submit in loading state', () => {
    const onCancel = vi.fn();
    render(
      <form>
        <FormActions
          onCancel={onCancel}
          isSubmitting
          submitLabel="Сохранить"
          submittingLabel="Сохраняем..."
        />
      </form>,
    );

    expect(screen.getByRole('button', { name: 'Сохраняем...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
