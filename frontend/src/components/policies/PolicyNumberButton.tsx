import React from 'react';

import { useNotification } from '../../contexts/NotificationContext';
import { copyToClipboard } from '../../utils/clipboard';
import { POLICY_PLACEHOLDER } from './text';

interface PolicyNumberButtonProps {
  value?: string | null;
  placeholder?: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export const PolicyNumberButton: React.FC<PolicyNumberButtonProps> = ({
  value,
  placeholder = POLICY_PLACEHOLDER,
  className,
  title = 'Скопировать номер полиса',
  ariaLabel = 'Скопировать номер полиса',
}) => {
  const { addNotification } = useNotification();
  const normalized = (value ?? '').trim();

  if (!normalized) {
    return <span className={className}>{placeholder}</span>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={async (event) => {
        event.stopPropagation();
        const copied = await copyToClipboard(normalized);
        if (copied) {
          addNotification('Скопировано', 'success', 1600);
        }
      }}
      aria-label={ariaLabel}
      title={title}
    >
      {normalized}
    </button>
  );
};
