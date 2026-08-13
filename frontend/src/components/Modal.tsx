import { useEffect, useId, useRef, type ReactNode } from 'react';

import { IconButton } from './common/Button';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const MODAL_SIZE_TO_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let openModalCount = 0;
let previousBodyOverflow = '';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  hideCloseButton?: boolean;
  size?: ModalSize;
  zIndex?: number;
  panelClassName?: string;
  bodyClassName?: string;
  bodyScrollable?: boolean;
}

export function Modal({
  title,
  onClose,
  children,
  closeOnOverlayClick = false,
  closeOnEscape = true,
  hideCloseButton = false,
  size = 'md',
  zIndex = 40,
  panelClassName = '',
  bodyClassName = '',
  bodyScrollable = true,
}: ModalProps) {
  const titleId = useId();
  const sizeClass = MODAL_SIZE_TO_CLASS[size];
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (openModalCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openModalCount += 1;

    const dialog = dialogRef.current;
    const initialFocusTarget =
      dialog?.querySelector<HTMLElement>('[autofocus]') ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      dialog;
    if (!dialog?.querySelector('[role="dialog"][aria-modal="true"]')) {
      initialFocusTarget?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const topDialog = Array.from(
        document.querySelectorAll<HTMLDivElement>('[role="dialog"][aria-modal="true"]'),
      ).at(-1);
      if (!dialog || topDialog !== dialog) {
        return;
      }

      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (element) =>
          !element.closest('[hidden]') &&
          !element.closest('[aria-hidden="true"]') &&
          element.getAttribute('aria-disabled') !== 'true',
      );
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
      if (previouslyFocusedElementRef.current?.isConnected) {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [closeOnEscape]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-x-hidden bg-slate-950/45 p-2 backdrop-blur-[2px] sm:p-4"
      style={{ zIndex }}
      onClick={() => {
        if (closeOnOverlayClick) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`flex max-h-[calc(100dvh-1rem)] min-w-0 w-full flex-col overflow-hidden rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-white shadow-[var(--app-shadow-overlay)] sm:max-h-[calc(100dvh-2rem)] ${sizeClass} ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
          <h2 id={titleId} className="min-w-0 break-words text-base font-semibold text-slate-900">
            {title}
          </h2>
          {!hideCloseButton && <IconButton icon="close" label="Закрыть" onClick={onClose} />}
        </div>
        <div
          className={`min-h-0 min-w-0 flex-1 p-4 ${
            bodyScrollable ? 'overflow-y-auto' : 'overflow-hidden'
          } ${bodyClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
