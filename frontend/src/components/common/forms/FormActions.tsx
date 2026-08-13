import React from 'react';

import { Button } from '../Button';
import type { ButtonSize, ButtonVariant } from '../buttonClassName';

export interface FormActionsProps {
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  isSubmitDisabled?: boolean;
  align?: 'end' | 'between';
  submitClassName?: string;
  cancelClassName?: string;
  submitVariant?: ButtonVariant;
  cancelVariant?: ButtonVariant;
  submitSize?: ButtonSize;
  cancelSize?: ButtonSize;
}

export const FormActions: React.FC<FormActionsProps> = ({
  onCancel,
  cancelLabel = 'Отмена',
  submitLabel,
  submittingLabel = 'Сохраняем...',
  isSubmitting = false,
  isSubmitDisabled = false,
  align = 'end',
  submitClassName,
  cancelClassName,
  submitVariant = 'primary',
  cancelVariant = 'secondary',
  submitSize = 'md',
  cancelSize = 'md',
}) => {
  const containerClassName =
    align === 'between'
      ? 'flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-4'
      : 'flex items-center justify-end gap-2 border-t border-[var(--app-border)] pt-4';

  return (
    <div className={containerClassName}>
      {onCancel && (
        <Button
          onClick={onCancel}
          disabled={isSubmitting}
          variant={cancelVariant}
          size={cancelSize}
          className={cancelClassName}
        >
          {cancelLabel}
        </Button>
      )}
      <Button
        type="submit"
        disabled={isSubmitting || isSubmitDisabled}
        variant={submitVariant}
        size={submitSize}
        isLoading={isSubmitting}
        loadingLabel={submittingLabel}
        className={submitClassName}
      >
        {submitLabel}
      </Button>
    </div>
  );
};
