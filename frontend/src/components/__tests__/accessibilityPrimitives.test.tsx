import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InlineAlert } from '../common/InlineAlert';
import { Modal } from '../Modal';
import { DealTabs } from '../views/dealsView/DealTabs';

afterEach(() => {
  document.body.style.overflow = '';
});

describe('accessibility primitives', () => {
  it('renders alerts without detectable axe violations', async () => {
    const { container } = render(<InlineAlert>Не удалось сохранить данные</InlineAlert>);

    expect((await axe(container)).violations).toEqual([]);
  });

  it('renders a labelled modal without detectable axe violations', async () => {
    const { container } = render(
      <Modal title="Редактирование" onClose={vi.fn()}>
        <label htmlFor="accessible-name">Название</label>
        <input id="accessible-name" />
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('renders grouped deal navigation without detectable axe violations', async () => {
    const { container } = render(<DealTabs activeTab="tasks" onChange={vi.fn()} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
