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

  it('closes on Escape by default', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test modal" onClose={onClose}>
        <div>Body</div>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('allows Escape closing to be disabled', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test modal" onClose={onClose} closeOnEscape={false}>
        <div>Body</div>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
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

  it('applies custom panel and body classes when provided', () => {
    render(
      <Modal
        title="Styled modal"
        onClose={vi.fn()}
        panelClassName="custom-panel"
        bodyClassName="custom-body"
      >
        <div>Body</div>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('custom-panel');
    expect(screen.getByText('Body').parentElement?.className).toContain('custom-body');
  });

  it('constrains the panel to the viewport and scrolls the body', () => {
    render(
      <Modal title="Responsive modal" onClose={vi.fn()}>
        <div>Long body</div>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    const body = screen.getByText('Long body').parentElement;
    const header = screen.getByRole('heading', { name: 'Responsive modal' }).parentElement;

    expect(dialog.className).toContain('flex');
    expect(dialog.className).toContain('max-h-[calc(100dvh-1rem)]');
    expect(dialog.className).toContain('overflow-hidden');
    expect(header?.className).toContain('shrink-0');
    expect(body?.className).toContain('min-h-0');
    expect(body?.className).toContain('flex-1');
    expect(body?.className).toContain('overflow-y-auto');
  });

  it('allows nested forms to manage their own scrolling', () => {
    render(
      <Modal title="Nested scroll modal" onClose={vi.fn()} bodyScrollable={false}>
        <div>Nested form</div>
      </Modal>,
    );

    const body = screen.getByText('Nested form').parentElement;

    expect(body?.className).toContain('overflow-hidden');
    expect(body?.className).not.toContain('overflow-y-auto');
  });

  it('closes only the top dialog on Escape', () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    render(
      <Modal title="Parent" onClose={closeParent}>
        <Modal title="Child" onClose={closeChild}>
          <button type="button">Child action</button>
        </Modal>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeChild).toHaveBeenCalledTimes(1);
    expect(closeParent).not.toHaveBeenCalled();
  });

  it('traps focus and restores it after closing', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <Modal title="Focus modal" onClose={vi.fn()}>
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Modal>,
    );

    const closeButton = screen.getByRole('button', { name: 'Закрыть' });
    const lastButton = screen.getByRole('button', { name: 'Last action' });
    expect(closeButton).toHaveFocus();

    lastButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastButton).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
    trigger.remove();
  });
});
