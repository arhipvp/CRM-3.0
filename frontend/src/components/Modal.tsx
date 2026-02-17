import React from 'react';

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
  children: React.ReactNode;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  size?: ModalSize;
  zIndex?: number;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  onClose,
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  size = 'md',
  zIndex = 40,
}) => {
  const titleId = React.useId();
  const sizeClass = MODAL_SIZE_TO_CLASS[size];

  React.useEffect(() => {
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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      style={{ zIndex }}
      onClick={() => {
        if (closeOnOverlayClick) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full rounded-2xl border border-slate-200 bg-white shadow-2xl ${sizeClass}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Закрыть">
            &times;
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
