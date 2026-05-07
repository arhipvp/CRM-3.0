import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DateInput } from '../forms/DateInput';

describe('DateInput', () => {
  it('sets ISO date on compact Russian date paste', () => {
    const onChange = vi.fn();

    render(<DateInput aria-label="Дата" value="" onChange={onChange} />);

    fireEvent.paste(screen.getByLabelText('Дата'), {
      clipboardData: {
        getData: () => '26021986',
      },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: '1986-02-26' }),
      }),
    );
  });
});
