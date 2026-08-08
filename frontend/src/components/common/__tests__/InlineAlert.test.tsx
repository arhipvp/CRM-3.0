import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InlineAlert } from '../InlineAlert';

describe('InlineAlert', () => {
  it('announces errors assertively', () => {
    render(<InlineAlert>Ошибка</InlineAlert>);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('announces informational feedback politely', () => {
    render(<InlineAlert tone="success">Сохранено</InlineAlert>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
