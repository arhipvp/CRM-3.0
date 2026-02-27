import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '../Modal';

describe('Modal', () => {
  it('does not close by overlay click by default', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test modal" onClose={onClose}>
        <div>Body</div>
      </Modal>,
    );

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on Escape by default', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test modal" onClose={onClose}>
        <div>Body</div>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes by explicit close button', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test modal" onClose={onClose}>
        <div>Body</div>
      </Modal>,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
