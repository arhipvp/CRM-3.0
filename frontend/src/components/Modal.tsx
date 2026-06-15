import { useEffect, useId, type ReactNode } from 'react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const MODAL_SIZE_TO_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

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
  closeOnEscape = false,
  hideCloseButton = false,
  size = 'md',
  zIndex = 40,
  panelClassName = '',
  bodyClassName = '',
  bodyScrollable = true,
}: ModalProps) {
  const titleId = useId();
  const sizeClass = MODAL_SIZE_TO_CLASS[size];

  useEffect(() => {
    if (!closeOnEscape) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-x-hidden bg-black/40 p-2 sm:p-4"
      style={{ zIndex }}
      onClick={() => {
        if (closeOnOverlayClick) {
          onClose();
        }
      }}
    >
      <div
        className={`flex max-h-[calc(100dvh-1rem)] min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] ${sizeClass} ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {!hideCloseButton && (
            <button type="button" onClick={onClose} className="icon-btn" aria-label="Закрыть">
              &times;
            </button>
          )}
        </div>
        <div
          className={`min-h-0 min-w-0 flex-1 p-4 sm:p-5 ${
            bodyScrollable ? 'overflow-y-auto' : 'overflow-hidden'
          } ${bodyClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
